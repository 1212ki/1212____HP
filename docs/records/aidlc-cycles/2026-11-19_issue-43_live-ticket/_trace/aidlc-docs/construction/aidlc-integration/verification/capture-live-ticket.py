"""Live・Ticketの架空データを使うFront用撮影（Issue #43）。外部へ通信せず、本番の公開APIへPOSTしない。

execution targetで実行（インストール不要。Pythonは -I なし、既存のPlaywright）:
  /usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-live-ticket.py --serve

  --serve       127.0.0.1:8888 で公開HTML/assetsだけを配信（repo全体・admin・設定値は配信しない）
  --from-disk   サーバを立てず、同じ公開HTML/assetsをPlaywrightのrouteでディスクから返す（localhostへbindできない環境用）
  --check       ブラウザを起動せず、シナリオ・画像名・fixtureの整合だけを検査する
  --chromium    インストール済みChromiumの実行ファイルを指定（download/installはしない）
  --only TEXT   画像名にTEXTを含む撮影だけを流す（撮影の見直し用。契約の全件確認は引数なしで行う）

保存先: verification/screenshots/、capture-live-ticket-metrics.json、flow-log.json、capture-front.log。
撮影画像の全件目視、同じfontでの文字確認、本番の公開データ・実音・実機はFrontが別に行う。
"""
import argparse
import copy
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from datetime import datetime
from pathlib import Path
import re
import sys
import threading
import traceback
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SHOTS = OUT / 'screenshots'
FIXTURE_PATH = ROOT / 'test/fixtures/live-ticket-states.json'
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
BASE = 'http://127.0.0.1:8888'
UI_ROUTE = 'ui_route=headless_acceptance:PS-L-01,PS-L-02,PS-L-05,PS-COM-02,AC43-LISTEN,AC43-PROD'
FONT_URL = 'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&display=swap'
# 固定時刻: fixtureが使う基準（Playwright Pythonのclockは秒）。
CLOCK_SECONDS = int(datetime.fromisoformat(FIXTURE['meta']['fixtureNow']).timestamp())
WIDTHS = [1440, 390]
NARROW_WIDTH = 360
PLAYER_MIN_HEIGHT = 200
PUBLIC_PAGES = {'index.html', 'music/index.html', 'discography/index.html', 'youtube/index.html',
                'live/index.html', 'live/detail/index.html', 'ticket/index.html',
                'ticket/complete/index.html', 'profile/index.html', 'contact/index.html'}
STUB_IMAGE_HOSTS = {'fixture-images.example'}
RECEIPT_ADDRESS = '/ticket/complete/?liveId=fx-up-far&rid=fixture-missing-0001'
LONG = FIXTURE['scenarios']['long-text']['long']
LONG_TITLE = '架空の長い公演名 "Synthetic / Quotations" <>& ' + '折り返しの確認用タイトル' * 5
LONG_VENUE = '架空の非常に長い会場名の折り返し確認用ホール ' * 3
LONG_DETAIL = '共演: ' + ' / '.join(f'架空の出演者{i}（架空の注記）' for i in range(1, 9))
QUERY_FAR = '?liveId=fx-up-far'

# 画面ごとの撮影定義。route・使うfixture scenario・追加のset・状態・操作。
SCENARIOS = {}


def define(name, route, scenarios=(), sets=None, state='ready', kind='live-list', pending=False, http_status=200,
           post=None, steps=(), clock=True, extra_widths=()):
    SCENARIOS[name] = dict(route=route, scenarios=list(scenarios), sets=sets or {}, state=state, kind=kind,
                           pending=pending, http_status=http_status, post=post, steps=list(steps),
                           extra_widths=list(extra_widths))


