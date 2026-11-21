"""管理画面の架空のAPI（Issue #46）。撮影（capture-admin-live.py）と手元配信（fake_admin_server.py）が共有する。

標準ライブラリだけ。ネットワークもbindも使わない純粋な応答関数で、メモリ上の架空のデータ（test/fixtures/admin-live-states.json）にだけ読み書きする。
本番のAPI・D1・予約・AIのproviderには一切つながらない。fixtureの値はすべて架空。

Issue #47: `fixture` に test/fixtures/admin-occasional-states.json（たまにする更新）も受ける（`variants` を持つ形）。その scenario は
`{variant, mode: api|api-fallback|local, fail?: save|delete}`。API接続失敗（api-fallback）は、管理画面が本番のAPIへ再送しない400で表す
（401・403・404・5xxを返すと adminFetch が本番のAPIへ切り替えて再送してしまうため）。#46 の fixture の scenario と応答は変えていない。

管理画面が呼ぶ経路（admin/app.js）:
  GET  /api/admin/site-data                     -> {data, meta}
  PUT  /api/admin/site-data                     -> {ok: true}
  GET  /api/admin/ticket-reservation-summary    -> {summaries: [{liveId, seats, records, pending}]}
  GET  /api/admin/ticket-reservations           -> {reservations: [...]}（liveId・status・limit）
  GET  /api/admin/ticket-reservations.csv       -> text/csv
  POST /api/admin/ticket-reservations           -> 手動の取り置きを追加（メモリ）
  POST /api/admin/ticket-reservations/{id}/status -> {ok: true, updated: 1}
  POST /api/admin/live-source-intake            -> {draft, provider}（架空の下書き）
  POST /api/admin/upload-image                  -> {url}（架空の画像）
管理画面の adminFetch は 401・403・404・5xx を受けると本番のAPIへ切り替えて再送する作りなので、`strict` のとき（手元配信）は
管理画面が呼ぶ経路にそれらを返さない（未対応の経路は400）。撮影では scenario が意図してそれらを返し、本番への再送は
context.route が遮断して記録する。
"""
import copy
import csv
import io
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, unquote, urlparse

sys.dont_write_bytecode = True  # verification/ に __pycache__ を作らない

ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = ROOT / 'test/fixtures/admin-live-states.json'
OCCASIONAL_FIXTURE_PATH = ROOT / 'test/fixtures/admin-occasional-states.json'  # Issue #47（--fixture で選ぶ）
API_ORIGIN = 'https://api.fixture.test'      # 撮影の架空のAPI host。実在しない
FAKE_TOKEN = 'fixture-admin-token-0000'      # 架空の合言葉。本物ではない
FAKE_IMAGE_HOST = 'img.example.test'         # fixtureの絶対URLの画像（架空）
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Token',
}
# 手元配信で使ってよいscenario（管理画面が呼ぶ経路に401・404・5xxを返さないもの）
STRICT_SAFE_SCENARIOS = ['base', 'legacy-only', 'no-reservations', 'many-reservations', 'empty-lists', 'local-mode',
                         'legacy-shapes', 'long-values', 'numeric-ids']  # 後ろの3つは #47 の fixture（失敗を返さない）


def load_fixture(path=None):
    return json.loads(Path(path or FIXTURE_PATH).read_text(encoding='utf-8'))


def scenario_spec(fixture, name):
    spec = fixture['scenarios'].get(name)
    if spec is None:
        raise KeyError(f'unknown scenario: {name}')
    return copy.deepcopy(spec)


def is_occasional(fixture):
    """Issue #47 の fixture（`variants` を持つ形）か。"""
    return 'variants' in fixture


def site_data_for(fixture, spec):
    """scenarioが名前で指す全体データ。`data` か、`sites` の live を差し替えたもの。#47 の fixture は `variants.<name>` が data のそのキーを置き換える。"""
    data = copy.deepcopy(fixture['data'])
    variant = spec.get('variant')
    if variant:
        data.update(copy.deepcopy(fixture['variants'][variant]))
    site = spec.get('site', 'data')
    if site != 'data':
        data['live'] = copy.deepcopy(fixture['sites'][site]['live'])
    return data


