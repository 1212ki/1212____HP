"""ProfileとContactの架空データを使うFront用撮影（Issue #45）。

execution targetで実行:
  /usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-profile-contact.py --serve
--chromium はインストール済みの実行ファイルだけを指定する。--self-check はブラウザもbindも使わず、契約（画像名・件数・fixture）だけを検査する。

通信の扱い（計画 §6）:
- 公開API（**/api/public/site-data）はfixtureでfulfillする。
- Contactの送信先 https://forms.example.test/** だけを、シナリオごとに成功・HTTP失敗・通信失敗・応答なしへ差し替える。
- ページに埋め込まれた本番の送信先のhost（formspree.io）とlocalhost以外はすべてabortして記録し、
  本番の送信先へのrequestが0件であることを各シナリオで検査する（0件でなければ失敗）。
撮影画像の全件目視、同じfontでの文字確認、本番公開データでの画面確認はFrontが別に行う。
"""
import argparse
import copy
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import struct
import sys
import threading
import traceback
import zlib
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SHOTS = OUT / 'screenshots'
FIXTURE_PATH = ROOT / 'test/fixtures/profile-contact-states.json'
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
# 架空の文章の空でない行の数。登録の改行が保たれれば、文章はこの行数以上で出る（空行は文字 node の行に数えない）。
TEXT_NONBLANK_LINES = sum(1 for line in FIXTURE['data']['profile']['text'].splitlines() if line.strip())
BASE = 'http://127.0.0.1:8888'
UI_ROUTE = 'ui_route=headless_acceptance:PS-COM-02,PS-PC-03,PS-PC-04,AC45-COMPAT,AC45-STYLE'
FONT_URL = 'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&display=swap'
FORM_HOST = 'forms.example.test'          # fixtureの送信先（架空）
PRODUCTION_FORM_HOST = 'formspree.io'     # ページに埋め込まれている本番の送信先のhost。requestを出してはいけない
PUBLIC_PAGES = {'index.html', 'music/index.html', 'discography/index.html', 'youtube/index.html',
                'live/index.html', 'live/detail/index.html', 'ticket/index.html',
                'ticket/complete/index.html', 'profile/index.html', 'contact/index.html'}
INK = 'rgb(26, 26, 26)'
PAPER_DEEP = 'rgb(245, 245, 245)'
ACCENT = 'rgb(191, 85, 77)'
WIDTHS = [1440, 390]
CLOCK_SECONDS = 1794916800  # Python Playwrightの数値単位は秒
SYNTHETIC_VALUES = {'name': '架空 太郎', 'email': 'taro@example.test',
                    'message': '架空の問い合わせです。\n2行目の確認用です。\n<b>タグ</b> & "引用" を含む3行目。'}
SMOKE = [('/', 'home', 'test/fixtures/home-states.json'), ('/music/', 'music', 'test/fixtures/music-states.json'),
         ('/live/', 'live', 'test/fixtures/home-states.json')]


def build_plan():
    """画像名・route・data・操作の全件。expected_images()はここから作る。"""
    plan = []

    def add(file, kind, width, scenario, route=None, steps=(), submit='ok', full=True, **extra):
        plan.append({'file': file, 'kind': kind, 'width': width, 'scenario': scenario,
                     'route': route or ('/profile/' if kind == 'profile' else '/contact/'),
                     'steps': list(steps), 'submit': submit, 'full': full, **extra})

    for width in WIDTHS:
        for part in ['first', 'full']:
            add(f'profile-{width}-{part}.png', 'profile', width, 'base', full=part == 'full')
    for width in WIDTHS:
        add(f'profile-no-photo-{width}.png', 'profile', width, 'no-photo')
        add(f'profile-photo-broken-{width}.png', 'profile', width, 'broken-photo')
        add(f'profile-error-{width}.png', 'profile', width, 'error')
        add(f'profile-loading-{width}.png', 'profile', width, 'loading')
        add(f'profile-links-extra-{width}.png', 'profile', width, 'extra-links')
        add(f'profile-no-links-{width}.png', 'profile', width, 'no-links')
        add(f'profile-empty-{width}.png', 'profile', width, 'empty-profile')
    for width in WIDTHS:
        add(f'contact-{width}.png', 'contact', width, 'base')
        add(f'contact-filled-{width}.png', 'contact', width, 'base', steps=['fill'])
        add(f'contact-invalid-{width}.png', 'contact', width, 'base', steps=['fill-bad-email', 'click-submit'])
        add(f'contact-empty-{width}.png', 'contact', width, 'base', steps=['click-submit'])
        add(f'contact-sending-{width}.png', 'contact', width, 'base', steps=['fill', 'click-submit', 'wait-sending'], submit='pending')
        add(f'contact-done-{width}.png', 'contact', width, 'base', steps=['fill', 'click-submit', 'wait-done'])
        add(f'contact-failed-{width}.png', 'contact', width, 'base', steps=['fill', 'click-submit', 'wait-failed'], submit='http-error')
        add(f'contact-loading-{width}.png', 'contact', width, 'loading')
        add(f'contact-fallback-{width}.png', 'contact', width, 'contact-unreadable')
        add(f'contact-focus-{width}.png', 'contact', width, 'base', steps=['fill', 'focus-email'])
    add('contact-hover-submit-1440.png', 'contact', 1440, 'base', steps=['fill', 'hover-submit'])
    add('profile-hover-chip-1440.png', 'profile', 1440, 'base', steps=['hover-chip'])
    for width in [821, 1024, 360]:
        add(f'profile-{width}.png', 'profile', width, 'base')
        add(f'contact-{width}.png', 'contact', width, 'base')
    add('menu-profile-390-open.png', 'profile', 390, 'base', steps=['menu'], full=False)
    add('menu-contact-390-open.png', 'contact', 390, 'base', steps=['menu'], full=False)
    for route, name, fixture_path in SMOKE:
        add(f'smoke-{name}-390.png', 'smoke', 390, 'base', route=route, fixture=fixture_path)
    return plan