# Live一覧
define('list-base', '/live/', ['multi-upcoming'])
define('list-empty-upcoming', '/live/', ['empty-upcoming'])
define('list-empty-past', '/live/', ['empty-past'])
define('list-error', '/live/', http_status=503, state='error')
define('list-loading', '/live/', pending=True, state='loading')
define('list-stale-upcoming', '/live/')  # base: 日付を過ぎたupcoming（予約受付終了）と近い順の確認
define('list-long', '/live/', ['multi-upcoming'], sets={'live.upcoming.1.title': LONG_TITLE, 'live.upcoming.1.venue': LONG_VENUE, 'live.upcoming.1.notes': LONG_DETAIL})
NO_IMAGE = {f'live.upcoming.{i}.image': '' for i in range(7)}
NO_IMAGE.update({f'live.past.{i}.image': '' for i in range(3)})
define('list-no-image', '/live/', ['multi-upcoming'], sets=NO_IMAGE)
# Live詳細
define('detail-base', '/live/detail/' + QUERY_FAR, ['multi-upcoming'], kind='live-detail', sets={'live.upcoming.0.notes': '※架空の注記\n※撮影は不可', 'live.upcoming.0.performers': 'w. 架空の出演者A / 架空の出演者B'})
define('detail-desc-only', '/live/detail/?liveId=fx-past-09', kind='live-detail')
define('detail-no-title', '/live/detail/?liveId=fx-up-stale', kind='live-detail')
define('detail-no-image', '/live/detail/?liveId=fx-up-social', ['multi-upcoming'], kind='live-detail')
define('detail-external', '/live/detail/?liveId=fx-up-ext', ['multi-upcoming'], kind='live-detail')
define('detail-closed', '/live/detail/?liveId=fx-up-closed', ['multi-upcoming'], kind='live-detail')
define('detail-invalid', '/live/detail/?liveId=fx-up-invalid', ['multi-upcoming'], kind='live-detail')
define('detail-notfound', '/live/detail/?liveId=fx-does-not-exist', kind='live-detail', state='empty')
define('detail-error', '/live/detail/' + QUERY_FAR, kind='live-detail', http_status=500, state='error')
define('detail-loading', '/live/detail/' + QUERY_FAR, kind='live-detail', pending=True, state='loading')
# 終了したライブ（全件）
define('archive-base', '/live/detail/?view=past', kind='live-archive')
define('archive-empty', '/live/detail/?view=past', ['empty-past'], kind='live-archive')
define('archive-error', '/live/detail/?view=past', kind='live-archive', http_status=500, state='error')
# Ticket
define('ticket-base', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='ticket')
define('ticket-draft', '/ticket/', ['multi-upcoming'], kind='ticket', steps=['draft'])
define('ticket-invalid', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='ticket', steps=['invalid'])
define('ticket-sending', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='ticket', post='pending', steps=['fill', 'submit', 'wait-sending'])
define('ticket-failed', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='ticket', post='failed', steps=['fill', 'submit', 'wait-notice'])
define('ticket-duplicate', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='ticket', post='duplicate', steps=['fill', 'submit', 'wait-notice'])
define('ticket-external', '/ticket/?liveId=fx-up-ext', ['multi-upcoming'], kind='ticket-notice')
define('ticket-unavailable', '/ticket/?liveId=fx-up-closed', ['multi-upcoming'], kind='ticket-notice')
define('ticket-empty', '/ticket/', ['empty-upcoming'], kind='ticket-notice')
define('ticket-load-error', '/ticket/', http_status=503, state='error', kind='ticket-notice')
define('ticket-unidentified', '/ticket/?liveId=', kind='ticket-notice')
define('ticket-fields-hidden', '/ticket/' + QUERY_FAR, ['multi-upcoming', 'fields-hidden'], kind='ticket')
# Ticket完了（Ticketの送信を通した直後。受付内容はsessionStorage経由）
define('complete-base', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='complete', post='created', steps=['fill', 'submit', 'to-complete'])
define('complete-reload', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='complete', post='created', steps=['fill', 'submit', 'to-complete', 'reload'])
define('complete-no-video', '/ticket/' + QUERY_FAR, ['multi-upcoming', 'no-video'], kind='complete', post='created', steps=['fill', 'submit', 'to-complete'])
define('complete-no-release', '/ticket/' + QUERY_FAR, ['multi-upcoming', 'no-release'], kind='complete', post='created', steps=['fill', 'submit', 'to-complete'])
define('complete-playing', '/ticket/' + QUERY_FAR, ['multi-upcoming'], kind='complete', post='created', steps=['fill', 'submit', 'to-complete', 'play'], extra_widths=[NARROW_WIDTH])
define('complete-missing', RECEIPT_ADDRESS, kind='complete-missing', state='missing')
define('complete-long', '/ticket/' + QUERY_FAR, ['multi-upcoming', 'long-text'], kind='complete', post='created', steps=['fill-long', 'submit', 'to-complete'])
SMOKE_ROUTES = [('/', 'home'), ('/music/', 'music'), ('/profile/', 'profile'), ('/contact/', 'contact'), ('/discography/', 'discography')]


def image_names():
    names = []
    for name, spec in SCENARIOS.items():
        for width in WIDTHS:
            names.append(f'{name}-{width}.png')
        for width in spec['extra_widths']:
            names.append(f'{name}-{width}.png')
    names += [f'smoke-{route}-{width}.png' for _, route in SMOKE_ROUTES for width in WIDTHS]
    return names


def set_path(target, dotted, value):
    keys = dotted.split('.')
    node = target
    for key in keys[:-1]:
        node = node[int(key)] if isinstance(node, list) else node[key]
    last = keys[-1]
    if isinstance(node, list):
        node[int(last)] = copy.deepcopy(value)
    else:
        node[last] = copy.deepcopy(value)


def append_path(target, dotted, items):
    node = target
    for key in dotted.split('.'):
        node = node[int(key)] if isinstance(node, list) else node[key]
    node.extend(copy.deepcopy(items))


def scenario_data(spec):
    data = copy.deepcopy(FIXTURE['data'])
    for scenario in spec['scenarios']:
        entry = FIXTURE['scenarios'][scenario]
        for path, value in entry.get('set', {}).items():
            set_path(data, path, value)
        for path, items in entry.get('append', {}).items():
            append_path(data, path, items)
    for path, value in spec['sets'].items():
        set_path(data, path, value)
    return data


def fixture_svg(label, width=420, height=593):
    safe = re.sub(r'[^A-Za-z0-9 ._-]', '', label)[:28]
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
            '<rect width="100%%" height="100%%" fill="#e8e8e8"/><rect x="12" y="12" width="%d" height="%d" fill="none" stroke="#999" stroke-width="2"/>'
            '<text x="50%%" y="50%%" text-anchor="middle" fill="#555" font-size="22" font-family="sans-serif">%s</text></svg>') % (
        width, height, width, height, width - 24, height - 24, safe)


def cached_fonts():
    """既存の同版cacheがあればURLとdigestを検証。取得・installはしない（manifestが無ければfallback）。"""
    candidates = [OUT / 'font-cache', ROOT / 'assets/fonts',
                  ROOT / 'docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/construction/aidlc-integration/verification/font-cache',
                  ROOT / 'docs/records/aidlc-cycles/2026-11-17_issue-42_home/_trace/aidlc-docs/construction/aidlc-integration/verification/font-cache']
    for directory in candidates:
        manifest = directory / 'manifest.json'
        if not manifest.is_file():
            continue
        metadata = json.loads(manifest.read_text())
        if metadata.get('css_url') != FONT_URL:
            continue
        files = {}
        for url, item in metadata.get('files', {}).items():
            path = (directory / item['path']).resolve()
            if not path.is_relative_to(directory.resolve()):
                raise ValueError('font cache path escaped directory')
            content = path.read_bytes()
            if hashlib.sha256(content).hexdigest() != item['sha256']:
                raise ValueError('font cache digest mismatch')
            files[url] = (content, 'text/css' if url == FONT_URL else 'font/woff2')
        if FONT_URL in files:
            return files, {'manifest': str(manifest.relative_to(ROOT)), 'sha256': hashlib.sha256(manifest.read_bytes()).hexdigest()}
    return {}, None