def many_rows(fixture):
    """二桁の予約（fixture.reservationsMany の定義どおり）。"""
    spec = fixture['reservationsMany']
    live = next((item for group in ('upcoming', 'past') for item in fixture['data']['live'][group] if item['id'] == spec['liveId']), {})
    rows = []
    for index in range(spec['count']):
        number = index + 1
        status = 'cancelled' if number % spec['cancelledEvery'] == 0 else ('pending' if number % spec['pendingEvery'] == 0 else 'handled')
        manual = index % 3 == 1
        rows.append({
            'id': f'fx-many-{number:02d}', 'liveId': spec['liveId'], 'liveDate': live.get('date', ''), 'liveVenue': live.get('venue', ''),
            'name': f'架空 {number:02d}', 'email': '' if manual else f'many{number:02d}@example.test', 'quantity': (index % 4) + 1,
            'message': '' if manual else '架空の備考', 'status': status, 'source': 'manual' if manual else 'web',
            'contact': f'090-0000-{number:04d}' if manual else '', 'internalNote': '架空の内部メモ' if manual else '',
            'createdAt': f'2026-11-{10 + index // 4:02d}T{9 + index % 4:02d}:00:00.000Z',
        })
    return rows


def reservations_for(fixture, kind):
    """liveId -> rows。'base' はfixtureの行、'many' は二桁の行を足したもの、'none' は空。"""
    if kind == 'none':
        return {}
    grouped = copy.deepcopy(fixture.get('reservations', {}))
    if kind == 'many':
        grouped[fixture['reservationsMany']['liveId']] = many_rows(fixture)
    return grouped


def summarize(rows):
    """Workerの summarizeTicketReservationRows と同じ規則: cancelled を除き、records・seats・pending を liveId 昇順で。"""
    totals = {}
    for row in rows:
        if row.get('status') == 'cancelled' or not row.get('liveId'):
            continue
        item = totals.setdefault(str(row['liveId']), {'liveId': str(row['liveId']), 'seats': 0, 'records': 0, 'pending': 0})
        item['records'] += 1
        quantity = row.get('quantity')
        item['seats'] += quantity if isinstance(quantity, (int, float)) and not isinstance(quantity, bool) else 0
        if row.get('status') == 'pending':
            item['pending'] += 1
    return [totals[key] for key in sorted(totals)]


def placeholder_image_svg(label='架空のフライヤー'):
    """架空のフライヤーの代わりの画像。画面の確認用で、実在の画像ではない。"""
    safe = re.sub(r'[<>&"]', '', str(label))[:40]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="440" height="620" viewBox="0 0 440 620">'
            f'<rect width="440" height="620" fill="#e6e6e6"/><rect x="20" y="20" width="400" height="580" fill="none" stroke="#999" stroke-width="4"/>'
            f'<text x="220" y="310" font-size="28" text-anchor="middle" fill="#555">{safe}</text></svg>').encode('utf-8')


def _json(status, payload, extra=None):
    headers = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', **CORS_HEADERS, **(extra or {})}
    return status, headers, json.dumps(payload, ensure_ascii=False).encode('utf-8')


