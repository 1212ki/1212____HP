"""Musicの架空データを使うFront用撮影。外部へ通信せず、実音は確認しない。

execution targetで実行:
  /usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-music.py --serve
--chromium はインストール済みの実行ファイルだけを指定する。
撮影画像の全件目視、同じfontでの文字確認、本番データ・実音はFrontが別に行う。
"""
import argparse
import copy
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import traceback
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SHOTS = OUT / 'screenshots'
FIXTURE_PATH = ROOT / 'test/fixtures/music-states.json'
FIXTURE = json.loads(FIXTURE_PATH.read_text())
BASE = 'http://127.0.0.1:8888'
UI_ROUTE = 'ui_route=headless_acceptance:PS-M-04,PS-COM-01,PS-COM-02,AC44-COMPAT'
FONT_URL = 'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&display=swap'
PUBLIC_PAGES = {'index.html', 'music/index.html', 'discography/index.html', 'youtube/index.html',
                'live/index.html', 'live/detail/index.html', 'ticket/index.html',
                'ticket/complete/index.html', 'profile/index.html', 'contact/index.html'}
SMOKE_ROUTES = [('/', 'home'), ('/live/', 'live'),
                ('/live/detail/?liveId=live-a', 'live-detail'),
                ('/ticket/?liveId=live-a', 'ticket'),
                ('/ticket/complete/?rid=synthetic&date=2099.12.12&venue=Synthetic', 'ticket-complete'),
                ('/profile/', 'profile'), ('/contact/', 'contact')]
VARIANTS = [name for name in FIXTURE['scenarios'] if name != 'base']
# Owner決定（2026-11-18）: YouTubeの埋め込みは高さ200px以上、16:9は480x270以上が推奨。
PLAYER_MIN_HEIGHT = 200
NARROW_WIDTH = 360
NARROW_IMAGE = f'music-video-playing-{NARROW_WIDTH}.png'


def scenario_data(name):
    data = copy.deepcopy(FIXTURE['data'])
    variant = FIXTURE['scenarios'].get(name, {})
    if variant.get('noSelection'):
        for items in data['discography'].values():
            for item in items:
                item['playbackVideoId'] = ''
    if variant.get('emptyDemo'):
        data['discography']['demo'] = []
    if variant.get('emptyLiveMovie'):
        data['youtube']['liveMovies'] = []
    if variant.get('emptyVideo') or variant.get('allEmpty'):
        for key in ['musicVideos', 'liveMovies', 'demos']:
            data['youtube'][key] = []
    if variant.get('allEmpty'):
        data['discography'] = {'digital': [], 'demo': []}
    if 'image' in variant:
        data['discography']['digital'][0]['image'] = variant['image']
    if variant.get('longTitle'):
        for items in data['discography'].values():
            for item in items:
                item['title'] = '架空の長い作品 "Synthetic / Quotations" <>& ' + '折り返しの確認用タイトル' * 4
    return data, variant


def expected_images():
    names = [f'music-{w}-{kind}.png' for w in [1440, 390] for kind in ['first', 'full']]
    names += [f'music-{name}-{w}.png' for name in VARIANTS for w in [1440, 390]]
    names += [NARROW_IMAGE]
    names += ['menu-music-390-open.png', 'menu-music-390-closed.png', 'menu-home-390-open.png',
              'music-821.png', 'music-1024.png']
    names += [f'legacy-{route}{suffix}-{w}.png' for route in ['discography', 'youtube']
              for suffix in ['', '-nojs'] for w in [1440, 390]]
    names += [f'smoke-{name}-{w}.png' for _, name in SMOKE_ROUTES for w in [1440, 390]]
    return names


