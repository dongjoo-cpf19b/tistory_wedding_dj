import base64
import http.client
import json
import os
import threading
import unittest
from unittest.mock import patch
import server

PNG = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\nfixture').decode()


class WeddingServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.host = f'127.0.0.1:{cls.httpd.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def request(self, method='GET', path='/', data=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=3)
        default = {'Host': self.host, 'Origin': 'http://' + self.host, 'Content-Type': 'application/json'}
        default.update(headers or {})
        conn.request(method, path, body=json.dumps(data) if data is not None else None, headers=default)
        r = conn.getresponse()
        result = r.status, r.read()
        conn.close()
        return result

    def payload(self):
        return {'images': [PNG] * 3, 'prompt': '웨딩 촬영', 'size': '1024x1536', 'consent': True}

    def test_static_allows_only_public_app_files(self):
        self.assertEqual(self.request()[0], 200)
        for path in ('/.env', '/server.py', '/tests/test_server.py', '/assets/../server.py'):
            self.assertEqual(self.request(path=path)[0], 404)

    def test_host_and_origin_protection(self):
        self.assertEqual(self.request(headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.request('POST', '/api/generate', self.payload(), {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('POST', '/api/generate', self.payload(), {'Sec-Fetch-Site': 'cross-site'})[0], 403)

    def test_config_never_exposes_key(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-secret-never-output'}):
            status, body = self.request(path='/api/config')
            self.assertEqual(status, 200)
            self.assertTrue(json.loads(body)['enabled'])
            self.assertNotIn(b'test-secret', body)

    def test_payload_order_and_model_contract(self):
        p = server.validate_payload(self.payload())
        self.assertEqual(p['images'], [{'image_url': PNG}] * 3)
        self.assertEqual(p['n'], 1)
        self.assertEqual(p['output_format'], 'png')

    def test_invalid_payload_does_not_generate(self):
        cases = [dict(self.payload(), consent=False), dict(self.payload(), images=['https://example.com/image'] * 3), dict(self.payload(), images=['data:image/png;base64,YWJj'] * 3), dict(self.payload(), size='1x1'), dict(self.payload(), prompt='')]
        with patch('server.generate') as mocked:
            for case in cases:
                self.assertEqual(self.request('POST', '/api/generate', case)[0], 400)
            mocked.assert_not_called()

    def test_missing_key(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.request('POST', '/api/generate', self.payload())[0], 503)

    def test_generation_with_mocked_provider(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fake-key'}), patch('server.generate', return_value=PNG) as mocked:
            status, body = self.request('POST', '/api/generate', self.payload())
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)['image'], PNG)
            self.assertEqual(mocked.call_count, 1)

    def test_busy_and_provider_failure(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fake-key'}):
            server.LOCK.acquire()
            try:
                self.assertEqual(self.request('POST', '/api/generate', self.payload())[0], 409)
            finally:
                server.LOCK.release()
            with patch('server.generate', side_effect=RuntimeError('secret-token')):
                status, body = self.request('POST', '/api/generate', self.payload())
                self.assertEqual(status, 502)
                self.assertNotIn(b'secret-token', body)
            self.assertFalse(server.LOCK.locked())


if __name__ == '__main__':
    unittest.main()