class FakeAdminApi:
    """メモリ上の架空のAPI。handle() は (status, headers, body) を返す純粋な関数で、socketを使わない。"""

    def __init__(self, fixture=None, scenario='base', strict=False, extra_fail=(), summary_override=None, image_origin=''):
        self.fixture = fixture or load_fixture()
        self.occasional = is_occasional(self.fixture)
        self.scenario_name = scenario
        self.spec = scenario_spec(self.fixture, scenario)
        self.strict = strict
        if strict and scenario not in STRICT_SAFE_SCENARIOS:
            raise ValueError(f'scenario "{scenario}" returns 401/404/5xx; the hand-served build must not (choose one of {STRICT_SAFE_SCENARIOS})')
        self.fail = set(extra_fail)
        if self.spec.get('fail'):
            self.fail.add(self.spec['fail'])
        if strict and self.fail:
            raise ValueError('failure scenarios are for the capture only')
        self.summary_override = summary_override
        self.image_origin = image_origin.rstrip('/')
        self.site = self._with_image_origin(site_data_for(self.fixture, self.spec))
        self.reservations = reservations_for(self.fixture, self.spec.get('reservations', 'base'))
        self.requests = []
        self.next_id = 1
        self.uploads = 0

    # fixtureの絶対URLの画像は、手元配信では同じ配信元の架空の画像へ向ける（撮影では架空のhostを context.route が応える）
    def _with_image_origin(self, data):
        if not self.image_origin:
            return data
        prefix = f'https://{FAKE_IMAGE_HOST}/'
        text = json.dumps(data, ensure_ascii=False).replace(prefix, f'{self.image_origin}/fake-images/')
        return json.loads(text)

    @property
    def mode(self):
        return self.spec.get('mode', 'api')

    def all_rows(self):
        return [row for rows in self.reservations.values() for row in rows]

    def summary(self):
        if self.summary_override is not None:
            return copy.deepcopy(self.summary_override)
        setting = self.spec.get('summary', 'computed')
        if setting in ('empty', 'none'):
            return []
        return summarize(self.all_rows())

    def handle(self, method, target, headers=None, body=b''):
        parsed = urlparse(target)
        path = unquote(parsed.path)
        query = {key: values[0] for key, values in parse_qs(parsed.query).items()}
        self.requests.append((method, path))
        try:
            return self._route(method.upper(), path, query, body)
        except (ValueError, KeyError, TypeError) as error:
            # 壊れた入力は400（管理画面は400で本番へ切り替えない）
            return _json(400, {'error': f'fake api: {error}'})

    def _route(self, method, path, query, body):
        if method == 'OPTIONS':
            return 204, {**CORS_HEADERS, 'Access-Control-Max-Age': '600'}, b''
        if path == '/api/admin/site-data':
            if method == 'GET':
                if self.mode == 'api-fallback':
                    # #47 の撮影は本番のAPIへの再送の試みを0件にする（400は adminFetch が再送しない）。#46 の応答は変えない。
                    return _json(400 if self.occasional else 503, {'error': 'unavailable (scenario api-fallback)'})
                return _json(200, {'data': self.site, 'meta': {'updatedAt': self.fixture['meta']['updatedAt']}})
            if method == 'PUT':
                return self._put_site(body)
        if path == '/api/admin/ticket-reservation-summary' and method == 'GET':
            setting = self.spec.get('summary', 'computed')
            if isinstance(setting, dict):
                status = int(setting['status'])
                return _json(status, {'error': 'unauthorized' if status == 401 else 'fake summary error'})
            return _json(200, {'summaries': self.summary()})
        if path == '/api/admin/ticket-reservations' and method == 'GET':
            return self._list_reservations(query)
        if path == '/api/admin/ticket-reservations.csv' and method == 'GET':
            return self._csv(query)
        if path == '/api/admin/ticket-reservations' and method == 'POST':
            return self._add_manual(body)
        status_match = re.fullmatch(r'/api/admin/ticket-reservations/([^/]+)/status', path)
        if status_match and method == 'POST':
            return self._set_status(status_match.group(1), body)
        if path == '/api/admin/live-source-intake' and method == 'POST':
            return self._intake(body)
        if path == '/api/admin/upload-image' and method == 'POST':
            if 'upload' in self.fail:  # 画像のアップロードの失敗の画面のため（撮影が extra_fail で指す。400 は adminFetch が本番へ再送しない）
                return _json(400, {'error': 'テスト用のアップロードエラー'})
            self.uploads += 1
            return _json(200, {'url': f'{self.image_origin or API_ORIGIN}/fake-images/uploaded-{self.uploads}.jpg'})
        return _json(400, {'error': 'fake api: this route is not served'})

    # ---- site data -------------------------------------------------------------------------------------
    def _put_site(self, body):
        incoming = json.loads(body or b'{}')
        if 'save' in self.fail:
            return _json(400, {'error': 'テスト用の保存エラー'})
        live_ids = lambda data: {item['id'] for group in ('upcoming', 'past') for item in data.get('live', {}).get(group, [])}  # noqa: E731
        # #47: 削除は Live だけでなく News・作品・映像の項目の取り除きも数える（項目のidはcategoryを移しても保たれる）
        item_ids = lambda data: live_ids(data) | {str(item.get('id')) for key in ('news',) for item in data.get(key, [])} | {  # noqa: E731
            str(item.get('id')) for key in ('digital', 'demo') for item in data.get('discography', {}).get(key, [])} | {
            str(item.get('id')) for key in ('musicVideos', 'liveMovies', 'demos') for item in data.get('youtube', {}).get(key, [])}
        removed_ids = item_ids if self.occasional else live_ids
        if 'delete' in self.fail and removed_ids(self.site) - removed_ids(incoming):
            return _json(400, {'error': 'テスト用の削除エラー'})
        if not isinstance(incoming.get('live'), dict):
            return _json(400, {'error': 'live is missing'})
        self.site = incoming
        return _json(200, {'ok': True})

    # ---- reservations ----------------------------------------------------------------------------------
    def _filtered(self, query):
        rows = self.all_rows()
        if query.get('liveId'):
            rows = [row for row in rows if row['liveId'] == query['liveId']]
        if query.get('status'):
            rows = [row for row in rows if row['status'] == query['status']]
        limit = int(query.get('limit') or 200)
        return sorted(rows, key=lambda row: row['createdAt'], reverse=True)[:limit]

    def _list_reservations(self, query):
        if 'reservations-read' in self.fail:
            return _json(500, {'error': 'fake read error'})
        return _json(200, {'reservations': self._filtered(query)})

    def _csv(self, query):
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(['id', 'liveId', 'name', 'quantity', 'status', 'source', 'createdAt'])
        for row in self._filtered(query):
            writer.writerow([row['id'], row['liveId'], row['name'], row['quantity'], row['status'], row['source'], row['createdAt']])
        headers = {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ticket_reservations.csv"',
                   'Cache-Control': 'no-store', **CORS_HEADERS}
        return 200, headers, out.getvalue().encode('utf-8')

    def _add_manual(self, body):
        if 'manual' in self.fail:
            return _json(400, {'error': 'テスト用の取り置きエラー'})
        payload = json.loads(body or b'{}')
        name, quantity, live_id = str(payload.get('name', '')).strip(), payload.get('quantity'), str(payload.get('liveId', ''))
        if not name or not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= 10 or not live_id:
            return _json(400, {'error': 'invalid reservation'})
        live = next((item for group in ('upcoming', 'past') for item in self.site['live'][group] if item['id'] == live_id), {})
        row = {'id': f'fx-manual-{self.next_id}', 'liveId': live_id, 'liveDate': live.get('date', ''), 'liveVenue': live.get('venue', ''),
               'name': name, 'email': '', 'quantity': quantity, 'message': '', 'status': 'handled', 'source': 'manual',
               'contact': str(payload.get('contact', '')), 'internalNote': str(payload.get('internalNote', '')),
               'createdAt': '2026-11-20T03:00:00.000Z'}
        self.next_id += 1
        self.reservations.setdefault(live_id, []).append(row)
        return _json(201, {'ok': True, 'reservation': row})

    def _set_status(self, reservation_id, body):
        if 'status' in self.fail:
            return _json(400, {'error': 'テスト用の更新エラー'})
        status = json.loads(body or b'{}').get('status')
        if status not in ('pending', 'handled', 'cancelled'):
            return _json(400, {'error': 'invalid status'})
        updated = 0
        for row in self.all_rows():
            if row['id'] == unquote(reservation_id):
                row['status'] = status
                updated += 1
        return _json(200, {'ok': True, 'updated': updated})

    # ---- draft -----------------------------------------------------------------------------------------
    def _intake(self, body):
        if 'draft' in self.fail:
            return _json(502, {'error': 'AI source intake failed'})
        source = str(json.loads(body or b'{}').get('sourceText', ''))
        date = re.search(r'(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})', source)
        iso = f'{int(date.group(1)):04d}-{int(date.group(2)):02d}-{int(date.group(3)):02d}' if date else '2099-02-14'
        draft = {'date': iso, 'title': '架空の企画 vol.1', 'venue': 'テスト会場Z', 'openTime': '18:00', 'startTime': '18:30',
                 'ticket': '¥2,500 + 1D', 'notes': '再入場不可\n未就学児は入場不可', 'performers': '架空の出演者ア / 架空の出演者イ',
                 'ticketUrl': 'https://tickets.example.test/new', 'link': 'https://example.test/live/new'}
        return _json(200, {'draft': draft, 'provider': 'openai'})