def cached_fonts():
    """既存の同版cacheがあればURLとdigestを検証。取得・installはしない。

    任意cacheのmanifest: css_url=FONT_URL, files={URL:{path:相対path,sha256:digest}}。
    manifestを持たないfontは同版と推測せずfallbackとして扱う。
    """
    candidates = [OUT / 'font-cache', ROOT / 'assets/fonts',
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


class PublicHandler(SimpleHTTPRequestHandler):
    """localhostの公開HTML/assetsのみ。repo全体やadmin/設定値は配信しない。"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = unquote(urlparse(self.path).path).lstrip('/')
        if not path or path.endswith('/'):
            path += 'index.html'
        target = (ROOT / path).resolve()
        asset = path.startswith(('assets/css/', 'assets/js/', 'assets/images/'))
        if not target.is_relative_to(ROOT) or not target.is_file() or not (path in PUBLIC_PAGES or asset):
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
  const selectors=['#music-content','.music-heading','.music-section','.music-release-list','.music-release-card',
    '.music-release-image','.music-release-image img','.music-artwork-fallback','.music-release-text','.music-release-title','.music-release-meta',
    '.music-release-description','.music-actions','.music-player','.music-video-group','.music-video-card',
    '.music-video-thumbnail','.music-video-thumbnail img','.music-video-stage','.music-player iframe','.music-video-title','.music-video-list','.music-jumps','.site-section-title','.music-error',
    '.music-skeleton','.music-links','.site-header','.site-footer','#global-nav','#global-nav a',
    '#music-content .site-button','#music-content .site-chip','#music-content .site-text-link'];
  const elements={};
  for(const selector of selectors)elements[selector]=[...document.querySelectorAll(selector)].map(e=>{
    const s=getComputedStyle(e);return {id:e.id,text:e.textContent.trim(),visible:!!visible(e),box:box(e),
      textLines:visible(e)?lines(e):0,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,
      letterSpacing:s.letterSpacing,color:s.color,background:s.backgroundColor,border:s.borderColor,outline:s.outlineColor,
      padding:s.padding,margin:s.margin,gap:s.gap,flexDirection:s.flexDirection,gridTemplateColumns:s.gridTemplateColumns,
      scrollMarginTop:s.scrollMarginTop,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  });
  const red=[];
  for(const e of document.querySelectorAll('#music-content *'))if(visible(e)){
    for(const pseudo of [null,'::before','::after']){
      const s=getComputedStyle(e,pseudo);if(pseudo&&['none','normal'].includes(s.content))continue;
      for(const key of ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor']){
        if(s[key]==='rgb(191, 85, 77)'&&!(pseudo==='::after'&&e.classList.contains('site-section-title')&&key==='backgroundColor'))red.push({id:e.id,className:e.className,pseudo,key});
      }
    }
  }
  const releaseLinks=[...document.querySelectorAll('.music-release-card a[target="_blank"]')].map(a=>({text:a.textContent.trim(),label:a.getAttribute('aria-label')||'',title:a.closest('.music-release-card').querySelector('.music-release-title').textContent.trim()}));
  return {viewport:{width:innerWidth,height:innerHeight},releaseLinks,scrollWidth:document.documentElement.scrollWidth,scrollY,
    state:document.querySelector('#music-content')?.dataset.state,busy:document.querySelector('#music-content')?.getAttribute('aria-busy'),elements,
    red,iframeCount:document.querySelectorAll('iframe').length,releaseCount:document.querySelectorAll('[data-music-release]').length,
    videoCount:document.querySelectorAll('[data-music-video]').length,
    font:getComputedStyle(document.body).fontFamily,zenFontLoaded:[...document.fonts].some(f=>f.family.includes('Zen Kaku')&&f.status==='loaded'),
    nav:[...document.querySelectorAll('#global-nav a')].map(a=>({label:a.textContent.trim(),href:a.href,current:a.getAttribute('aria-current'),color:getComputedStyle(a).color})),
    selectedColor:getComputedStyle(document.querySelector('#music-content')||document.body,'::selection').backgroundColor,
    scrollbarColor:getComputedStyle(document.body,'::-webkit-scrollbar-thumb').backgroundColor};
}"""


def check_metrics(metrics, name, width, javascript, route):
    findings = []

    def require(condition, message):
        if not condition:
            findings.append(message)

    require(metrics['scrollWidth'] <= width + 2, '横overflow')
    require([n['label'] for n in metrics['nav']] == ['Home', 'Live', 'Music', 'Profile', 'Contact'], '5項目ナビ')
    if javascript:
        require(sum(n['current'] == 'page' for n in metrics['nav']) == 1, '現在地が1件')
    if route.startswith('/music/') and javascript:
        require(not metrics['red'], 'Music本文の意図しない赤')
        require(metrics['iframeCount'] == (1 if name in ['release-playing', 'video-playing'] else 0), 'iframe件数')
        if name == 'loading':
            require(metrics['busy'] == 'true' and metrics['state'] == 'loading', 'loading/busy')
        else:
            require(metrics['busy'] == 'false', '完了後busy=false')
        if name not in ['loading', 'error', 'all-empty']:
            expected_releases = 2 if name == 'empty-demo' else 4
            expected_videos = 3 if name == 'empty-live-movie' else 0 if name == 'empty-video' else 5
            require(metrics['releaseCount'] == expected_releases, '全作品の件数')
            require(metrics['videoCount'] == expected_videos, '全映像の件数')
        elements = metrics['elements']
        for e in elements['#music-content']:
            require(abs(e['box']['width'] - min(980, width - 32)) <= 2, '本文幅980/358')
        for e in elements['.music-release-image']:
            size = 120 if width <= 820 else 220
            require(abs(e['box']['width'] - size) <= 2 and abs(e['box']['height'] - size) <= 2, '作品画像220/120角')
        for e in elements['.music-release-text']:
            if width == 390:
                require(abs(e['box']['width'] - 222) <= 2, '文字領域222')
        for e in elements['.music-release-title']:
            require(e['fontSize'] == '20px' and e['lineHeight'] == '30px', '作品名20/30')
        for e in elements['.music-release-meta'] + elements['.music-release-description']:
            require(e['fontSize'] == '14px' and e['lineHeight'] == '22px', '本文14/22')
        for e in elements['.music-player'] + elements['.music-video-thumbnail']:
            if e['visible']:
                require(abs(e['box']['height'] - max(e['box']['width'] * 9 / 16, PLAYER_MIN_HEIGHT)) <= 2, 'player/映像は16:9、高さ200px未満にならない')
                require(e['box']['height'] >= PLAYER_MIN_HEIGHT - 2, 'player/映像の高さが200px以上')
        if width in [1440, 390]:
            for e in elements['.music-video-card']:
                require(abs(e['box']['width'] - (474 if width == 1440 else 358)) <= 2, '映像幅474/358')
            # 再生中は押したサムネイルが隠れて 0x0 になる。隠れた要素は寸法の判定に入れず、
            # 隠れてよい数は「再生中の映像 player の数」と一致させる（見えるべきものの消失を見逃さない）。
            video_thumbnails = elements['.music-video-thumbnail']
            for e in [e for e in video_thumbnails + elements['.music-video-stage'] + elements['.music-video-title'] if e['visible']]:
                require(abs(e['box']['width'] - (474 if width == 1440 else 358)) <= 2, 'サムネイル・stage・題名の幅474/358')
            for e in [e for e in video_thumbnails if e['visible']]:
                require(abs(e['box']['height'] - (267 if width == 1440 else 201)) <= 2, 'サムネイルの高さ267/201')
            playing_videos = [p for p in elements['.music-player'] if p['visible'] and p['id'].startswith('music-video-')]
            require(len([e for e in video_thumbnails if not e['visible']]) == len(playing_videos), '隠れたサムネイルの数が再生中の映像playerの数と一致')
        if width == 1440:
            for e in elements['.music-video-list']:
                require(len(e['gridTemplateColumns'].split()) == 2, 'PCの映像は2列')
            cards = sorted(elements['.music-video-card'], key=lambda e: (round(e['box']['y']), e['box']['x']))
            pairs = [(a, b) for a, b in zip(cards, cards[1:]) if abs(a['box']['y'] - b['box']['y']) <= 1]
            require(bool(pairs) or not cards, 'PCの映像に同じ行の2件がある')
            for a, b in pairs:
                require(abs(b['box']['x'] - a['box']['right'] - 32) <= 2, '映像の列の間隔32')
        if width <= 820:
            for e in elements['.music-video-list']:
                require(len(e['gridTemplateColumns'].split()) == 1, '狭い幅の映像は1列')
        cards = [e for e in elements['.music-release-card'] if e['visible']]
        players = [e for e in elements['.music-player'] if e['visible']]
        release_players = [e for e in players if e['id'].startswith('music-release-')]
        for e in release_players:
            owner = next((c for c in cards if c['id'] + '-player' == e['id']), None)
            require(owner is not None, '作品のプレーヤーに対応する作品がある')
            if owner is None:
                continue
            list_box = next((l for l in elements['.music-release-list'] if l['box']['x'] <= owner['box']['x'] + 1 and owner['box']['right'] <= l['box']['right'] + 1 and l['box']['y'] <= owner['box']['y'] + 1 and owner['box']['y'] <= l['box']['bottom']), None)
            require(list_box is not None, '作品の一覧が見つかる')
            row = [c for c in cards if abs(c['box']['y'] - owner['box']['y']) <= 1]
            row_bottom = max(c['box']['bottom'] for c in row)
            if width > 820:
                require(abs(e['box']['width'] - 480) <= 2 and abs(e['box']['height'] - 270) <= 2, 'PCの聴くのプレーヤー480x270')
                require(e['box']['y'] >= row_bottom - 1 and e['box']['y'] - row_bottom <= 40, '聴くのプレーヤーは押した作品の並びのすぐ下')
                if list_box:
                    require(e['box']['x'] >= list_box['box']['x'] - 2 and e['box']['right'] <= list_box['box']['right'] + 2, '聴くのプレーヤーが一覧から横にはみ出さない')
                below = [c for c in cards if c not in row and c['box']['y'] > owner['box']['y']]
                for c in below:
                    require(c['box']['y'] >= e['box']['bottom'] - 1, '次の並びはプレーヤーの下')
            else:
                require(e['box']['y'] >= owner['box']['bottom'] - 1 and e['box']['right'] <= width + 2, '狭い幅のプレーヤーは作品のすぐ下で横にはみ出さない')
        boxes = [(f"作品{c['id']}", c['box']) for c in cards] + [(f"プレーヤー{p['id']}", p['box']) for p in players]
        for i, (name_a, a) in enumerate(boxes):
            for name_b, b in boxes[i + 1:]:
                overlap = min(a['right'], b['right']) - max(a['x'], b['x']) > 1 and min(a['bottom'], b['bottom']) - max(a['y'], b['y']) > 1
                require(not overlap, f'重なり: {name_a} と {name_b}')
        for link in metrics['releaseLinks']:
            require(link['label'].startswith(link['text']) and (link['title'] in link['label'] or not link['title']), '作品の外部リンクの読み上げ名に作品名')
        for e in elements['.music-release-title'] + elements['.music-release-description']:
            require(e['scrollWidth'] <= e['clientWidth'] + 2, '長文の横欠け')
            require(e['textLines'] >= 1, '文字nodeの実描画行')
    return findings


def run_capture(browser, results, font_files, name, width, filename, route='/music/', full=False,
                menu=None, javascript=True):
    data, variant = scenario_data(name)
    height = 900 if width != 390 else 844
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  reduced_motion='reduce', java_script_enabled=javascript, service_workers='block')
    page = context.new_page()
    blocked, failed_scripts, pageerrors, console_errors, unexpected, pending, expected_failures = [], [], [], [], [], [], []
    page.on('pageerror', lambda error: pageerrors.append(str(error)))
    page.on('console', lambda msg: console_errors.append({'text': msg.text, 'url': msg.location.get('url', '')}) if msg.type == 'error' else None)
    page.on('response', lambda response: failed_scripts.append({'url': response.url, 'status': response.status}) if response.request.resource_type == 'script' and response.status >= 400 else None)
    page.on('requestfailed', lambda request: failed_scripts.append({'url': request.url, 'failure': request.failure}) if request.resource_type == 'script' else None)

    def intercept(request_route):
        request = request_route.request
        parsed = urlparse(request.url)
        if request.method != 'GET':
            unexpected.append('Blocked non-GET: ' + request.url)
            request_route.abort()
        elif request.url in font_files:
            content, content_type = font_files[request.url]
            request_route.fulfill(body=content, content_type=content_type)
        elif parsed.path == '/api/public/site-data':
            if variant.get('pending'):
                pending.append(request_route)
                return
            status = variant.get('httpStatus', 200)
            if status != 200:
                expected_failures.append(request.url)
            request_route.fulfill(status=status, content_type='application/json',
                                  body=json.dumps({'data': data, 'meta': FIXTURE['meta']}),
                                  headers={'Access-Control-Allow-Origin': '*'})
        elif parsed.hostname in ['www.youtube.com', 'youtube.com'] and parsed.path.startswith('/embed/'):
            request_route.fulfill(content_type='text/html', body='<html lang="ja"><head><meta charset="utf-8"></head><body style="margin:0;background:#f5f5f5;color:#666;display:grid;place-items:center;height:100vh;font:14px sans-serif">架空のプレーヤー</body></html>')
        elif parsed.hostname == 'img.youtube.com':
            request_route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f5f5f5"/><text x="320" y="180" text-anchor="middle" fill="#666" font-size="24">video</text></svg>')
        elif parsed.hostname in ['localhost', '127.0.0.1'] and parsed.port == 8888:
            if parsed.path == '/favicon.ico':
                request_route.fulfill(status=204, body='')
            elif 'synthetic-missing' in parsed.path:
                expected_failures.append(request.url)
                request_route.fulfill(status=404, body='')
            else:
                request_route.continue_()
        else:
            blocked.append(request.url)
            request_route.abort()

    context.route('**/*', intercept)
    try:
        if javascript:
            page.clock.install(time=1794916800)  # Python Playwrightの数値単位は秒。
        page.goto(BASE + route, wait_until='domcontentloaded')
        if javascript and route.startswith(('/discography/', '/youtube/')):
            section = 'release' if route.startswith('/discography/') else 'video'
            page.wait_for_url(BASE + '/music/#' + section)
            page.wait_for_function('document.querySelector("#music-content")?.dataset.state === "ready"')
            page.wait_for_function('(id)=>{const y=document.getElementById(id).getBoundingClientRect().top;return y>=0&&y<innerHeight;}', arg=section)
        elif javascript and route.startswith('/music/'):
            state = 'loading' if variant.get('pending') else 'error' if variant.get('httpStatus') else 'empty' if variant.get('allEmpty') else 'ready'
            page.wait_for_function('(state)=>document.querySelector("#music-content").dataset.state===state', arg=state)
        elif javascript and route == '/':
            page.wait_for_function('document.querySelector("#home-content").dataset.state==="ready"')
        if not variant.get('pending'):
            page.wait_for_load_state('networkidle')
        page.evaluate('document.fonts.ready')
        page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        if javascript and variant.get('openRelease'):
            page.get_by_test_id('music-listen').click()
            assert page.get_by_test_id('music-close').filter(visible=True).count() == 1
        if javascript and variant.get('openVideo'):
            page.get_by_test_id('music-video-play').first.click()
            assert page.locator('.music-player iframe').count() == 1
        if javascript and route == '/' and menu is None:
            page.get_by_test_id('home-listen').click()
            assert page.locator('#home-player iframe').count() == 1
            page.get_by_test_id('home-close').click()
            assert page.locator('#home-player iframe').count() == 0
        short_menu = None
        if menu:
            page.locator('.nav-toggle').click()
            assert page.locator('#global-nav').is_visible()
            if menu == 'closed':
                page.keyboard.press('Escape')
                assert not page.locator('#global-nav').is_visible()
                assert page.locator('.nav-toggle').evaluate('(e)=>document.activeElement===e')
            else:
                for _ in range(5):
                    page.keyboard.press('Tab')
                assert page.evaluate('document.activeElement.textContent.trim()') == 'Contact'
                page.set_viewport_size({'width': 390, 'height': 667})
                page.locator('#global-nav a').last.scroll_into_view_if_needed()
                short_menu = page.locator('#global-nav').evaluate('(e)=>({clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,overflowY:getComputedStyle(e).overflowY,contactBottom:[...e.querySelectorAll("a")].at(-1).getBoundingClientRect().bottom})')
                contact_box = page.locator('#global-nav a').last.bounding_box()
                assert contact_box['y'] >= 0 and contact_box['y'] + contact_box['height'] <= 669
                page.set_viewport_size({'width': width, 'height': height})
        if not route.startswith(('/discography/', '/youtube/')):
            page.evaluate('window.scrollTo(0,0)')
        metrics = page.evaluate(METRICS_JS)
        metrics['shortMenu667'] = short_menu
        checks = check_metrics(metrics, name, width, javascript, route)
        if name == 'no-selection':
            if page.get_by_test_id('music-listen').count() != 0:
                checks.append('映像未選択の聴くが残る')
        for empty_name, selector in [('empty-demo', '#demo'), ('empty-live-movie', '.music-video-group:has-text("live movie")'), ('empty-video', '#video')]:
            if name == empty_name and page.locator(selector).count():
                checks.append('空区分の見出しが残る: ' + empty_name)
        if name in ['no-image', 'broken-image']:
            fallback = page.locator('#music-release-digital-0 .music-artwork-fallback')
            if not fallback.is_visible() or fallback.inner_text() != '松本一樹':
                checks.append('画像fallback')
        if javascript and route.startswith('/music/') and name not in ['error', 'loading', 'all-empty']:
            for category, items in data['discography'].items():
                for ordinal, item in enumerate(items):
                    article = page.locator(f'#music-release-{category}-{ordinal}')
                    if article.locator('.music-release-title').inner_text() != item['title']:
                        checks.append('作品名の欠け')
                    description = item.get('description', '').replace('<br>', '\n').replace('\r\n', '\n').replace('\r', '\n')
                    if description and article.locator('.music-release-description').inner_text() != description:
                        checks.append('説明・曲目の欠け')
        if javascript and route.startswith('/music/'):
            interactive = page.locator('#music-content .site-chip, #music-content .site-button, #music-content .site-text-link')
            if interactive.count():
                target = interactive.first
                target.hover()
                target.focus()
                active_red = page.evaluate(METRICS_JS)['red']
                metrics['interactionRed'] = active_red
                if active_red:
                    checks.append('hover/focusで本文に赤')
                target.evaluate('(e)=>e.blur()')
        page.screenshot(path=str(SHOTS / filename), full_page=full)
        if javascript and width == NARROW_WIDTH and variant.get('openVideo'):
            # 最小の高さ: 置ける幅が356px未満でも、作品のプレーヤーの高さは200px以上（映像は上の撮影で確認）。
            page.get_by_test_id('music-listen').click()
            narrow_release = page.evaluate(METRICS_JS)
            metrics['narrowReleasePlayer'] = [e['box'] for e in narrow_release['elements']['.music-player'] if e['visible']]
            checks.extend('360px・作品のプレーヤー: ' + f for f in check_metrics(narrow_release, 'release-playing', width, javascript, route))
            if not any(b['height'] >= PLAYER_MIN_HEIGHT - 2 for b in metrics['narrowReleasePlayer']):
                checks.append('360pxで作品のプレーヤーが高さ200px未満')
        errors = [entry for entry in console_errors if entry['url'] not in blocked + expected_failures]
        row = {'image': 'screenshots/' + filename, 'scenario': name, 'route': route, 'javascript': javascript,
               'landed_url': page.url, 'metrics': metrics, 'findings': checks,
               'blocked_external_requests': blocked, 'expected_failed_requests': expected_failures,
               'console_errors': console_errors, 'unexpected_console_errors': errors,
               'pageerrors': pageerrors, 'failed_scripts': failed_scripts, 'unexpected_requests': unexpected}
        results['captures'].append(row)
        (OUT / 'capture-music-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
        assert not (checks or errors or pageerrors or failed_scripts or unexpected), str(row)
        print(filename, flush=True)
    finally:
        for request_route in pending:
            request_route.abort()
        pending.clear()
        context.unroute_all(behavior='wait')
        context.close()


def capture_all(args):
    SHOTS.mkdir(exist_ok=True)
    font_files, font_manifest = cached_fonts()
    results = {'ui_route': UI_ROUTE, 'fixture': 'test/fixtures/music-states.json',
               'fixture_sha256': hashlib.sha256(FIXTURE_PATH.read_bytes()).hexdigest(),
               'expected_images': expected_images(), 'captures': [], 'font_cache': font_manifest,
               'font_acceptance': '同版cacheがない場合はfallback。文字・折返しの最終受入は未確認。',
               'visual_review': '未実施。Frontが全画像をFigma v2と照合する。Music renderのpixel比較はない。',
               'real_audio': '未実施', 'production_data': '未実施', 'status': 'running'}
    server = None
    try:
        if args.serve:
            server = ThreadingHTTPServer(('127.0.0.1', 8888), PublicHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
        with sync_playwright() as p:
            launch = {'headless': True}
            if args.chromium:
                launch['executable_path'] = args.chromium
            browser = p.chromium.launch(**launch)
            results['browser'] = browser.version
            for width in [1440, 390]:
                for kind in ['first', 'full']:
                    run_capture(browser, results, font_files, 'base', width, f'music-{width}-{kind}.png', full=kind == 'full')
            for name in VARIANTS:
                for width in [1440, 390]:
                    run_capture(browser, results, font_files, name, width, f'music-{name}-{width}.png', full=True)
            for state in ['open', 'closed']:
                run_capture(browser, results, font_files, 'base', 390, f'menu-music-390-{state}.png', menu=state)
            run_capture(browser, results, font_files, 'base', 390, 'menu-home-390-open.png', route='/', menu='open')
            for width in [821, 1024]:
                run_capture(browser, results, font_files, 'base', width, f'music-{width}.png', full=True)
            run_capture(browser, results, font_files, 'video-playing', NARROW_WIDTH, NARROW_IMAGE, full=True)
            for route in ['discography', 'youtube']:
                for width in [1440, 390]:
                    run_capture(browser, results, font_files, 'base', width, f'legacy-{route}-{width}.png', route=f'/{route}/?from=synthetic#old')
                    run_capture(browser, results, font_files, 'base', width, f'legacy-{route}-nojs-{width}.png', route=f'/{route}/', javascript=False)
            for route, name in SMOKE_ROUTES:
                for width in [1440, 390]:
                    run_capture(browser, results, font_files, 'base', width, f'smoke-{name}-{width}.png', route=route)
            browser.close()
        actual = [Path(row['image']).name for row in results['captures']]
        assert sorted(actual) == sorted(expected_images()), '撮影名/件数が契約と不一致'
        results['status'] = 'captured; visual/font acceptance pending'
        print(f'{len(actual)}画像。自動metrics確認済み。全画像目視・font・本番データ・実音は別の受入。', flush=True)
    except Exception as error:
        results['status'] = 'visual_acceptance_pending'
        results['failure'] = str(error)
        traceback.print_exc()
        raise
    finally:
        (OUT / 'capture-music-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
        if server:
            server.shutdown()
            server.server_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--chromium', help='既存Chromiumの実行ファイル（download/installしない）')
    args = parser.parse_args()
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
    try:
        print(UI_ROUTE, flush=True)
        capture_all(args)
    finally:
        sys.stdout, sys.stderr = stdout, stderr
        log.close()


if __name__ == '__main__':
    main()
