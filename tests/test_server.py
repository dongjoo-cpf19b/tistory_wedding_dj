import http.client
import threading
import unittest
import server

class StaticPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.thread=threading.Thread(target=cls.httpd.serve_forever,daemon=True)
        cls.thread.start()
        cls.host=f'127.0.0.1:{cls.httpd.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown();cls.httpd.server_close();cls.thread.join()
    def request(self,path='/',method='GET',host=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.httpd.server_port,timeout=3)
        conn.request(method,path,headers={'Host':host or self.host})
        response=conn.getresponse();status=response.status;response.read();conn.close();return status
    def test_static_app_and_preset_assets_are_served(self):
        for path in server.STATIC:self.assertEqual(self.request(path),200)
    def test_private_files_and_arbitrary_paths_are_unavailable(self):
        for path in ('/.env','/server.py','/tests/test_server.py','/assets/../server.py'):
            self.assertEqual(self.request(path),404)
        self.assertEqual(self.request(host='evil.example'),403)
    def test_no_ai_generation_endpoint_exists(self):
        self.assertEqual(self.request('/api/generate'),404)
        self.assertEqual(self.request('/api/generate','POST'),501)

if __name__=='__main__':unittest.main()
