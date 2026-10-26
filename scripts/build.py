"""Build a self-contained HTML and ZIP using the Python standard library."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def build():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="assets/app.css">', '<style>' + (ROOT / 'assets/app.css').read_text(encoding='utf-8') + '</style>')
    scripts = []
    for name in ('scenes', 'core', 'app'):
        html = html.replace(f'<script defer src="assets/{name}.js"></script>', '')
        code = (ROOT / f'assets/{name}.js').read_text(encoding='utf-8').replace('</script', '<\\/script')
        scripts.append('<script>' + code + '</script>')
    html = html.replace('</body>', ''.join(scripts) + '</body>')
    output = ROOT / 'downloads'
    output.mkdir(exist_ok=True)
    single = output / 'wedding-dj.html'
    single.write_text(html, encoding='utf-8')
    with zipfile.ZipFile(output / 'wedding-dj-starter.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
        for file in (single, ROOT / 'README.md', ROOT / 'START_HERE.md', ROOT / 'LICENSE'):
            bundle.write(file, file.name)
    files = {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in (single, output / 'wedding-dj-starter.zip')}
    (output / 'manifest.json').write_text(json.dumps({'version': '0.2.0', 'files': files}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(files))

if __name__ == '__main__':
    build()