def expected_images():
    return [item['file'] for item in build_plan()]


def scenario_data(name):
    data = copy.deepcopy(FIXTURE['data'])
    scenario = FIXTURE['scenarios'][name]
    for path, value in scenario.get('set', {}).items():
        keys = path.split('.')
        holder = data
        for key in keys[:-1]:
            holder = holder[key]
        holder[keys[-1]] = copy.deepcopy(value)
    return data, scenario


def synthetic_png(width=800, height=1000):
    """写真の代わりの架空の画像（4:5ではない比率で、切り抜きが分かる格子）。外部・実写真は使わない。"""
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            r, g, b = 205 - x * 50 // width, 214 - y * 70 // height, 222
            if x % 100 < 4 or y % 100 < 4:
                r, g, b = 80, 90, 100
            if abs(x - width // 2) < 6 or abs(y - height // 2) < 6:
                r, g, b = 40, 60, 90
            row += bytes((r, g, b))
        rows.append(bytes(row))

    def chunk(tag, content):
        return struct.pack('>I', len(content)) + tag + content + struct.pack('>I', zlib.crc32(tag + content) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 6)) + chunk(b'IEND', b''))


def cached_fonts():
    """既存の同版cacheがあればURLとdigestを検証。取得・installはしない。manifestがなければfallback。"""
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
    """localhostの公開HTML/assetsのみ。repo全体・admin・設定値は配信しない。"""
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


METRICS_JS = r"""(selectors) => {
  const box = e => { const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}; };
  const visible = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  // 行数は要素の高さではなく、文字nodeのRange.getClientRectsを行のtopごとに数える。
  const lines = e => {
    const tops=[]; const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      if(!walker.currentNode.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(walker.currentNode);
      for(const r of range.getClientRects())if(r.width>0&&!tops.some(t=>Math.abs(t-r.top)<.5))tops.push(r.top);
    }
    return tops.length;
  };
  const elements={};
  for(const selector of selectors)elements[selector]=[...document.querySelectorAll(selector)].map(e=>{
    const s=getComputedStyle(e);
    return {id:e.id,text:e.textContent.trim(),visible:visible(e),box:box(e),textLines:visible(e)?lines(e):0,
      fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,letterSpacing:s.letterSpacing,
      color:s.color,background:s.backgroundColor,borderColor:s.borderTopColor,borderWidth:s.borderTopWidth,
      outlineColor:s.outlineColor,outlineWidth:s.outlineWidth,boxShadow:s.boxShadow,transform:s.transform,opacity:s.opacity,
      padding:s.padding,gap:s.gap,whiteSpace:s.whiteSpace,flexDirection:s.flexDirection,
      readOnly:e.readOnly===true,disabled:e.disabled===true,ariaInvalid:e.getAttribute('aria-invalid'),
      scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  });
  // 赤(--accent)を使ってよいのは「送信する」のボタンの背景と、見出しの線(::after)だけ。
  const red=[];
  const ACCENT='rgb(191, 85, 77)';
  for(const e of document.querySelectorAll('main *'))if(visible(e)){
    for(const pseudo of [null,'::before','::after']){
      const s=getComputedStyle(e,pseudo);if(pseudo&&['none','normal'].includes(s.content))continue;
      for(const key of ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor']){
        if(s[key]===ACCENT)red.push({id:e.id,className:e.className,pseudo,key});
      }
      if(String(s.boxShadow).includes('191, 85, 77'))red.push({id:e.id,className:e.className,pseudo,key:'boxShadow'});
    }
  }
  const main=document.querySelector('main');
  return {viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,
    state:main&&(main.dataset.state||main.dataset.settings||''),submitState:document.querySelector('#contact-form')?.dataset.submitState||'',
    busy:main&&main.getAttribute('aria-busy'),elements,red,
    activeId:document.activeElement&&document.activeElement.id||'',
    font:getComputedStyle(document.body).fontFamily,zenFontLoaded:[...document.fonts].some(f=>f.family.includes('Zen Kaku')&&f.status==='loaded'),
    nav:[...document.querySelectorAll('#global-nav a')].map(a=>({label:a.textContent.trim(),current:a.getAttribute('aria-current'),color:getComputedStyle(a).color}))};
}"""