def public_target(path):
    """公開HTML/assetsだけを返す。repo全体・admin・設定値は配信しない。"""
    path = unquote(path).lstrip('/')
    if not path or path.endswith('/'):
        path += 'index.html'
    target = (ROOT / path).resolve()
    asset = path.startswith(('assets/css/', 'assets/js/', 'assets/images/'))
    if not target.is_relative_to(ROOT) or not target.is_file() or not (path in PUBLIC_PAGES or asset):
        return None
    return target


class PublicHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if public_target(urlparse(self.path).path) is None:
            self.send_error(404)
            return
        super().do_GET()

    def log_message(self, format_string, *args):
        pass


METRICS_JS = r"""() => {
  const box = e => { const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}; };
  const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const lines = e => {
    const tops=[]; const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      if(!walker.currentNode.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(walker.currentNode);
      for(const r of range.getClientRects())if(r.width>0&&!tops.some(t=>Math.abs(t-r.top)<.5))tops.push(r.top);
    }
    return tops.length;
  };
  const selectors=['main','.site-section-title','.live-back','.live-section','.live-card','.live-card-flyer','.live-card-flyer img','.live-flyer-fallback','.live-card-summary','.live-card-date','.live-card-venue','.live-card-title','.live-card-details','.live-card-actions','.live-past-row','.live-past-date','.live-past-venue','.live-past-title','.live-notice','.live-skeleton','.live-detail-main','[data-part="head"]','[data-part="actions"]','[data-part="flyer"]','[data-part="info"]','.live-detail-date','.live-detail-venue','.live-detail-title','.live-info-list li','.live-detail-description','.ticket-layout','.ticket-form','.ticket-field','.ticket-field--quantity','.ticket-field input','.ticket-field select','.ticket-field textarea','.ticket-error','.ticket-summary','.ticket-summary-figure','.ticket-actions .site-button','.ticket-complete-card','.ticket-complete-figure','.ticket-complete-number','.ticket-complete-live','.ticket-complete-fields','.ticket-complete-message','.ticket-next','.ticket-next a','.ticket-listen','.ticket-listen-jacket','.ticket-listen-title','.ticket-listen-meta','.ticket-listen .home-player','.ticket-listen iframe','.site-header','.site-footer','#global-nav a','main .site-button','main .site-chip','main .site-text-link'];
  const elements={};
  for(const selector of selectors)elements[selector]=[...document.querySelectorAll(selector)].map(e=>{
    const s=getComputedStyle(e);return {id:e.id,text:e.textContent.trim().slice(0,160),visible:!!visible(e),box:box(e),
      textLines:visible(e)?lines(e):0,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,letterSpacing:s.letterSpacing,
      color:s.color,background:s.backgroundColor,border:s.borderTopColor,borderWidth:s.borderTopWidth,borderRadius:s.borderTopLeftRadius,outline:s.outlineColor,
      opacity:s.opacity,position:s.position,top:s.top,order:s.order,padding:s.padding,gap:s.gap,gridTemplateColumns:s.gridTemplateColumns,
      ariaDisabled:e.getAttribute('aria-disabled'),disabled:e.disabled===true,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  });
  const red=[];
  const isPrimary=e=>e.classList.contains('site-button--primary');
  for(const e of document.querySelectorAll('main *'))if(visible(e)){
    for(const pseudo of [null,'::before','::after']){
      const s=getComputedStyle(e,pseudo);if(pseudo&&['none','normal'].includes(s.content))continue;
      for(const key of ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor']){
        if(s[key]!=='rgb(191, 85, 77)')continue;
        if(pseudo==='::after'&&e.classList.contains('site-section-title')&&key==='backgroundColor')continue;
        if(!pseudo&&isPrimary(e)&&key==='backgroundColor')continue;
        red.push({id:e.id,className:e.className,pseudo,key});
      }
    }
  }
  const main=document.querySelector('main');
  const dialogs=document.querySelectorAll('[role="dialog"],[aria-modal="true"],.ticket-modal,.ticket-modal-overlay').length;
  return {viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,scrollY,
    state:main?.dataset.state,busy:main?.getAttribute('aria-busy'),elements,red,dialogs,
    primaryVisible:[...document.querySelectorAll('main .site-button--primary')].filter(visible).length,
    iframeCount:document.querySelectorAll('iframe').length,activeId:document.activeElement?.id||document.activeElement?.tagName||'',
    font:getComputedStyle(document.body).fontFamily,zenFontLoaded:[...document.fonts].some(f=>f.family.includes('Zen Kaku')&&f.status==='loaded'),
    nav:[...document.querySelectorAll('#global-nav a')].map(a=>({label:a.textContent.trim(),current:a.getAttribute('aria-current')})),
    title:document.title,url:location.pathname+location.search,
    reserveLabels:[...document.querySelectorAll('[data-testid="live-reserve"]')].map(a=>({text:a.textContent.trim(),kind:a.dataset.kind,tag:a.tagName,href:a.getAttribute('href'),opacity:getComputedStyle(a).opacity})),
    texts:main?main.innerText:''};
}"""


