"""Optional loopback-only image generation bridge. Python 3.10+, standard library only."""
import argparse
import base64
import binascii
import json
import os
import re
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
MODEL = os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-image-2.5-sunburst')
MAX_REQUEST = 24 * 1024 * 1024
LOCK = threading.Lock()
STATIC = {'/': ('index.html', 'text/html; charset=utf-8'), '/index.html': ('index.html', 'text/html; charset=utf-8'), '/assets/app.css': ('assets/app.css', 'text/css; charset=utf-8'), '/assets/app.js': ('assets/app.js', 'application/javascript'), '/assets/core.js': ('assets/core.js', 'application/javascript')}


def validate_payload(data):
    if not isinstance(data, dict) or data.get('consent') is not True:
        raise ValueError('사진 전송 및 API 비용 확인이 필요합니다.')
    prompt = data.get('prompt')
    if not isinstance(prompt, str) or not 1 <= len(prompt) <= 16000:
        raise ValueError('요청문 길이가 올바르지 않습니다.')
    images = data.get('images')
    if not isinstance(images, list) or not 3 <= len(images) <= 5:
        raise ValueError('인물 2장과 스튜디오 사진을 포함해 3~5장의 사진이 필요합니다.')
    for image in images:
        if not isinstance(image, str) or len(image) > 6 * 1024 * 1024:
            raise ValueError('사진 크기가 너무 큽니다.')
        match = re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})', image)
        if not match:
            raise ValueError('지원하는 이미지 형식이 아닙니다.')
        try:
            raw = base64.b64decode(match[2], validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ValueError('사진 데이터가 올바르지 않습니다.') from exc
        kind = match[1]
        valid = (kind == 'png' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or (kind == 'jpeg' and raw.startswith(b'\xff\xd8\xff')) or (kind == 'webp' and raw.startswith(b'RIFF') and raw[8:12] == b'WEBP')
        if not valid:
            raise ValueError('사진 데이터가 올바르지 않습니다.')
    size = data.get('size')
    if size not in ('1024x1536', '1536x1024', '1024x1024'):
        raise ValueError('지원하는 화면 비율이 아닙니다.')
    return {'model': MODEL, 'prompt': prompt, 'images': [{'image_url': image} for image in images], 'n': 1, 'size': size, 'quality': 'medium', 'output_format': 'png'}


def generate(payload, api_key):
    request = urllib.request.Request('https://api.openai.com/v1/images/edits', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + api_key, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=240) as response:
        raw = response.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError('생성 이미지가 허용 크기를 초과했습니다.')
    result = json.loads(raw)
    image = result.get('data', [{}])[0].get('b64_json')
    if not isinstance(image, str) or len(image) > 12 * 1024 * 1024 or not base64.b64decode(image, validate=True).startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('생성 결과를 확인할 수 없습니다.')
    return 'data:image/png;base64,' + image


class Handler(BaseHTTPRequestHandler):
    server_version = 'WeddingDJ/0.1'

    def log_message(self, *args):
        pass  # Do not log prompts, images, filenames, headers or credentials.

    def allowed_host(self):
        host = self.headers.get('Host', '')
        return host in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}

    def respond(self, status, content, content_type='application/json; charset=utf-8'):
        body = content if isinstance(content, bytes) else json.dumps(content, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.allowed_host():
            self.respond(403, {'error': '로컬 주소에서만 사용할 수 있습니다.'})
            return
        path = urlsplit(self.path).path
        if path == '/api/config':
            self.respond(200, {'enabled': bool(os.environ.get('OPENAI_API_KEY')), 'model': MODEL})
        elif path in STATIC:
            name, mime = STATIC[path]
            self.respond(200, (ROOT / name).read_bytes(), mime)
        else:
            self.respond(404, {'error': 'Not found'})

    def do_POST(self):
        origin = self.headers.get('Origin', '')
        if not self.allowed_host() or origin != 'http://' + self.headers.get('Host', '') or self.headers.get('Sec-Fetch-Site', 'same-origin') not in ('same-origin', 'none'):
            self.respond(403, {'error': '동일한 로컬 화면에서 요청해 주세요.'})
            return
        if urlsplit(self.path).path != '/api/generate':
            self.respond(404, {'error': 'Not found'})
            return
        if self.headers.get_content_type() != 'application/json':
            self.respond(415, {'error': 'JSON 요청만 지원합니다.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_REQUEST:
            self.respond(413, {'error': '요청 크기를 확인해 주세요.'})
            return
        try:
            self.connection.settimeout(15)
            payload = validate_payload(json.loads(self.rfile.read(length)))
        except (ValueError, OSError) as exc:
            self.respond(400, {'error': str(exc) if isinstance(exc, ValueError) and not isinstance(exc, json.JSONDecodeError) else '요청 데이터를 읽을 수 없습니다.'})
            return
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            self.respond(503, {'error': '서버에 개인 API 키를 설정해 주세요.'})
            return
        if not LOCK.acquire(blocking=False):
            self.respond(409, {'error': '이미지 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.'})
            return
        try:
            self.respond(200, {'image': generate(payload, api_key)})
        except urllib.error.HTTPError as exc:
            messages = {401: 'API 키를 확인해 주세요.', 403: '해당 계정의 이미지 모델 이용 권한을 확인해 주세요.', 429: 'API 한도 또는 잔액을 확인한 후 다시 시도해 주세요.', 400: '입력 사진·요청문·모델 지원 여부를 확인해 주세요.'}
            self.respond(502, {'error': messages.get(exc.code, '이미지 제공 서비스에서 오류가 발생했습니다. 잠시 후 확인해 주세요.')})
        except Exception:
            self.respond(502, {'error': '생성 결과를 받지 못했습니다. 시간이 초과된 경우 API 사용 내역을 확인한 후 다시 시도해 주세요.'})
        finally:
            LOCK.release()


def main():
    parser = argparse.ArgumentParser(description='웨딩 시안 만들기 로컬 실행')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'웨딩 시안 만들기: http://127.0.0.1:{server.server_port}')
    print('종료: Ctrl+C / API 생성: OPENAI_API_KEY 환경변수를 설정한 경우에만 사용 가능')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