PROFILE_SELECTORS = ['#profile-content', '.site-section-title', '.profile-intro', '#profile-photo', '#profile-image', '.profile-body',
                     '.profile-name h2', '.profile-name p', '#profile-state', '#profile-state [role="status"]', '#profile-state button',
                     '#profile-text', '#profile-links-block', '.home-caption', '.profile-link-list a', '.profile-contact-entry',
                     '.profile-contact-label', '.profile-contact-entry a', '.site-header', '.site-footer']
CONTACT_SELECTORS = ['#contact-content', '.site-section-title', '#contact-panel', '#contact-intro', '#contact-form', '.contact-field',
                     '.contact-field label', '#name', '#email', '#message', '.contact-error', '#contact-failure', '#contact-submit',
                     '#contact-done', '#contact-done h2', '.contact-done-lead', '.contact-sent', '.contact-sent-row', '#contact-done a',
                     '.site-header', '.site-footer']
SMOKE_SELECTORS = ['main', '.site-header', '.site-footer']


def one(metrics, selector):
    items = metrics['elements'].get(selector, [])
    return items[0] if items else None


def visible_items(metrics, selector):
    return [e for e in metrics['elements'].get(selector, []) if e['visible']]


def near(actual, expected, tolerance=2):
    return abs(actual - expected) <= tolerance


def check_metrics(metrics, item):
    """合否の基準（計画 §6。許容は罫線・丸めで±2px）。違反の一覧を返す。"""
    findings = []
    width, kind, scenario = item['width'], item['kind'], item['scenario']

    def require(condition, message):
        if not condition:
            findings.append(message)

    require(metrics['scrollWidth'] <= width + 2, '横overflow')
    require([n['label'] for n in metrics['nav']] == ['Home', 'Live', 'Music', 'Profile', 'Contact'], '5項目ナビ')
    if kind == 'smoke':
        return findings
    require(sum(n['current'] == 'page' for n in metrics['nav']) == 1, '現在地が1件')
    allowed_red = [r for r in metrics['red'] if not (r['key'] == 'backgroundColor' and (
        (r['pseudo'] == '::after' and 'site-section-title' in r['className']) or r['id'] == 'contact-submit'))]
    require(not allowed_red, '意図しない赤: ' + json.dumps(allowed_red, ensure_ascii=False))
    content_width = min(980, width - 32)
    main = one(metrics, '#profile-content' if kind == 'profile' else '#contact-content')
    require(near(main['box']['width'], content_width), f'本文幅{content_width}')
    if kind == 'profile':
        findings.extend(check_profile(metrics, item, content_width))
    else:
        findings.extend(check_contact(metrics, item, content_width))
    return findings