def check_metrics(metrics, name, width, kind, expected_state):
    findings = []

    def require(condition, message):
        if not condition:
            findings.append(message)

    elements = metrics['elements']
    require(metrics['scrollWidth'] <= width + 2, '横overflow')
    require([n['label'] for n in metrics['nav']] == ['Home', 'Live', 'Music', 'Profile', 'Contact'], '5項目ナビ')
    require(sum(n['current'] == 'page' for n in metrics['nav']) == 1, '現在地が1件')
    require(metrics['state'] == expected_state, f"state={metrics['state']} 期待={expected_state}")
    if kind not in ('complete', 'complete-missing'):  # 完了のmainはaria-busyを持たない（取得を待たずに出す）
        require(metrics['busy'] == ('true' if expected_state == 'loading' else 'false'), 'aria-busy')
    require(not metrics['red'], '意図しない赤: ' + json.dumps(metrics['red'][:3], ensure_ascii=False))
    require(metrics['dialogs'] == 0, '確認の重ね表示（dialog/overlay）がある')
    if expected_state == 'loading':
        require('読み込み中' in metrics['texts'], '読み込み中の表示')
    content = min(980, width - 32)
    for e in elements['main']:
        require(abs(e['box']['width'] - content) <= 2, f'本文幅{content}')
    for e in elements['.live-past-title']:
        require(e['scrollWidth'] <= e['clientWidth'] + 2, '終了したライブのタイトルの横欠け')
    for e in elements['.live-notice']:
        require(e['background'] == 'rgb(245, 245, 245)', 'お知らせは淡い灰の面（赤にしない）')
    for e in elements['.ticket-error']:
        if e['visible']:
            require(e['color'] == 'rgb(26, 26, 26)', '入力誤りの文は黒')
    for item in metrics['reserveLabels']:
        if item['kind'] in ('closed', 'invalid'):
            require(abs(float(item['opacity']) - 0.4) <= 0.02 and item['href'] is None and item['text'] != '予約する', '押せない予約は不透明度.4で「予約する」を出さない')
    if kind == 'live-list' and expected_state == 'ready':
        for card in elements['.live-card']:
            if width == 1440:
                require(len(card['gridTemplateColumns'].split()) == 3, 'PCのカードは3列（フライヤー・文字・操作）')
            else:
                require(len(card['gridTemplateColumns'].split()) == 2, '390のカードは2列')
        for e in elements['.live-card-flyer']:
            size = (136, 192) if width == 1440 else (96, 136)
            require(abs(e['box']['width'] - size[0]) <= 2 and abs(e['box']['height'] - size[1]) <= 2, f'フライヤー{size[0]}x{size[1]}')
        for e in elements['.live-card-date']:
            require(e['fontSize'] == ('28px' if width == 1440 else '20px'), 'カードの日付の大きさ')
        rows = elements['.live-past-row']
        for e in rows:
            if width == 1440:
                require(abs(e['box']['width'] - 980) <= 2, '終了したライブの行幅980')
        for e in elements['.live-past-date']:
            if width == 1440:
                require(abs(e['box']['width'] - 160) <= 2, '日付の幅160')
        for e in elements['.live-past-venue']:
            if width == 1440:
                require(abs(e['box']['width'] - 240) <= 2, '会場の幅240')
        for e in elements['.live-card-title'] + elements['.live-card-details'] + elements['.live-card-venue']:
            require(e['scrollWidth'] <= e['clientWidth'] + 2, '長文の横欠け')
    if kind == 'live-detail' and expected_state == 'ready':
        head = elements['[data-part="head"]'][0]
        actions = elements['[data-part="actions"]'][0]
        flyer = elements['[data-part="flyer"]'][0]
        info = elements['[data-part="info"]']
        if width == 1440:
            require(abs(flyer['box']['width'] - 420) <= 2, 'フライヤー幅420')
            require(abs(head['box']['x'] - flyer['box']['right'] - 56) <= 2, '列の間隔56')
            require(abs(head['box']['width'] - 504) <= 2, '内容の幅504')
            require(abs(elements['.live-detail-main'][0]['box']['width'] - 980) <= 2, '枠の幅420+56+504=980')
            require(elements['.live-detail-date'][0]['fontSize'] == '40px', '日付40px')
        else:
            require(head['box']['bottom'] <= actions['box']['y'] + 1 and actions['box']['bottom'] <= flyer['box']['y'] + 1, '日付・会場・予約がフライヤーより上')
            require(abs(flyer['box']['width'] - 358) <= 2, 'フライヤー幅358')
            require(elements['.live-detail-date'][0]['fontSize'] == '28px', '日付28px')
        for e in info:
            require(e['box']['y'] >= flyer['box']['y'] - 1 or width == 390, '公演情報の位置')
    if kind == 'live-archive' and expected_state == 'ready' and name == 'archive-base':
        require(len(elements['.live-past-row']) == len(FIXTURE['data']['live']['past']), '全件の行数')
    if kind in ('ticket', 'ticket-notice') and expected_state == 'ready' and elements['.ticket-layout'] and elements['.ticket-layout'][0]['visible']:
        form = elements['.ticket-form'][0]
        summary = elements['.ticket-summary'][0]
        if summary['visible']:
            if width == 1440:
                require(abs(form['box']['width'] - 560) <= 2 and abs(summary['box']['width'] - 364) <= 2, 'フォーム560・概要364')
                require(abs(summary['box']['x'] - form['box']['right'] - 56) <= 2, '列の間隔56')
                require(abs(elements['.ticket-layout'][0]['box']['width'] - 980) <= 2, '枠の幅560+56+364=980')
                require(summary['position'] == 'sticky', '概要はsticky')
            else:
                require(summary['box']['bottom'] <= form['box']['y'] + 1, '概要が入力欄の上')
                require(abs(summary['box']['width'] - 358) <= 2, '概要の幅358')
        for e in elements['.ticket-actions .site-button']:
            if e['visible'] and width == 390:
                require(abs(e['box']['width'] - 358) <= 2, '送信ボタンが全幅358')
        for e in elements['.ticket-field--quantity']:
            if e['visible'] and width == 390:
                require(abs(e['box']['width'] - 120) <= 2, '枚数の欄は120幅')
        for e in elements['.ticket-field input'] + elements['.ticket-field select']:
            if e['visible']:
                require(abs(e['box']['height'] - 52) <= 2, '入力欄の高さ52')
                require(e['border'] in ('rgb(204, 204, 204)', 'rgb(26, 26, 26)'), '入力欄の線は灰（誤りは黒）')
    if kind == 'complete' and expected_state == 'ready':
        card = elements['.ticket-complete-card'][0]
        require(abs(card['box']['width'] - content) <= 2, f'受付内容の枠幅{content}')
        require(elements['.ticket-complete-message'][0]['fontSize'] == '28px', '完了の知らせ28px')
        for e in elements['.ticket-complete-number'] + elements['.ticket-complete-fields']:
            require(e['scrollWidth'] <= e['clientWidth'] + 2, '受付番号・内容の横欠け')
        if width == 390:
            require(all(abs(e['box']['y'] - elements['.ticket-next a'][0]['box']['y']) > 1 for e in elements['.ticket-next a'][1:]), '次に行く先は縦並び')
        for player in elements['.ticket-listen .home-player']:
            if player['visible']:
                if width == 1440:
                    require(abs(player['box']['width'] - 480) <= 2 and abs(player['box']['height'] - 270) <= 2, 'PCのプレーヤー480x270')
                elif width == 390:
                    require(abs(player['box']['width'] - 326) <= 2 and player['box']['height'] >= PLAYER_MIN_HEIGHT - 2, '390のプレーヤー326x200以上')
                else:
                    require(player['box']['height'] >= PLAYER_MIN_HEIGHT - 2, f'{width}pxのプレーヤー高さ200以上')
        require(metrics['iframeCount'] == (1 if name == 'complete-playing' else 0), 'iframe件数')
    return findings


