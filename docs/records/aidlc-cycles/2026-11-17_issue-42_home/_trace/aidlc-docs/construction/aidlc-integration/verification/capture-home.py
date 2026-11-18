"""Fixture-only #42 acceptance capture. No external request is sent.

From the execution target:
  /usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-home.py --serve
Or start `/usr/bin/python3 -m http.server 8888 --bind 127.0.0.1` first,
then invoke this script without --serve. --chromium accepts an installed executable.
"""
import argparse
import copy
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SHOTS = OUT / 'screenshots'
FIXTURE = json.loads((ROOT / 'test/fixtures/home-states.json').read_text())
BASE = 'http://127.0.0.1:8888'
ROUTE = 'ui_route=headless_acceptance:PS-H-01,PS-H-02,PS-H-04,PS-H-06,PS-COM-01,PS-COM-02'
SELECTORS = {
    'jacket': '#home-artwork', 'title': '.home-release-title',
    'date': '.home-live-date', 'booking': '.site-button--primary',
    'listen': '#home-listen', 'player': '#home-player',
    'header': '.site-header', 'footer': '.site-footer', 'nav': '#global-nav',
}


def scenario_data(name):
    data = copy.deepcopy(FIXTURE['data'])
    variant = FIXTURE['scenarios'].get(name, {})
    live = data['live']['upcoming'][0]
    for key in ['ticketUrl', 'reservationClosed']:
        if key in variant:
            live[key] = variant[key]
    if 'upcoming' in variant:
        data['live']['upcoming'] = variant['upcoming']
    for key in ['playbackVideoId', 'image']:
        if key in variant:
            data['discography']['digital'][0][key] = variant[key]
    if 'releases' in variant:
        data['discography'] = {'digital': [], 'demo': []}
    if 'news' in variant:
        data['news'] = variant['news']
    if name == 'long-title':
        data['discography']['digital'][0]['title'] = '架空の長い作品名が折り返される場合の表示を確認するためのタイトル'
    return data, variant


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--chromium', help='Existing Chromium executable only; never downloads')
    args = parser.parse_args()
    SHOTS.mkdir(exist_ok=True)
    results = {'ui_route': ROUTE, 'fixture': 'test/fixtures/home-states.json', 'captures': [],
               'real_audio': '未実施・確認2で行う', 'production_data': '未実施・確認2で行う',
               'font_acceptance': '外部font遮断。厳密な字形と折返しは未確認'}
    server = None
    server_log = None
    try:
        if args.serve:
            server_log = (OUT / 'http-server.log').open('w')
            server = subprocess.Popen(['/usr/bin/python3', '-m', 'http.server', '8888', '--bind', '127.0.0.1'], cwd=ROOT, stdout=server_log, stderr=subprocess.STDOUT)
            for _ in range(50):
                if server.poll() is not None:
                    raise RuntimeError('localhost server failed; see http-server.log')
                try:
                    with urlopen(BASE + '/', timeout=.5) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError('localhost server readiness timeout')
        with sync_playwright() as p:
            launch = {'headless': True}
            if args.chromium:
                launch['executable_path'] = args.chromium
            browser = p.chromium.launch(**launch)
            results['browser'] = browser.version

            def capture(name, width, height=900, route='/', filename=None, full=False, menu=False):
                data, variant = scenario_data(name)
                context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce', device_scale_factor=1)
                page = context.new_page()
                page.clock.install(time=1794916800)  # fixed 2026-11-17 21:00 JST; Playwright for Python reads a number as seconds
                blocked, unexpected, failed_scripts, pending_routes = [], [], [], []
                console_errors, pageerrors = [], []
                page.on('pageerror', lambda err: pageerrors.append(str(err)))
                page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
                page.on('response', lambda resp: failed_scripts.append({'url': resp.url, 'status': resp.status}) if resp.request.resource_type == 'script' and resp.status >= 400 else None)
                page.on('requestfailed', lambda req: failed_scripts.append({'url': req.url, 'failure': req.failure}) if req.resource_type == 'script' else None)

                def intercept(request_route):
                    request = request_route.request
                    parsed = urlparse(request.url)
                    if parsed.path == '/api/public/site-data':
                        if variant.get('pending'):
                            pending_routes.append(request_route)
                            return
                        request_route.fulfill(status=variant.get('httpStatus', 200), content_type='application/json', body=json.dumps({'data': data, 'meta': FIXTURE['meta']}), headers={'Access-Control-Allow-Origin': '*'})
                    elif parsed.hostname in ['www.youtube.com', 'youtube.com'] and parsed.path.startswith('/embed/'):
                        # Local inert HTML fulfilled in-process: no YouTube connection or audio.
                        request_route.fulfill(content_type='text/html', body='<html lang="ja"><head><meta charset="utf-8"></head><body style="margin:0;background:#f5f5f5;color:#666;font:14px sans-serif;display:grid;place-items:center;height:100vh">架空のプレーヤー</body></html>')
                    elif parsed.hostname in ['127.0.0.1', 'localhost']:
                        if request.method != 'GET':
                            unexpected.append('Blocked non-GET: ' + request.url)
                            request_route.abort()
                        else:
                            request_route.continue_()
                    else:
                        blocked.append(request.url)
                        request_route.abort()

                context.route('**/*', intercept)
                page.goto(BASE + route, wait_until='domcontentloaded')
                if route == '/':
                    state = 'loading' if variant.get('pending') else 'error' if variant.get('httpStatus') else 'ready'
                    page.wait_for_function('(state) => document.querySelector("#home-content").dataset.state === state', arg=state)
                if not variant.get('pending'):
                    page.wait_for_load_state('networkidle')
                page.evaluate('document.fonts.ready')
                page.wait_for_function('Array.from(document.images).every(i => i.complete)')
                if variant.get('openPlayer'):
                    page.get_by_test_id('home-listen').click()
                    assert page.locator('#home-player iframe').count() == 1
                    assert page.locator('#home-player').evaluate('(e)=>e.nextElementSibling.classList.contains("home-release-actions--playing")')
                    assert page.locator('#home-player').bounding_box()['y'] < page.get_by_test_id('home-close').bounding_box()['y']
                    assert page.get_by_test_id('home-close').evaluate('(e)=>e.classList.contains("site-button--secondary") && !e.classList.contains("site-button--play")')
                    page.locator('.nav-toggle').click() if width <= 820 else None
                    assert page.locator('#home-player iframe').count() == 1, 'Menu must keep playback'
                    page.locator('.nav-toggle').click() if width <= 820 else None
                if menu:
                    page.locator('.nav-toggle').click()
                    assert page.locator('#global-nav').is_visible()
                    assert page.locator('#global-nav a').count() == 6
                    for _ in range(6):
                        page.keyboard.press('Tab')
                    assert page.evaluate('document.activeElement.textContent.trim()') == 'Contact'
                page.evaluate('window.scrollTo(0,0)')
                metrics = page.evaluate('''(selectors) => {
                  const boxes = {};
                  for (const [key, selector] of Object.entries(selectors)) {
                    const e = document.querySelector(selector);
                    if (!e || e.getClientRects().length === 0) { boxes[key] = null; continue; }
                    const b = e.getBoundingClientRect();
                    boxes[key] = {x:b.x, y:b.y, top:b.top, bottom:b.bottom, right:b.right, width:b.width, height:b.height};
                  }
                  return {scrollY, scrollWidth:document.documentElement.scrollWidth,
                    viewport:{width:innerWidth,height:innerHeight}, boxes,
                    font:getComputedStyle(document.body).fontFamily,
                    zenFontLoaded:[...document.fonts].some(f=>f.family.includes('Zen Kaku') && f.status==='loaded'),
                    headingFont:document.querySelector('.home-release-title') ? getComputedStyle(document.querySelector('.home-release-title')).font : null,
                    headerColor:getComputedStyle(document.querySelector('.site-header')).backgroundColor,
                    iframeCount:document.querySelectorAll('#home-player iframe').length};
                }''', SELECTORS)
                if route == '/' and name in ['normal', 'freeform-news-dates']:
                    metrics['news_dates'] = page.locator('.site-news-item').evaluate_all('''(rows) => rows.map(row => {
                      const date = row.querySelector('.site-news-date');
                      const body = row.querySelector('.site-news-content');
                      const box = date.getBoundingClientRect();
                      const content = body.getBoundingClientRect();
                      const lineHeight = parseFloat(getComputedStyle(date).lineHeight);
                      const words = [...date.querySelectorAll('.site-news-date-word')].map(word => {
                        const range = document.createRange(); range.selectNodeContents(word);
                        const rects = [...range.getClientRects()].filter(r => r.width > 0);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d'); ctx.font = getComputedStyle(word).font;
                        return {text:word.textContent, width:word.getBoundingClientRect().width,
                          naturalWidth:ctx.measureText(word.textContent).width,
                          lines:new Set(rects.map(r => Math.round(r.y * 10) / 10)).size,
                          fits:rects.every(r => r.left >= box.left - .5 && r.right <= box.right + .5)};
                      });
                      // The grid cell stretches to the row height, so count rendered text lines instead of box height.
                      const lineTops = new Set();
                      const walker = document.createTreeWalker(date, NodeFilter.SHOW_TEXT);
                      while (walker.nextNode()) {
                        if (!walker.currentNode.textContent.trim()) continue;
                        const textRange = document.createRange(); textRange.selectNodeContents(walker.currentNode);
                        for (const r of textRange.getClientRects()) if (r.width > 0) lineTops.add(Math.round((r.top - box.top) / lineHeight));
                      }
                      const dateLines = lineTops.size;
                      return {text:date.textContent, width:box.width, lines:dateLines, boxLines:Math.round(box.height / lineHeight),
                        bodyLeft:content.left, bodyWidth:content.width, gap:content.x - box.right,
                        fits:date.scrollWidth <= date.clientWidth + 1, words};
                    })''')
                    body_lefts = [date['bodyLeft'] for date in metrics['news_dates']]
                    assert body_lefts and max(body_lefts) - min(body_lefts) <= .5, str(metrics['news_dates'])
                    for date in metrics['news_dates']:
                        assert date['fits'] and all(word['fits'] for word in date['words']), str(date)
                        assert abs(date['gap'] - 24) <= .5, str(date)
                        assert date['lines'] >= 1 and date['lines'] <= sum(word['lines'] for word in date['words']), str(date)
                        if width == 390:
                            assert date['bodyWidth'] >= 180 - .5, str(date)
                        if name == 'normal':
                            assert abs(date['width'] - 88) <= .5 and date['lines'] == 1, str(date)
                        else:
                            assert 88 - .5 <= date['width'] <= min(240, width - 236) + .5, str(date)
                        for word in date['words']:
                            if word['naturalWidth'] <= date['width'] + .5:
                                assert word['lines'] == 1, str(date)
                            else:
                                assert word['lines'] > 1, str(date)
                    if name == 'freeform-news-dates':
                        expected = sorted(item['date'] for item in data['news'])
                        assert sorted(date['text'] for date in metrics['news_dates']) == expected
                        assert any(date['lines'] > 1 for date in metrics['news_dates'])
                metrics['horizontal_fit'] = metrics['scrollWidth'] <= width
                assert metrics['horizontal_fit'], f'horizontal overflow: {name} {width}'
                if name == 'normal' and not menu and route == '/':
                    required = ['jacket', 'title', 'date', 'booking', 'listen'] if width == 1440 else ['jacket', 'title'] if width == 390 else []
                    metrics['first_view'] = {key:bool(metrics['boxes'][key] and metrics['boxes'][key]['top'] >= 0 and metrics['boxes'][key]['bottom'] <= height and metrics['boxes'][key]['right'] <= width) for key in required}
                    assert all(metrics['first_view'].values()), str(metrics['first_view'])
                if name == 'no-live':
                    assert page.locator('#home-next-live-empty').is_visible()
                    assert page.locator('.site-button--primary').count() == 0
                if name == 'no-release':
                    assert not page.get_by_text('new release', exact=True).is_visible()
                    assert page.locator('#home-artist-name').is_visible()
                    assert page.locator('.home-release-meta, .home-release-actions').count() == 0
                file = filename or f'home-{name}-{width}.png'
                page.screenshot(path=str(SHOTS / file), full_page=full)
                # Aborted external fonts/icons are expected network-denial evidence.
                unexpected_console = [text for text in console_errors if 'ERR_FAILED' not in text and '503' not in text]
                row = {'image': 'screenshots/' + file, 'scenario': name, 'route': route, 'metrics': metrics,
                       'blocked_external_requests': blocked, 'console_errors': console_errors,
                       'unexpected_console_errors': unexpected_console, 'pageerrors': pageerrors,
                       'failed_script_responses': failed_scripts, 'unexpected_requests': unexpected}
                results['captures'].append(row)
                (OUT / 'capture-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
                assert not (unexpected or unexpected_console or pageerrors or failed_scripts), str(row)
                if menu:
                    page.keyboard.press('Escape')
                    assert not page.locator('#global-nav').is_visible()
                    assert page.locator('.nav-toggle').evaluate('(e)=>document.activeElement===e')
                for pending_route in pending_routes:
                    pending_route.abort()
                pending_routes.clear()
                context.unroute_all(behavior='wait')
                context.close()
                print(file, flush=True)

            for width, height in [(1440, 900), (390, 844), (390, 667)]:
                suffix = '390-667' if height == 667 else str(width)
                capture('normal', width, height, filename=f'home-{suffix}-first.png')
                if height != 667:
                    capture('normal', width, height, filename=f'home-{suffix}-full.png', full=True)
            capture('normal', 390, 844, filename='menu-390-open.png', menu=True)
            capture('normal', 390, 844, filename='menu-390-closed.png')
            capture('normal', 390, 320, filename='menu-390-short.png', menu=True)
            for name in FIXTURE['scenarios']:
                if name == 'normal':
                    continue
                for width, height in [(1440, 900), (390, 844)]:
                    capture(name, width, height, full=name == 'freeform-news-dates')
            for width in [821, 1024]:
                capture('normal', width, filename=f'home-{width}.png')
            for route, label in [('/live/', 'live'), ('/live/detail/?liveId=live-a', 'live-detail'), ('/ticket/?liveId=live-a', 'ticket'), ('/ticket/complete/?rid=synthetic&date=2099.12.12&venue=Fixture', 'ticket-complete'), ('/discography/', 'discography'), ('/youtube/', 'youtube'), ('/profile/', 'profile'), ('/contact/', 'contact')]:
                for width, height in [(1440, 900), (390, 844)]:
                    capture('normal', width, height, route=route, filename=f'shell-{label}-{width}.png')
            for width, height in [(1440, 900), (390, 667)]:
                capture('long-title', width, height, filename=f'home-long-title-{width}.png', full=True)
            browser.close()
        results['status'] = 'captured; visual inspection required'
    except Exception as error:
        results['status'] = 'visual_acceptance_pending'
        results['failure'] = str(error)
        raise
    finally:
        (OUT / 'capture-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
        if server:
            server.terminate()
            server.wait(timeout=5)
        if server_log:
            server_log.close()


if __name__ == '__main__':
    main()
