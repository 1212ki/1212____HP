"""架空のAPIで動く管理画面の手元配信（Issue #46。Itsukiが自分で触る確認。merge前）。

execution target（worktreeのroot）で実行:
  /usr/bin/python3 test/support/admin-preview/fake_admin_server.py --port 8080
  /usr/bin/python3 test/support/admin-preview/fake_admin_server.py --port 8080 --fixture test/fixtures/admin-occasional-states.json   （#47: たまにする更新）
PCのブラウザで http://127.0.0.1:8080/admin/ を開く（開発者ツールの画面幅を390にするとスマホの形）。
スマホで触るなら、起動したまま別のterminalで tunnel（例: cloudflared tunnel --url http://127.0.0.1:8080）の公開URLをスマホで開く。
URLを知る人は架空のデータだけを見られる。個人情報も本番の値もない。

仕組み（計画 §7）:
- 標準ライブラリだけ。127.0.0.1だけにbindする。
- 管理画面に必要なファイル（admin/index.html・app.js・style.css、assets/css・assets/js）だけを配る。`.git`・admin/data・設定値・他のdirectoryは配らない。
- /admin/config.js は実ファイルを読まず、同じ配信元をAPIとする架空の設定と架空の合言葉で応える。入力の窓は出ない。**本物の合言葉を入力しない。**
- /api/admin/* は fake_admin_api.py が、メモリ上の架空のデータ（既定は test/fixtures/admin-live-states.json。--fixture で #47 の test/fixtures/admin-occasional-states.json）で応える。保存・削除・予約の状態の変更・取り置きはメモリに書くだけ。
  サーバーを止めると元に戻る。本番のD1・予約・公開データには何も書かない。
- 管理画面の adminFetch は 401・403・404・5xx を受けると本番のAPIへ切り替えて再送する作りなので、このserverは管理画面が呼ぶ経路にそれらを返さない
  （未対応の経路は400）。合言葉の入力・未入力・違う時、古いWorker（集計が404）、通信の失敗の表示は、撮影（capture-admin-live.py。本番へのrequestを遮断する）で確かめる。
- 書き換わるのはこのprocessのメモリだけ。後始末はサーバーを止める（Ctrl+C）こと。
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
from urllib.parse import unquote, urlparse

sys.dont_write_bytecode = True  # verification/ に __pycache__ を作らない
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fake_admin_api as api_module  # noqa: E402

ROOT = api_module.ROOT
STATIC_FILES = {'admin/index.html', 'admin/app.js', 'admin/style.css'}
STATIC_DIRECTORIES = ('assets/css/', 'assets/js/')
CONTENT_TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
                 '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml'}
LOOPBACK = {'127.0.0.1', 'localhost'}


def fake_config_js(origin):
    """管理画面の設定。実ファイル admin/config.js は読まない。同じ配信元をAPIとし、架空の合言葉を渡す。"""
    config = {'apiBaseUrl': origin, 'adminToken': api_module.FAKE_TOKEN}
    return f'window.ADMIN_CONFIG = {json.dumps(config)};\n'.encode('utf-8')


def resolve_static(url_path):
    """配ってよいファイルだけを返す。許可外は None（404。管理画面はこれらを呼ばない）。"""
    relative = unquote(url_path).lstrip('/')
    if relative in ('admin', 'admin/'):
        relative = 'admin/index.html'
    allowed = relative in STATIC_FILES or (relative.startswith(STATIC_DIRECTORIES) and relative.endswith(('.css', '.js')))
    if not allowed or '..' in Path(relative).parts:
        return None
    target = (ROOT / relative).resolve()
    if not target.is_relative_to(ROOT) or not target.is_file():
        return None
    return target


def build_handler(api, origin):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'FakeAdmin/1'
        lock = threading.Lock()

        def _send(self, status, headers, body):
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)

        def _read_body(self):
            length = int(self.headers.get('Content-Length') or 0)
            return self.rfile.read(min(length, 8 * 1024 * 1024)) if length else b''

        def _request_origin(self):
            # tunnel 経由（Host が 127.0.0.1・localhost でない）の時は、その公開URLを配信元とする。
            # 設定の API の向き先を 127.0.0.1 のままにすると、スマホからは届かず、管理画面が本番の API へ切り替えて再送してしまう。
            host = (self.headers.get('Host') or '').strip()
            name = host.rsplit(':', 1)[0] if host.count(':') == 1 else host
            if not host or name in LOOPBACK:
                return origin
            return f'https://{host}'

        def _handle(self):
            try:
                parsed = urlparse(self.path)
                path = unquote(parsed.path)
                request_origin = self._request_origin()
                if path.startswith('/api/'):
                    with Handler.lock:
                        status, headers, body = api.handle(self.command, self.path, dict(self.headers), self._read_body() if self.command in ('POST', 'PUT') else b'')
                    if request_origin != origin and isinstance(body, (bytes, bytearray)):
                        body = bytes(body).replace(origin.encode('utf-8'), request_origin.encode('utf-8'))
                    return self._send(status, headers, body)
                if self.command not in ('GET', 'HEAD'):
                    return self._send(405, {'Content-Type': 'text/plain; charset=utf-8'}, b'method not allowed')
                if path == '/admin/config.js':
                    return self._send(200, {'Content-Type': CONTENT_TYPES['.js']}, fake_config_js(request_origin))
                if path == '/admin/data/site-data.json':
                    with Handler.lock:
                        body = json.dumps(api.site, ensure_ascii=False).encode('utf-8')
                    if request_origin != origin:
                        body = body.replace(origin.encode('utf-8'), request_origin.encode('utf-8'))
                    return self._send(200, {'Content-Type': CONTENT_TYPES['.json']}, body)
                if path.startswith('/fake-images/') or (path.startswith('/assets/images/') and path.endswith(('.jpg', '.jpeg', '.png', '.webp'))):
                    return self._send(200, {'Content-Type': CONTENT_TYPES['.svg']}, api_module.placeholder_image_svg(Path(path).stem))
                if path == '/favicon.ico':
                    return self._send(204, {}, b'')
                target = resolve_static(path)
                if target is None:
                    return self._send(404, {'Content-Type': 'text/plain; charset=utf-8'}, b'not found')
                return self._send(200, {'Content-Type': CONTENT_TYPES.get(target.suffix, 'application/octet-stream')}, target.read_bytes())
            except Exception as error:  # noqa: BLE001 - 管理画面へは5xxを返さない（返すと本番のAPIへ切り替えて再送する）
                return self._send(400, {'Content-Type': 'application/json; charset=utf-8'}, json.dumps({'error': f'fake server: {error}'}).encode('utf-8'))

        do_GET = do_HEAD = do_POST = do_PUT = do_OPTIONS = do_DELETE = _handle

        def log_message(self, format_string, *args):
            sys.stderr.write(f'{self.command} {self.path.split("?")[0]} -> {args[1] if len(args) > 1 else ""}\n')

    return Handler


def resolve_fixture(fixture_path=None):
    """--fixture は repo の中の fixture だけ（任意の path を読まない）。"""
    if not fixture_path:
        return api_module.load_fixture()
    target = (Path(fixture_path) if Path(fixture_path).is_absolute() else ROOT / fixture_path).resolve()
    allowed = {api_module.FIXTURE_PATH.resolve(), api_module.OCCASIONAL_FIXTURE_PATH.resolve()}
    if target not in allowed:
        raise ValueError(f'--fixture は {sorted(str(path.relative_to(ROOT)) for path in allowed)} のどちらか')
    return api_module.load_fixture(target)


def build_server(host='127.0.0.1', port=8080, scenario='base', fixture_path=None):
    if host not in LOOPBACK:
        raise ValueError('bindは127.0.0.1だけ（tunnelは同じmachineの127.0.0.1へつなぐ）')
    origin = f'http://127.0.0.1:{port}'
    api = api_module.FakeAdminApi(resolve_fixture(fixture_path), scenario, strict=True, image_origin=origin)
    return ThreadingHTTPServer((host, port), build_handler(api, origin)), api


def self_check():
    """bindしない確認: 許可するファイルだけが解決でき、設定は実ファイルを読まず、strictなAPIが危険なstatusを返さない。"""
    for allowed in ['/admin/', '/admin/index.html', '/admin/app.js', '/admin/style.css', '/assets/css/1212-music.tokens.css',
                    '/assets/js/live-operations.js', '/assets/js/music-data.js']:
        assert resolve_static(allowed) is not None, allowed
    for denied in ['/admin/config.js', '/admin/data/site-data.json', '/.git/config', '/admin/README.md', '/cloudflare/worker/wrangler.toml',
                   '/data/site-data.json', '/admin/../.git/config', '/assets/css/../../.git/config', '/index.html']:
        assert resolve_static(denied) is None, denied
    config = fake_config_js('http://127.0.0.1:8080').decode('utf-8')
    assert api_module.FAKE_TOKEN in config and 'workers.dev' not in config and '1212hp' not in config
    live_fixture = api_module.load_fixture()
    for scenario in api_module.STRICT_SAFE_SCENARIOS:
        if scenario in live_fixture['scenarios']:  # 後ろの3つは #47 の fixture の scenario
            api_module.FakeAdminApi(live_fixture, scenario, strict=True, image_origin='http://127.0.0.1:8080')
    for scenario in ['summary-404', 'summary-401', 'summary-500', 'api-fallback', 'save-fail', 'delete-fail', 'status-fail', 'draft-fail']:
        try:
            api_module.FakeAdminApi(api_module.load_fixture(), scenario, strict=True)
        except ValueError:
            continue
        raise AssertionError(f'{scenario} must be refused by the hand-served build')
    try:
        build_server(host='0.0.0.0')
    except ValueError:
        pass
    else:
        raise AssertionError('non-loopback bind must be refused')
    api = api_module.FakeAdminApi(api_module.load_fixture(), 'base', strict=True, image_origin='http://127.0.0.1:8080')
    assert 'img.example.test' not in json.dumps(api.site), 'absolute fixture images are served from the same origin'
    # Issue #47: --fixture は repo の2つの fixture だけ。たまにする更新の fixture でも、手元配信は失敗を返す scenario を拒む。
    occasional = resolve_fixture('test/fixtures/admin-occasional-states.json')
    assert api_module.is_occasional(occasional) and not api_module.is_occasional(resolve_fixture())
    for scenario in api_module.STRICT_SAFE_SCENARIOS:
        if scenario in occasional['scenarios']:
            api_module.FakeAdminApi(occasional, scenario, strict=True, image_origin='http://127.0.0.1:8080')
    for scenario in ['api-fallback', 'save-fail', 'delete-fail']:
        try:
            api_module.FakeAdminApi(occasional, scenario, strict=True)
        except ValueError:
            continue
        raise AssertionError(f'{scenario} (occasional fixture) must be refused by the hand-served build')
    for bad in ['/etc/passwd', 'admin/config.js', '../outside.json', 'test/fixtures/home-states.json']:
        try:
            resolve_fixture(bad)
        except ValueError:
            continue
        raise AssertionError(f'--fixture {bad} must be refused')
    occasional_api = api_module.FakeAdminApi(occasional, 'base', strict=True, image_origin='http://127.0.0.1:8080')
    assert len(occasional_api.site['news']) == 6 and 'img.example.test' not in json.dumps(occasional_api.site)
    print('fake_admin_server: OK（bindなし）')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--host', default='127.0.0.1', help='127.0.0.1 のみ')
    parser.add_argument('--scenario', default='base', choices=api_module.STRICT_SAFE_SCENARIOS, help='架空のデータの種類（手元配信で使えるもの）')
    parser.add_argument('--fixture', help='架空のデータの fixture（repo の test/fixtures/admin-live-states.json［既定］か admin-occasional-states.json）')
    parser.add_argument('--self-check', action='store_true', help='bindせずに契約だけ検査する')
    args = parser.parse_args()
    if args.self_check:
        self_check()
        return
    try:
        server, _api = build_server(args.host, args.port, args.scenario, args.fixture)
    except (ValueError, KeyError) as error:
        parser.error(f'{error}')
    print(f'架空のAPIの管理画面: http://127.0.0.1:{args.port}/admin/  （scenario: {args.scenario}。メモリだけを書き換える。Ctrl+Cで止めると元に戻る）', flush=True)
    print('入力の窓は出ない。本物の合言葉を入力しない。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