def check_profile(metrics, item, content_width):
    findings = []
    width, scenario = item['width'], item['scenario']

    def require(condition, message):
        if not condition:
            findings.append(message)

    photo = one(metrics, '#profile-photo')
    body = one(metrics, '.profile-body')
    entry = one(metrics, '.profile-contact-entry')
    button = one(metrics, '.profile-contact-entry a')
    expected_state = {'loading': 'loading', 'error': 'error'}.get(scenario, 'ready')
    require(metrics['state'] == expected_state, f'state={metrics["state"]}（期待 {expected_state}）')
    require(metrics['busy'] == ('true' if scenario == 'loading' else 'false'), 'aria-busy')
    # 名前と依頼の入口は固定の文字で、どの状態でも出る。
    name, romaji = one(metrics, '.profile-name h2'), one(metrics, '.profile-name p')
    require(name['visible'] and name['fontSize'] == '28px' and name['lineHeight'] == '42px', '名前28/42')
    require(romaji['visible'] and romaji['fontSize'] == '14px' and romaji['lineHeight'] == '22px' and romaji['color'] == 'rgb(102, 102, 102)', '英字14/22・muted')
    require(entry['visible'] and near(entry['box']['width'], body['box']['width']), '依頼の入口の幅が内容と同じ')
    require(near(entry['box']['height'], 130, 4), f'依頼の入口の高さ130前後（{entry["box"]["height"]}）')
    require(entry['background'] == PAPER_DEEP, '依頼の入口の面はgray-100')
    require(button['visible'] and button['box']['width'] < entry['box']['width'] - 40, 'Contactへは中身の幅（全幅にしない）')
    # 写真の有無。
    photo_expected = scenario in ['base', 'extra-links', 'no-links', 'loading']  # broken-photoは読み込めず枠ごと消える
    require(photo['visible'] == photo_expected, f'写真の枠の表示={photo["visible"]}（期待 {photo_expected}）')
    if photo['visible'] and scenario != 'loading':
        if width > 820:
            require(near(photo['box']['width'], 364) and near(photo['box']['height'], 455), f'写真364x455（{photo["box"]["width"]}x{photo["box"]["height"]}）')
            expected_body = min(560, content_width - 364 - 56)  # flex: 1 1 0。1440は560、それ以外は残り
            require(near(body['box']['width'], expected_body), f'内容の幅{expected_body}（{body["box"]["width"]}）')
            require(near(body['box']['x'] - photo['box']['right'], 56), '写真と内容の間隔56')
        else:
            require(near(photo['box']['width'], width - 32) and near(photo['box']['height'], width - 32), '写真は幅いっぱいの正方形')
            require(near(body['box']['width'], width - 32), '内容の幅いっぱい')
            require(near(body['box']['y'] - photo['box']['bottom'], 24), '写真と内容の間隔24')
    if not photo['visible'] and width > 820:
        require(near(body['box']['width'], content_width), '写真なしは内容が幅いっぱい')
    # 文章・links・状態。
    text, block = one(metrics, '#profile-text'), one(metrics, '#profile-links-block')
    chips = visible_items(metrics, '.profile-link-list a')
    if scenario in ['base', 'extra-links', 'no-photo', 'broken-photo']:
        require(text['visible'] and text['fontSize'] == '16px' and text['lineHeight'] == '26px' and text['whiteSpace'] == 'pre-wrap', '文章16/26・pre-wrap')
        require(text['textLines'] >= TEXT_NONBLANK_LINES, f'文章の行数（登録の改行が保たれる。{text["textLines"]}、期待 {TEXT_NONBLANK_LINES} 以上）')
        require(block['visible'] and chips, 'linksが出る')
    if scenario in ['base', 'no-photo', 'broken-photo']:
        require(len(chips) == 5, f'links 5件（{len(chips)}）')
    if scenario == 'extra-links':
        require(len(chips) == 7, f'links 7件（{len(chips)}）')
    for chip in chips:
        require(near(chip['box']['height'], 38) or width <= 360, f'チップの高さ38（{chip["box"]["height"]}）')
        require(chip['background'] == PAPER_DEEP, 'チップの面')
    if scenario in ['no-links', 'error', 'loading']:
        require(not block['visible'], 'linksの見出しごと出さない')
    if scenario == 'empty-profile':
        # profileのデータが空でもSiteのlinksがあれば出す（R45-06・T45-PROF-STATE）。
        require(block['visible'] and chips, 'Siteのlinksは出る')
    if scenario in ['empty-profile', 'error', 'loading']:
        require(not text['visible'], '文章を出さない')
    status = visible_items(metrics, '#profile-state [role="status"]')
    require(bool(status) == (scenario == 'loading'), '読み込み中の表示')
    if status:
        require(status[0]['background'] == PAPER_DEEP and status[0]['text'] == '読み込み中', '読み込み中は淡い面')
    retry = visible_items(metrics, '#profile-state button')
    require(bool(retry) == (scenario == 'error'), '再読込ボタン')
    if scenario == 'error':
        require(retry[0]['text'] == 'もう一度読み込む' and 'プロフィールを読み込めませんでした。' in one(metrics, '#profile-state')['text'], '失敗の知らせ')
    return findings