def self_check():
    """bindもネットワークも使わない確認: 全scenarioが応え、規則どおりの集計が返り、手元配信が危険なstatusを返さない。"""
    fixture = load_fixture()
    assert list(fixture['scenarios']) == ['base', 'legacy-only', 'no-reservations', 'many-reservations', 'summary-404', 'summary-401',
                                            'summary-500', 'api-fallback', 'local-mode', 'save-fail', 'delete-fail', 'status-fail',
                                            'draft-fail', 'empty-lists']
    assert summarize([]) == []
    for name in fixture['scenarios']:
        api = FakeAdminApi(fixture, name)
        status, _, body = api.handle('GET', '/api/admin/site-data')
        assert status in (200, 503), (name, status)
        json.loads(body)
        status, _, _ = api.handle('GET', '/api/admin/ticket-reservation-summary')
        assert status == {'summary-404': 404, 'summary-401': 401, 'summary-500': 500}.get(name, 200), (name, status)
    base = FakeAdminApi(fixture, 'base')
    assert base.summary() == summarize(base.all_rows())
    many = FakeAdminApi(fixture, 'many-reservations')
    assert len(many.reservations[fixture['reservationsMany']['liveId']]) == fixture['reservationsMany']['count']
    assert FakeAdminApi(fixture, 'legacy-only').site['live']['upcoming'][0]['id'] == 'fx-live-legacy-up'
    assert FakeAdminApi(fixture, 'empty-lists').site['live']['past'] == []
    for name in fixture['scenarios']:
        try:
            api = FakeAdminApi(fixture, name, strict=True)
        except ValueError:
            assert name not in STRICT_SAFE_SCENARIOS, name
            continue
        for method, path, payload in [('GET', '/api/admin/site-data', b''), ('PUT', '/api/admin/site-data', json.dumps(api.site).encode()),
                                      ('GET', '/api/admin/ticket-reservation-summary', b''), ('GET', '/api/admin/ticket-reservations?limit=200', b''),
                                      ('GET', '/api/admin/ticket-reservations.csv', b''), ('POST', '/api/admin/live-source-intake', b'{"sourceText":"2099-03-04"}'),
                                      ('POST', '/api/admin/upload-image', b''), ('POST', '/api/admin/ticket-reservations/fx-res-1/status', b'{"status":"handled"}'),
                                      ('POST', '/api/admin/ticket-reservations', b'{"liveId":"fx-live-long","name":"x","quantity":2}'),
                                      ('GET', '/api/admin/unknown', b''), ('POST', '/api/admin/ticket-reservations', b'not json')]:
            status, _, _ = api.handle(method, path, body=payload)
            assert status not in (401, 403, 404) and status < 500, (name, path, status)
    text = FIXTURE_PATH.read_text(encoding='utf-8')
    assert not re.search(r'1212hp|workers\.dev|itsuki|matsumoto', text, re.I), 'fixtureに本番の値がある'
    occasional_count = self_check_occasional()
    print(f'fake_admin_api: OK（#46 の fixture {len(fixture["scenarios"])} scenario、#47 の fixture {occasional_count} scenario。bindなし・networkなし）')