def install_routes(context, spec, data, state, font_files):
    """GETのsite-dataとPOSTの予約はfixtureで返す。localhost以外は止めて記録する。"""
    log = {'blocked': [], 'stubbed': [], 'expected_failed': [], 'unexpected': [], 'posts': [], 'pending': []}

    def intercept(route):
        request = route.request
        parsed = urlparse(request.url)
        local = parsed.hostname in ('localhost', '127.0.0.1') and parsed.port == 8888
        if parsed.path == '/api/public/ticket-reservations' and request.method == 'POST':
            body = json.loads(request.post_data or '{}')
            log['posts'].append(body)
            kind = spec['post'] or 'failed'
            if kind == 'pending':
                log['pending'].append(route)
                return
            if kind == 'created':
                reply = copy.deepcopy(FIXTURE['post']['created'])
                reservation = reply['body']['reservation']
                reservation.update({'liveId': body.get('liveId', ''), 'liveDate': '2026-12-26', 'liveVenue': '架空ホールA',
                                    'name': body.get('name', ''), 'email': body.get('email', ''),
                                    'quantity': body.get('quantity', 1), 'message': body.get('message', '')})
                reply['body'].pop('echoRequest', None)
            else:
                reply = FIXTURE['post'][kind]
            if reply['status'] >= 400:  # 想定した失敗の応答。ブラウザのconsoleに出る「Failed to load resource」は想定内にする
                log['expected_failed'].append(request.url)
            route.fulfill(status=reply['status'], content_type='application/json', body=json.dumps(reply['body']),
                          headers={'Access-Control-Allow-Origin': '*'})
        elif request.method != 'GET':
            log['unexpected'].append(request.method + ' ' + request.url)
            route.abort()
        elif parsed.path == '/api/public/site-data' and not local:
            if spec['pending']:
                log['pending'].append(route)
                return
            if spec['http_status'] != 200:
                log['expected_failed'].append(request.url)
            route.fulfill(status=spec['http_status'], content_type='application/json',
                          body=json.dumps({'data': data, 'meta': FIXTURE['meta']}), headers={'Access-Control-Allow-Origin': '*'})
        elif request.url in font_files:
            content, content_type = font_files[request.url]
            route.fulfill(body=content, content_type=content_type)
        elif parsed.hostname in STUB_IMAGE_HOSTS:
            if 'missing' in parsed.path:
                log['expected_failed'].append(request.url)
                route.fulfill(status=404, body='')
            else:
                log['stubbed'].append(request.url)
                route.fulfill(content_type='image/svg+xml', body=fixture_svg(Path(parsed.path).stem))
        elif parsed.hostname in ('www.youtube.com', 'youtube.com') and parsed.path.startswith('/embed/'):
            log['stubbed'].append(request.url)
            route.fulfill(content_type='text/html', body='<html lang="ja"><head><meta charset="utf-8"></head><body style="margin:0;background:#f5f5f5;color:#666;display:grid;place-items:center;height:100vh;font:14px sans-serif">架空のプレーヤー</body></html>')
        elif parsed.hostname == 'img.youtube.com':
            log['stubbed'].append(request.url)
            route.fulfill(content_type='image/svg+xml', body=fixture_svg('video', 640, 360))
        elif local:
            if parsed.path == '/favicon.ico':
                route.fulfill(status=204, body='')
            elif parsed.path.startswith('/assets/images/fixture-'):
                log['stubbed'].append(request.url)
                route.fulfill(content_type='image/svg+xml', body=fixture_svg(Path(parsed.path).stem))
            elif FROM_DISK:
                target = public_target(parsed.path)
                if target is None:
                    route.fulfill(status=404, body='')
                else:
                    route.fulfill(body=target.read_bytes(), content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
            else:
                route.continue_()
        else:
            log['blocked'].append(request.url)
            route.abort()

    context.route('**/*', intercept)
    return log


FROM_DISK = False


def fill_form(page, long_text=False):
    name = LONG[:90] if long_text else '架空 太郎'
    message = (LONG + '\n' + LONG[:40]) if long_text else '取り置き名義は架空の名義です。'
    page.fill('#name', name)
    page.fill('#email', 'taro@example.test')
    if page.locator('#quantity').is_visible():
        page.fill('#quantity', '2')
    if page.locator('#message').is_visible():
        page.fill('#message', message)


def run_steps(page, spec, log, flow):
    for step in spec['steps']:
        if step == 'draft':
            continue  # 下書きはinit scriptで事前に置く
        elif step == 'invalid':
            page.fill('#name', '')
            page.fill('#email', 'example@')
            page.fill('#quantity', '0')
            page.click('#submitBtn')
            page.wait_for_selector('#ticket-error-name:not([hidden])')
        elif step in ('fill', 'fill-long'):
            fill_form(page, long_text=step == 'fill-long')
        elif step == 'submit':
            page.click('#submitBtn')
        elif step == 'wait-sending':
            page.wait_for_function('document.querySelector("#submitBtn").disabled && document.querySelector("#submitBtn").textContent.includes("送信しています")')
        elif step == 'wait-notice':
            page.wait_for_selector('#ticket-notice:not([hidden])')
        elif step == 'to-complete':
            page.wait_for_url('**/ticket/complete/**')
            page.wait_for_function('document.querySelector("#ticket-complete-content").dataset.state==="ready"')
            flow['urls'].append(urlparse(page.url).path)
        elif step == 'reload':
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('document.querySelector("#ticket-complete-content").dataset.state==="ready"')
        elif step == 'play':
            page.wait_for_selector('[data-ticket-action="play"]')
            page.click('[data-ticket-action="play"]')
            page.wait_for_selector('.ticket-listen iframe')


def settle_page(page, spec, expected_state):
    if spec['pending']:
        page.wait_for_function('(s)=>document.querySelector("main").dataset.state===s', arg='loading')
        return
    page.wait_for_function('(s)=>document.querySelector("main").dataset.state===s', arg=expected_state)
    page.wait_for_load_state('networkidle')


def run_capture(browser, results, font_files, name, spec, width, filename, only=None, flow=None):
    if only and only not in filename:
        return
    data = scenario_data(spec)
    height = 900 if width != 390 else 844
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  reduced_motion='reduce', service_workers='block')
    if 'draft' in spec['steps']:
        draft = {'liveId': 'fx-up-far', 'name': '架空 太郎', 'email': 'taro@example.test', 'quantity': '2', 'message': '下書きの備考'}
        context.add_init_script('try{localStorage.setItem("1212hp_ticket_draft_v1", %s)}catch(e){}' % json.dumps(json.dumps(draft)))
    page = context.new_page()
    pageerrors, console_errors, failed_scripts = [], [], []
    page.on('pageerror', lambda error: pageerrors.append(str(error)))
    page.on('console', lambda msg: console_errors.append({'text': msg.text, 'url': msg.location.get('url', '')}) if msg.type == 'error' else None)
    page.on('response', lambda response: failed_scripts.append({'url': response.url, 'status': response.status}) if response.request.resource_type == 'script' and response.status >= 400 else None)
    log = install_routes(context, spec, data, spec['state'], font_files)
    flow_local = {'urls': []}
    try:
        page.clock.install(time=CLOCK_SECONDS)  # Python Playwrightの数値単位は秒。
        page.goto(BASE + spec['route'], wait_until='domcontentloaded')
        flow_local['urls'].append(urlparse(page.url).path)
        expected_state = 'ready' if spec['kind'] == 'complete' else spec['state']
        if spec['kind'] == 'complete':
            settle_page(page, dict(spec, pending=False), 'ready')  # まずTicketがreadyになるのを待つ
        elif spec['kind'] == 'complete-missing':
            page.wait_for_function('document.querySelector("#ticket-complete-content")')
            page.wait_for_load_state('networkidle')
        else:
            settle_page(page, spec, spec['state'])
        run_steps(page, spec, log, flow_local)
        if spec['kind'] == 'complete':
            page.wait_for_load_state('networkidle')
            if 'no-release' not in spec['scenarios']:
                page.wait_for_selector('#ticket-listen:not([hidden])')
        page.evaluate('document.fonts.ready')
        page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        page.evaluate('window.scrollTo(0,0)')
        metrics = page.evaluate(METRICS_JS)
        final_state = 'missing' if spec['kind'] == 'complete-missing' else expected_state
        findings = check_metrics(metrics, name, width, spec['kind'], final_state)
        if name == 'ticket-sending':
            findings += [] if metrics['elements']['.ticket-actions .site-button'][0]['disabled'] else ['送信中でボタンが押せる']
        if name == 'ticket-invalid':
            findings += [] if sum(1 for e in metrics['elements']['.ticket-error'] if e['visible']) >= 3 else ['入力誤り3件が出ない']
        if name == 'list-base' or name == 'list-stale-upcoming':
            labels = [item['text'] for item in metrics['reserveLabels']]
            findings += [] if '予約受付終了' in labels else ['日付を過ぎたupcomingが「予約受付終了」にならない']
        if name == 'complete-base' and width == 1440:
            findings += [] if metrics['elements']['.ticket-listen'] and metrics['elements']['.ticket-listen'][0]['visible'] else ['当日までに聴くが出ない']
        if name == 'ticket-base' and width == 1440:
            page.set_viewport_size({'width': 1440, 'height': 420})
            page.evaluate('window.scrollTo(0,160)')
            top = page.evaluate('document.querySelector(".ticket-summary").getBoundingClientRect().top')
            metrics['stickyTopAfterScroll'] = top
            findings += [] if 0 < top <= 120 else [f'概要が入力中に画面内に残らない top={top}']
            page.set_viewport_size({'width': 1440, 'height': height})
            page.evaluate('window.scrollTo(0,0)')
        if name.startswith('ticket') and spec['kind'] == 'ticket' and not spec['steps']:
            try:
                target = page.locator('main .site-button, main .site-text-link, main a, main input').first
                target.hover(timeout=2000)
                target.focus(timeout=2000)
                active = page.evaluate(METRICS_JS)['red']
                metrics['interactionRed'] = active
                findings += [] if not active else ['hover/focusで本文に赤']
                target.evaluate('(e)=>e.blur()')
            except Exception as error:  # 操作できなければ指摘にして続ける
                findings.append('hover/focusの確認ができない: ' + str(error)[:80])
        page.screenshot(path=str(SHOTS / filename), full_page=True)
        if spec['kind'] == 'complete' and name == 'complete-playing' and width == WIDTHS[0]:  # 余分の幅は1440の回だけで1回撮る（幅ごとに撮ると同名が2回入る）
            for narrow in spec['extra_widths']:
                page.set_viewport_size({'width': narrow, 'height': 844})
                page.wait_for_timeout(50)
                narrow_metrics = page.evaluate(METRICS_JS)
                players = [e for e in narrow_metrics['elements']['.ticket-listen .home-player'] if e['visible']]
                metrics.setdefault('narrow', {})[str(narrow)] = [e['box'] for e in players]
                findings += [] if players and all(e['box']['height'] >= PLAYER_MIN_HEIGHT - 2 for e in players) else [f'{narrow}pxでプレーヤー高さ200未満']
                page.screenshot(path=str(SHOTS / f'{name}-{narrow}.png'), full_page=True)
                results['captures'].append({'image': f'screenshots/{name}-{narrow}.png', 'scenario': name, 'width': narrow, 'metrics': narrow_metrics, 'findings': []})
        errors = [entry for entry in console_errors if entry['url'] not in log['blocked'] + log['expected_failed']]
        if log['unexpected']:
            findings.append('想定外のrequest: ' + ', '.join(log['unexpected']))
        row = {'image': 'screenshots/' + filename, 'scenario': name, 'route': spec['route'], 'width': width, 'landed_url': page.url,
               'metrics': metrics, 'findings': findings, 'blocked_external_requests': log['blocked'],
               'stubbed_requests': log['stubbed'], 'expected_failed_requests': log['expected_failed'],
               'posts_to_fixture': log['posts'], 'console_errors': console_errors, 'unexpected_console_errors': errors,
               'pageerrors': pageerrors, 'failed_scripts': failed_scripts, 'unexpected_requests': log['unexpected']}
        results['captures'].append(row)
        if flow is not None and name == 'complete-base' and width == 1440:
            flow['urls'] = flow_local['urls']
        problems = findings + [e['text'] for e in errors] + pageerrors + [str(f) for f in failed_scripts]
        if problems:
            results['findings'].append({'image': filename, 'problems': problems})
        (OUT / 'capture-live-ticket-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(filename + ('  FINDINGS: ' + '; '.join(problems) if problems else ''), flush=True)
    finally:
        for pending in log['pending']:
            try:
                pending.abort()
            except Exception:
                pass
        context.unroute_all(behavior='wait')
        context.close()


def run_flow(browser, results, font_files):
    """一覧のクリック → Ticketの送信 → 完了。通る画面が3つであることを記録する。"""
    spec = dict(SCENARIOS['complete-base'])
    data = scenario_data(spec)
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    log = install_routes(context, spec, data, 'ready', font_files)
    steps = []
    try:
        page.clock.install(time=CLOCK_SECONDS)
        page.goto(BASE + '/live/', wait_until='domcontentloaded')
        page.wait_for_function('document.querySelector("#live-content").dataset.state==="ready"')
        steps.append({'screen': 'list', 'url': urlparse(page.url).path + urlparse(page.url).query})
        page.locator('[data-testid="live-card"][data-live-id="fx-up-far"] [data-testid="live-reserve"]').click()
        page.wait_for_url('**/ticket/**')
        page.wait_for_function('document.querySelector("#ticket-content").dataset.state==="ready"')
        steps.append({'screen': 'ticket', 'url': urlparse(page.url).path + '?' + urlparse(page.url).query})
        selected = page.evaluate('document.querySelector("#liveId").value')
        fill_form(page)
        page.click('#submitBtn')
        page.wait_for_url('**/ticket/complete/**')
        page.wait_for_function('document.querySelector("#ticket-complete-content").dataset.state==="ready"')
        steps.append({'screen': 'complete', 'url': urlparse(page.url).path + '?' + urlparse(page.url).query})
        query = parse_qs(urlparse(page.url).query)
        personal = [value for value in ['taro@example.test', '架空 太郎', '取り置き名義'] if value in page.url or value in unquote(page.url)]
        screens = [step['screen'] for step in steps]
        flow = {'ui_route': UI_ROUTE, 'steps': steps, 'screens': screens, 'distinct_screens': len(set(screens)),
                'selected_live_on_ticket': selected, 'complete_query_keys': sorted(query.keys()),
                'personal_data_in_url': personal, 'dialogs': page.evaluate('document.querySelectorAll("[role=dialog],[aria-modal=true]").length'),
                'posts_to_fixture': log['posts'], 'blocked_external_requests': log['blocked']}
        flow['ok'] = (screens == ['list', 'ticket', 'complete'] and selected == 'fx-up-far' and flow['complete_query_keys'] == ['liveId', 'rid']
                      and not personal and flow['dialogs'] == 0)
        (OUT / 'flow-log.json').write_text(json.dumps(flow, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('flow-log.json', 'ok' if flow['ok'] else 'FINDINGS', flush=True)
        if not flow['ok']:
            results['findings'].append({'image': 'flow-log.json', 'problems': ['流れの確認が契約と一致しない']})
    finally:
        context.unroute_all(behavior='wait')
        context.close()


def run_smoke(browser, results, font_files, route, label, width, only=None):
    filename = f'smoke-{label}-{width}.png'
    if only and only not in filename:
        return
    spec = dict(SCENARIOS['list-base'], route=route, scenarios=[], sets={}, state='ready', pending=False, http_status=200, post=None, steps=[])
    data = scenario_data(spec)
    context = browser.new_context(viewport={'width': width, 'height': 900 if width != 390 else 844}, device_scale_factor=1, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    pageerrors, console_errors = [], []
    page.on('pageerror', lambda error: pageerrors.append(str(error)))
    page.on('console', lambda msg: console_errors.append({'text': msg.text, 'url': msg.location.get('url', '')}) if msg.type == 'error' else None)
    log = install_routes(context, spec, data, 'ready', font_files)
    try:
        page.clock.install(time=CLOCK_SECONDS)
        page.goto(BASE + route, wait_until='domcontentloaded')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(300)
        page.evaluate('document.fonts.ready')
        nav = page.evaluate('[...document.querySelectorAll("#global-nav a")].map(a=>a.textContent.trim())')
        findings = []
        if nav != ['Home', 'Live', 'Music', 'Profile', 'Contact']:
            findings.append('5項目ナビでない')
        if page.evaluate('document.documentElement.scrollWidth') > width + 2:
            findings.append('横overflow')
        if not page.evaluate('(document.querySelector("main")?.innerText||"").trim().length>0'):
            findings.append('本文が空')
        errors = [entry for entry in console_errors if entry['url'] not in log['blocked'] + log['expected_failed']]
        page.screenshot(path=str(SHOTS / filename), full_page=True)
        results['captures'].append({'image': 'screenshots/' + filename, 'scenario': 'smoke-' + label, 'route': route, 'width': width,
                                    'landed_url': page.url, 'findings': findings, 'pageerrors': pageerrors, 'console_errors': console_errors,
                                    'unexpected_console_errors': errors, 'blocked_external_requests': log['blocked']})
        problems = findings + [e['text'] for e in errors] + pageerrors
        if problems:
            results['findings'].append({'image': filename, 'problems': problems})
        print(filename + ('  FINDINGS: ' + '; '.join(problems) if problems else ''), flush=True)
    finally:
        context.unroute_all(behavior='wait')
        context.close()


def check_only():
    """ブラウザを起動せず、シナリオと画像名と使うid・fixtureの整合を検査する。"""
    names = image_names()
    problems = []
    if len(names) != len(set(names)):
        problems.append('画像名が重複している')
    live_ids = {l['id'] for l in FIXTURE['data']['live']['upcoming'] + FIXTURE['data']['live']['past']}
    for scenario in FIXTURE['scenarios'].values():
        for items in scenario.get('append', {}).values():
            live_ids |= {i.get('id') for i in items if isinstance(i, dict)}
    for name, spec in SCENARIOS.items():
        for scenario in spec['scenarios']:
            if scenario not in FIXTURE['scenarios']:
                problems.append(f'{name}: fixtureに{scenario}がない')
        data = scenario_data(spec)  # set/appendの経路が正しいことの検査
        for match in re.finditer(r'liveId=([^&]*)', spec['route']):
            lid = unquote(match.group(1))
            if lid and lid not in live_ids and name not in ('detail-notfound', 'complete-missing'):
                problems.append(f'{name}: 未知のliveId {lid}')
        if spec['kind'] == 'complete' and spec['post'] != 'created':
            problems.append(f'{name}: 完了の撮影はPOSTを作成にする')
        if not isinstance(data['live'], dict) and 'invalid-live' not in spec['scenarios']:
            problems.append(f'{name}: liveが壊れた')
    for key in ('created', 'duplicate', 'failed'):
        if key not in FIXTURE['post']:
            problems.append(f'fixtureのpostに{key}がない')
    print(f'画像 {len(names)} 件 + flow-log.json。シナリオ {len(SCENARIOS)} 件、smoke {len(SMOKE_ROUTES)} 件。')
    print(f'fixture: {FIXTURE_PATH.relative_to(ROOT)} sha256 {hashlib.sha256(FIXTURE_PATH.read_bytes()).hexdigest()}')
    print(f'clock: {FIXTURE["meta"]["fixtureNow"]} = {CLOCK_SECONDS} 秒')
    for problem in problems:
        print('問題:', problem)
    return not problems


def capture_all(args):
    global FROM_DISK
    FROM_DISK = args.from_disk
    from playwright.sync_api import sync_playwright
    SHOTS.mkdir(exist_ok=True)
    font_files, font_manifest = cached_fonts()
    results = {'ui_route': UI_ROUTE, 'fixture': 'test/fixtures/live-ticket-states.json',
               'fixture_sha256': hashlib.sha256(FIXTURE_PATH.read_bytes()).hexdigest(),
               'expected_images': image_names(), 'captures': [], 'findings': [], 'font_cache': font_manifest,
               'serving': 'route(from disk)' if args.from_disk else 'ThreadingHTTPServer 127.0.0.1:8888',
               'font_acceptance': '同版cacheがない場合はfallback。文字・折返しの最終受入は未確認。',
               'visual_review': '未実施。Frontが全画像をFigma v2・#42・#44の部品と照合する。Live・Ticketのrender PNGとのpixel比較はない。',
               'real_audio': '未実施', 'production_data': '未実施（本番の公開データでの画面確認はFrontが別に行う）', 'status': 'running'}
    server = None
    try:
        if args.serve and not args.from_disk:
            server = ThreadingHTTPServer(('127.0.0.1', 8888), PublicHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
        with sync_playwright() as p:
            launch = {'headless': True}
            if args.chromium:
                launch['executable_path'] = args.chromium
            browser = p.chromium.launch(**launch)
            results['browser'] = browser.version
            flow = {'urls': []}
            for name, spec in SCENARIOS.items():
                for width in WIDTHS:
                    run_capture(browser, results, font_files, name, spec, width, f'{name}-{width}.png', only=args.only, flow=flow)
            if not args.only:
                run_flow(browser, results, font_files)
            for route, label in SMOKE_ROUTES:
                for width in WIDTHS:
                    run_smoke(browser, results, font_files, route, label, width, only=args.only)
            browser.close()
        actual = sorted(Path(row['image']).name for row in results['captures'])
        if not args.only:
            assert actual == sorted(image_names()), '撮影名/件数が契約と不一致'
        results['status'] = ('captured; findings=%d; visual/font acceptance pending' % len(results['findings']))
        print(f'{len(actual)}画像。自動metricsの指摘 {len(results["findings"])} 件。全画像目視・font・本番データ・実音は別の受入。', flush=True)
    except Exception as error:
        results['status'] = 'visual_acceptance_pending'
        results['failure'] = str(error)
        traceback.print_exc()
        raise
    finally:
        (OUT / 'capture-live-ticket-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if server:
            server.shutdown()
            server.server_close()
    return not results['findings']


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--from-disk', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--chromium', help='既存Chromiumの実行ファイル（download/installしない）')
    parser.add_argument('--only', help='画像名に含まれる文字列で撮影を絞る')
    args = parser.parse_args()
    if args.check:
        sys.exit(0 if check_only() else 1)
    if not (args.serve or args.from_disk):
        parser.error('--serve か --from-disk のどちらかが必要です')
    log = (OUT / 'capture-front.log').open('w', buffering=1)

    class Tee:
        def __init__(self, stream):
            self.stream = stream

        def write(self, text):
            self.stream.write(text)
            log.write(text)

        def flush(self):
            self.stream.flush()
            log.flush()

    stdout, stderr = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = Tee(stdout), Tee(stderr)
    ok = False
    try:
        print(UI_ROUTE, flush=True)
        ok = capture_all(args)
    finally:
        sys.stdout, sys.stderr = stdout, stderr
        log.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