def check_contact(metrics, item, content_width):
    findings = []
    width, scenario, steps = item['width'], item['scenario'], item['steps']

    def require(condition, message):
        if not condition:
            findings.append(message)

    form, submit = one(metrics, '#contact-form'), one(metrics, '#contact-submit')
    expected_settings = {'loading': 'loading', 'contact-unreadable': 'fallback'}.get(scenario, 'ready')
    require(metrics['state'] == expected_settings, f'data-settings={metrics["state"]}（期待 {expected_settings}）')
    require(metrics['busy'] == ('true' if scenario == 'loading' else 'false'), 'aria-busy')
    done = 'wait-done' in steps
    expected_form_width = 560 if width > 820 else width - 32
    if not done:
        require(form['visible'] and near(form['box']['width'], expected_form_width), f'フォーム幅{expected_form_width}（{form["box"]["width"]}）')
        for selector in ['#name', '#email']:
            control = one(metrics, selector)
            require(near(control['box']['height'], 52), f'{selector}の高さ52（{control["box"]["height"]}）')
        require(one(metrics, '#message')['box']['height'] >= 134, '内容の欄は136以上')
        for field in visible_items(metrics, '.contact-field label'):
            require(field['fontSize'] == '14px' and field['lineHeight'] == '22px', 'ラベル14/22')
        labels, controls = visible_items(metrics, '.contact-field label'), [one(metrics, s) for s in ['#name', '#email', '#message']]
        for label, control in zip(labels, controls):
            require(near(control['box']['y'] - label['box']['bottom'], 6, 1), f'ラベルと入力欄の間隔6（{control["box"]["y"] - label["box"]["bottom"]}）')
        require(submit['background'] == ACCENT, '送信ボタンの背景だけがaccent')
        require(near(submit['box']['height'], 46), f'送信ボタンの高さ46（{submit["box"]["height"]}）')
        if width > 820:
            require(near(submit['box']['x'], form['box']['x'], 1) and submit['box']['width'] < form['box']['width'] - 40, '送信ボタンは中身に合わせた幅で左寄せ')
        else:
            require(near(submit['box']['width'], form['box']['width']), '送信ボタンは幅いっぱい')
    intro = one(metrics, '#contact-intro')
    if scenario == 'loading':
        require(intro['visible'] and intro['text'] == '読み込み中' and intro['background'] == PAPER_DEEP, '導入文の場所は淡い面に読み込み中')
        require(submit['disabled'], '設定の読み込み中は送信できない')
    elif not done:
        require(not submit['disabled'] or 'wait-sending' in steps, '送信ボタンは押せる')
        require(intro['visible'] and intro['fontSize'] == '14px' and intro['color'] == 'rgb(102, 102, 102)', '導入文14/22・muted')
    errors = visible_items(metrics, '.contact-error')
    if 'fill-bad-email' in steps:
        require(len(errors) == 1 and errors[0]['text'] == 'e-mailの形式を確認してください。' and errors[0]['color'] == INK, 'e-mailの誤りの文は--ink')
        email = one(metrics, '#email')
        require(email['ariaInvalid'] == 'true' and email['borderColor'] == INK and email['borderWidth'] == '1px', '誤りのある欄の枠は--inkの1px')
        require(metrics['activeId'] == 'email', '最初の誤りの欄へfocus')
        require(metrics['submitState'] == 'invalid', 'submit-state=invalid')
    elif steps == ['click-submit']:
        require([e['text'] for e in errors] == ['名前を入力してください。', 'e-mailを入力してください。', '内容を入力してください。'], '必須欄が空の時の3つの文')
        require(all(e['color'] == INK for e in errors) and metrics['activeId'] == 'name', '誤りの文は--ink、先頭の欄へfocus')
    else:
        require(not errors, '誤りの文が出ない')
    if 'wait-sending' in steps:
        require(submit['disabled'] and submit['text'] == '送信しています…' and submit['opacity'] == '0.4', '送信中: 押せない・.4')
        require(all(one(metrics, s)['readOnly'] for s in ['#name', '#email', '#message']), '送信中は3項目がreadonly')
        require(metrics['submitState'] == 'sending', 'submit-state=sending')
    if 'wait-failed' in steps:
        failure = one(metrics, '#contact-failure')
        require(failure['visible'] and failure['background'] == PAPER_DEEP and failure['color'] == INK, '失敗の知らせはgray-100・--ink')
        require(submit['text'] == 'もう一度送信する' and not submit['disabled'] and submit['background'] == ACCENT, '失敗後のボタン')
        require(metrics['activeId'] == 'contact-submit', '失敗後のfocusは送信ボタン')
    if done:
        sent = visible_items(metrics, '.contact-sent-row')
        require(len(sent) == 3, '送った内容が3行')
        require(not form['visible'] and not intro['visible'], '導入文とフォームは隠れる')
        heading = one(metrics, '#contact-done h2')
        require(heading['visible'] and heading['text'] == '送信しました。' and heading['fontSize'] == '20px' and heading['lineHeight'] == '30px', '完了の見出し20/30')
        require(all(r['whiteSpace'] == 'pre-wrap' and r['fontSize'] == '14px' for r in sent), '送った内容14/22・pre-wrap')
        require(one(metrics, '.contact-sent')['background'] == PAPER_DEEP, '送った内容は淡い面')
        link = one(metrics, '#contact-done a')
        require(link['text'] == 'Home →', 'Home →')
    if 'hover-submit' in steps:
        require(submit['transform'] == 'none' and submit['boxShadow'] == 'none', 'hoverで持ち上げ・影なし')
    if 'focus-email' in steps:
        email = one(metrics, '#email')
        require(email['outlineColor'] == INK and email['outlineWidth'] == '2px' and email['boxShadow'] == 'none', 'focusは--inkの輪郭で影なし')
    return findings