def self_check_occasional():
    """Issue #47 の fixture（--fixture test/fixtures/admin-occasional-states.json）: 全scenarioが応え、API接続失敗は本番へ再送されない400、保存・削除の失敗は意図どおり。"""
    fixture = load_fixture(OCCASIONAL_FIXTURE_PATH)
    assert is_occasional(fixture) and not is_occasional(load_fixture())
    assert list(fixture['scenarios']) == ['base', 'empty-lists', 'legacy-shapes', 'long-values', 'api-fallback', 'local-mode', 'save-fail', 'delete-fail', 'numeric-ids']
    refetch = (401, 403, 404)  # adminFetch が本番のAPIへ切り替えて再送する status（500以上も）
    for name in fixture['scenarios']:
        api = FakeAdminApi(fixture, name)
        status, _, body = api.handle('GET', '/api/admin/site-data')
        assert status == (400 if name == 'api-fallback' else 200), (name, status)
        assert status not in refetch and status < 500, (name, status, 'adminFetch would retry against the production API')
        payload = json.loads(body)
        if name != 'api-fallback':
            assert set(payload['data']) == {'news', 'live', 'discography', 'profile', 'youtube', 'site', 'ticket', 'contact'}, name
        status, _, _ = api.handle('GET', '/api/admin/ticket-reservation-summary')
        assert status == 200, (name, status)
    assert FakeAdminApi(fixture, 'empty-lists').site['news'] == []
    assert [item['id'] for item in FakeAdminApi(fixture, 'numeric-ids').site['news']] == [101, '102', 103]
    assert len(FakeAdminApi(fixture, 'base').site['news']) == 6 and FakeAdminApi(fixture, 'base').mode == 'api'
    assert FakeAdminApi(fixture, 'local-mode').mode == 'local' and FakeAdminApi(fixture, 'api-fallback').mode == 'api-fallback'
    # 保存の失敗は 400（保存だけが失敗する）。削除の失敗は、項目が取り除かれた時だけ。
    failing = FakeAdminApi(fixture, 'save-fail')
    assert failing.handle('PUT', '/api/admin/site-data', body=json.dumps(failing.site).encode())[0] == 400
    deleting = FakeAdminApi(fixture, 'delete-fail')
    assert deleting.handle('PUT', '/api/admin/site-data', body=json.dumps(deleting.site).encode())[0] == 200, 'unchanged: saved'
    removed = copy.deepcopy(deleting.site)
    removed['news'] = removed['news'][1:]
    assert deleting.handle('PUT', '/api/admin/site-data', body=json.dumps(removed).encode())[0] == 400, 'a News item removed: the delete fails'
    removed = copy.deepcopy(deleting.site)
    removed['youtube']['musicVideos'] = removed['youtube']['musicVideos'][1:]
    assert deleting.handle('PUT', '/api/admin/site-data', body=json.dumps(removed).encode())[0] == 400, 'a video removed: the delete fails'
    # 手元配信で使ってよいのは失敗を返さないscenarioだけ。応答はどの経路も 401・403・404・5xx を返さない。
    for name in fixture['scenarios']:
        try:
            api = FakeAdminApi(fixture, name, strict=True)
        except ValueError:
            assert name not in STRICT_SAFE_SCENARIOS, name
            continue
        for method, path, payload in [('GET', '/api/admin/site-data', b''), ('PUT', '/api/admin/site-data', json.dumps(api.site).encode()),
                                      ('GET', '/api/admin/ticket-reservation-summary', b''), ('GET', '/api/admin/ticket-reservations?limit=200', b''),
                                      ('POST', '/api/admin/upload-image', b''), ('GET', '/api/admin/unknown', b'')]:
            status, _, _ = api.handle(method, path, body=payload)
            assert status not in refetch and status < 500, (name, path, status)
    assert {'base', 'empty-lists', 'local-mode', 'legacy-shapes', 'long-values', 'numeric-ids'} <= set(STRICT_SAFE_SCENARIOS)
    text = OCCASIONAL_FIXTURE_PATH.read_text(encoding='utf-8')
    assert not re.search(r'1212hp|workers\.dev|itsuki|matsumoto', text, re.I), 'fixtureに本番の値がある'
    # 架空のURLだけ（映像のURL入力の見本 youtu.be/fixture… の動画IDは架空。取得はしない）
    assert not re.search(r'https?://(?!(?:[\w.-]+\.)?example\.test|youtu\.be/fixture)', text), 'fixtureに架空でないURLがある'
    return len(fixture['scenarios'])


if __name__ == '__main__':
    self_check()