def run_capture(browser, results, font_files, item, png):
    kind, scenario, width = item['kind'], item['scenario'], item['width']
    if kind == 'smoke':
        fixture = json.loads((ROOT / item['fixture']).read_text(encoding='utf-8'))
        data, scenario_info = copy.deepcopy(fixture['data']), {}
        meta = fixture.get('meta', FIXTURE['meta'])
    else:
        data, scenario_info = scenario_data(scenario)
        meta = FIXTURE['meta']
    height = 844 if width <= 390 else 900
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    blocked, production_requests, form_requests, failed_scripts, pageerrors, console_errors, pending, expected_failures = [], [], [], [], [], [], [], []
    page.on('pageerror', lambda error: pageerrors.append(str(error)))
    page.on('console', lambda msg: console_errors.append({'text': msg.text, 'url': msg.location.get('url', '')}) if msg.type == 'error' else None)
    page.on('response', lambda response: failed_scripts.append({'url': response.url, 'status': response.status}) if response.request.resource_type == 'script' and response.status >= 400 else None)
    page.on('requestfailed', lambda request: failed_scripts.append({'url': request.url, 'failure': request.failure}) if request.resource_type == 'script' else None)

    def intercept(request_route):
        request = request_route.request
        parsed = urlparse(request.url)
        host = parsed.hostname or ''
        if host == PRODUCTION_FORM_HOST or host.endswith('.' + PRODUCTION_FORM_HOST):
            production_requests.append(request.url)  # 本番の送信先。必ず0件でなければならない
            request_route.abort()
        elif host == FORM_HOST:
            form_requests.append({'method': request.method, 'host': host})
            mode = item['submit']
            if mode == 'pending':
                pending.append(request_route)
            elif mode == 'network-error':
                expected_failures.append(request.url)
                request_route.abort()
            elif mode == 'http-error':
                expected_failures.append(request.url)
                request_route.fulfill(status=500, content_type='application/json', body='{}', headers={'Access-Control-Allow-Origin': '*'})
            else:
                request_route.fulfill(status=200, content_type='application/json', body='{}', headers={'Access-Control-Allow-Origin': '*'})
        elif request.url in font_files:
            content, content_type = font_files[request.url]
            request_route.fulfill(body=content, content_type=content_type)
        elif parsed.path == '/api/public/site-data':
            if scenario_info.get('response') == 'pending':
                pending.append(request_route)
                return
            status = scenario_info.get('status', 200) if scenario_info.get('response') == 'http-error' else 200
            if status != 200:
                expected_failures.append(request.url)
            request_route.fulfill(status=status, content_type='application/json', body=json.dumps({'data': data, 'meta': meta}),
                                  headers={'Access-Control-Allow-Origin': '*'})
        elif host in ['localhost', '127.0.0.1'] and parsed.port == 8888:
            if parsed.path == '/favicon.ico':
                request_route.fulfill(status=204, body='')
            elif 'synthetic-profile' in parsed.path:
                request_route.fulfill(body=png, content_type='image/png')
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
        page.clock.install(time=CLOCK_SECONDS)
        page.goto(BASE + item['route'], wait_until='domcontentloaded')
        if kind == 'profile':
            wanted = {'loading': 'loading', 'error': 'error'}.get(scenario, 'ready')
            page.wait_for_function('(s)=>document.querySelector("#profile-content").dataset.state===s', arg=wanted)
        elif kind == 'contact':
            wanted = {'loading': 'loading', 'contact-unreadable': 'fallback'}.get(scenario, 'ready')
            page.wait_for_function('(s)=>document.querySelector("#contact-content").dataset.settings===s', arg=wanted)
        if scenario_info.get('response') != 'pending':
            page.wait_for_load_state('networkidle')
        page.evaluate('document.fonts.ready')
        if scenario != 'broken-photo':
            page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        else:
            page.wait_for_function('document.querySelector("#profile-photo").hidden===true')
        for step in item['steps']:
            if step in ('fill', 'fill-bad-email'):
                page.fill('#name', SYNTHETIC_VALUES['name'])
                page.fill('#email', 'example@' if step == 'fill-bad-email' else SYNTHETIC_VALUES['email'])
                page.fill('#message', SYNTHETIC_VALUES['message'])
            elif step == 'click-submit':
                page.click('#contact-submit')
            elif step == 'wait-sending':
                page.wait_for_function('document.querySelector("#contact-form").dataset.submitState==="sending"')
            elif step == 'wait-done':
                page.wait_for_function('document.querySelector("#contact-form").dataset.submitState==="done"')
            elif step == 'wait-failed':
                page.wait_for_function('document.querySelector("#contact-form").dataset.submitState==="failed"')
            elif step == 'focus-email':
                page.keyboard.press('Tab')
                page.locator('#email').focus()
            elif step == 'hover-submit':
                page.hover('#contact-submit')
            elif step == 'hover-chip':
                page.hover('.profile-link-list a')
            elif step == 'menu':
                page.locator('.nav-toggle').click()
                assert page.locator('#global-nav').is_visible()
            else:
                raise ValueError('unknown step ' + step)
        if not any(step in ('hover-submit', 'hover-chip', 'focus-email', 'menu') for step in item['steps']) and not item['steps']:
            page.evaluate('window.scrollTo(0,0)')
        selectors = {'profile': PROFILE_SELECTORS, 'contact': CONTACT_SELECTORS, 'smoke': SMOKE_SELECTORS}[kind]
        metrics = page.evaluate(METRICS_JS, selectors)
        findings = check_metrics(metrics, item)
        if 'wait-failed' in item['steps'] or 'fill' in item['steps'] or 'wait-sending' in item['steps']:
            values = page.evaluate('()=>({name:document.querySelector("#name").value,email:document.querySelector("#email").value,message:document.querySelector("#message").value})')
            if 'fill-bad-email' not in item['steps'] and values != SYNTHETIC_VALUES:
                findings.append('入力が1文字も変わらず残っていない: ' + json.dumps(values, ensure_ascii=False))
        if 'wait-done' in item['steps']:
            sent = page.locator('.contact-sent-row').all_inner_texts()
            expected = ['名前　' + SYNTHETIC_VALUES['name'], 'e-mail　' + SYNTHETIC_VALUES['email'], '内容　' + SYNTHETIC_VALUES['message']]
            if sent != expected:
                findings.append('送った内容が文字として出ていない')
            if not page.evaluate('()=>document.activeElement&&document.activeElement.tagName==="H2"'):
                findings.append('完了後のfocusが見出しにない')
        if scenario == 'contact-unreadable':
            if page.locator('#contact-intro').inner_text().strip() == '' or page.locator('#contact-failure').is_visible():
                findings.append('設定を読めない時は埋め込みの導入文のまま、知らせは出さない')
        if kind == 'contact' and scenario == 'base' and 'wait-failed' not in item['steps'] and 'wait-done' not in item['steps'] and 'wait-sending' not in item['steps']:
            if page.locator('#contact-form').get_attribute('action') != FIXTURE['data']['contact']['formAction']:
                findings.append('フォームのactionが設定（fixture）と一致しない')
        if production_requests:
            findings.append(f'本番の送信先へのrequestが{len(production_requests)}件（0件でなければならない）')
        page.screenshot(path=str(SHOTS / item['file']), full_page=item['full'])
        errors = [entry for entry in console_errors if entry['url'] not in blocked + expected_failures and not any(url in entry['url'] for url in blocked)]
        row = {'image': 'screenshots/' + item['file'], 'kind': kind, 'scenario': scenario, 'width': width, 'route': item['route'], 'steps': item['steps'],
               'metrics': metrics, 'findings': findings, 'production_form_requests': len(production_requests),
               'fixture_form_requests': form_requests, 'blocked_external_requests': blocked, 'expected_failed_requests': expected_failures,
               'console_errors': console_errors, 'unexpected_console_errors': errors, 'pageerrors': pageerrors, 'failed_scripts': failed_scripts}
        results['captures'].append(row)
        (OUT / 'capture-profile-contact-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if findings or pageerrors or failed_scripts:
            results.setdefault('failed_captures', []).append({k: row[k] for k in ['image', 'findings', 'pageerrors', 'failed_scripts']})
            print('FAIL', json.dumps(results['failed_captures'][-1], ensure_ascii=False), flush=True)
        else:
            print(item['file'], flush=True)
    finally:
        for request_route in pending:
            try:
                request_route.abort()
            except Exception:
                pass
        pending.clear()
        context.unroute_all(behavior='wait')
        context.close()


def check_contract():
    """ブラウザもbindも使わない契約の検査。画像名の重複・件数・fixtureの形・架空の値だけを確かめる。"""
    plan = build_plan()
    names = [item['file'] for item in plan]
    assert len(names) == len(set(names)), '画像名が重複している'
    required = {f'profile-{w}-{p}.png' for w in WIDTHS for p in ['first', 'full']}
    required |= {f'{prefix}-{w}.png' for w in WIDTHS for prefix in ['profile-no-photo', 'profile-photo-broken', 'profile-error', 'profile-loading',
                                                                        'profile-links-extra', 'profile-no-links', 'profile-empty', 'contact', 'contact-filled',
                                                                        'contact-invalid', 'contact-empty', 'contact-sending', 'contact-done', 'contact-failed',
                                                                        'contact-loading', 'contact-fallback', 'contact-focus']}
    required |= {'contact-hover-submit-1440.png', 'profile-hover-chip-1440.png', 'menu-profile-390-open.png', 'menu-contact-390-open.png',
                 'smoke-home-390.png', 'smoke-music-390.png', 'smoke-live-390.png'}
    required |= {f'{p}-{w}.png' for p in ['profile', 'contact'] for w in [821, 1024, 360]}
    assert required == set(names), sorted(required ^ set(names))
    assert set(FIXTURE) == {'meta', 'data', 'scenarios'}
    text = FIXTURE_PATH.read_text(encoding='utf-8')
    assert not re.search(r'formspree|https?://(?!(?:[\w.-]+\.)?example\.test)', text), 'fixtureに架空でないhost/URLがある'
    for name in ['base', 'no-photo', 'broken-photo', 'empty-text', 'no-links', 'site-links-only', 'profile-links-only', 'extra-links', 'empty-profile',
                 'bad-profile', 'error', 'loading', 'contact-empty-settings', 'contact-unreadable']:
        scenario_data(name)
    assert FIXTURE['data']['contact']['formAction'].startswith(f'https://{FORM_HOST}/')
    assert len(FIXTURE['data']['site']['links']) == 5 and len(FIXTURE['data']['profile']['links']) == 4
    assert FIXTURE['data']['profile']['image'].split('.')[-1].isupper(), '写真は大文字拡張子の相対path'
    assert len(synthetic_png(40, 50)) > 100
    for item in plan:
        for step in item['steps']:
            assert step in {'fill', 'fill-bad-email', 'click-submit', 'wait-sending', 'wait-done', 'wait-failed', 'focus-email', 'hover-submit', 'hover-chip', 'menu'}, step
    print(f'契約OK: {len(names)}画像 / {len(FIXTURE["scenarios"])}シナリオ（ブラウザ・bindなし）', flush=True)


def capture_all(args):
    from playwright.sync_api import sync_playwright
    SHOTS.mkdir(exist_ok=True)
    font_files, font_manifest = cached_fonts()
    results = {'ui_route': UI_ROUTE, 'fixture': 'test/fixtures/profile-contact-states.json',
               'fixture_sha256': hashlib.sha256(FIXTURE_PATH.read_bytes()).hexdigest(),
               'expected_images': expected_images(), 'captures': [], 'font_cache': font_manifest,
               'font_acceptance': '同版cacheがない場合はfallback。文字・折返しの最終受入は未確認（fallback fontの画素一致は合格にしない）。',
               'visual_review': '未実施。Frontが全画像をFigma v2と照合する。renderとの画素比較はない。',
               'production_data': '未実施（Frontが別に行う）。Contactの本番の送信は試さない。', 'status': 'running'}
    server = None
    png = synthetic_png()
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
            for item in build_plan():
                run_capture(browser, results, font_files, item, png)
            browser.close()
        actual = [Path(row['image']).name for row in results['captures']]
        assert not results.get('failed_captures'), f"不合格の画像が{len(results['failed_captures'])}枚"
        assert sorted(actual) == sorted(expected_images()), '撮影名/件数が契約と不一致'
        assert all(row['production_form_requests'] == 0 for row in results['captures']), '本番の送信先へのrequestがある'
        results['status'] = 'captured; visual/font acceptance pending'
        print(f'{len(actual)}画像。自動metrics確認済み。本番の送信先へのrequestは全件0。全画像目視・font・本番データは別の受入。', flush=True)
    except Exception:
        results['status'] = 'visual_acceptance_pending'
        results['failure'] = traceback.format_exc(limit=3)
        traceback.print_exc()
        raise
    finally:
        (OUT / 'capture-profile-contact-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if server:
            server.shutdown()
            server.server_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serve', action='store_true', help='127.0.0.1:8888で公開HTML/assetsだけを配信してから撮影する')
    parser.add_argument('--chromium', help='既存Chromiumの実行ファイル（download/installしない）')
    parser.add_argument('--self-check', action='store_true', help='ブラウザもbindも使わず契約だけ検査する')
    args = parser.parse_args()
    if args.self_check:
        check_contract()
        return
    log = (OUT / 'capture-profile-contact.log').open('w', buffering=1, encoding='utf-8')

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
        check_contract()
        capture_all(args)
    finally:
        sys.stdout, sys.stderr = stdout, stderr
        log.close()


if __name__ == '__main__':
    main()
