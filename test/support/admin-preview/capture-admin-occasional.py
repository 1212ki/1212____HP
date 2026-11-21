"""管理画面（上の帯・5タブ・News・Music・Site・Profile・接続失敗・Local Mode）の撮影（Issue #47 段2〜6。撮影2まで）。Front用。架空のAPIと架空のfixtureだけを使う。

execution target（worktreeのroot）で、1行で全画面を撮る:
  /usr/bin/python3 test/support/admin-preview/capture-admin-occasional.py
--only <部分文字列> でファイル名に一致する画面だけを、--width 821,900,1011 でその幅だけを撮り直せる。--chromium は入っている実行ファイルだけを指定する（download・installしない）。
--self-check はブラウザもbindも使わず、契約（画像名・scenario・架空の値・合否の関数）だけを検査する。
画面（Requirements §5 の P47-01〜11。P47-12＝Liveの#46との比較は capture-admin-live.py を Front が実行して比べる）:
- 上の帯と5タブ（幅390・360・1440。接続中・Local Mode・接続失敗）、API接続失敗と Local Mode の5タブ（幅390・1440）。
- News・Music 作品・Music 映像は全幅（390・360・1440と、2列になる 821・900・1011）× 全状態。Site・Profile は幅390・360・1440 × 全状態。
- 状態: Requirements §3 の S47-01〜20（保存の4状態・確認の面・削除の確認・画像・空の一覧・未選択・新規・日付と映像IDの誤り・保存と削除の失敗・参照が戻ること・
  接続失敗・Local Mode・Channel URL・長い値）。名前は {画面}-{状態}-{幅}.png。撮影1と段3・4の82枚は同じ名前のまま残している。

仕組み（計画 §6）:
- 静的配信のserverもbindも要らない。context.route が、管理画面に必要なファイル（admin/index.html・app.js・style.css、assets/css・assets/js）だけを
  repoから応える（admin/config.js・admin/data・.git・他は配らない）。--base は応えるページの見かけの配信元（既定 http://127.0.0.1:8080）。
  Frontが `python3 -m http.server 8080 --bind 127.0.0.1` を起動していても、このscriptは使わない（全requestをrouteが応える）。
- admin/config.js は実ファイルを読まず、架空の設定（apiBaseUrl: https://api.fixture.test、架空の合言葉）で応える。
- https://api.fixture.test/** は fake_admin_api.py が応える（メモリ上の架空のデータ test/fixtures/admin-occasional-states.json）。
  管理画面の adminFetch は 401・403・404・5xx を受けると本番のAPIへ切り替えて再送する作りなので、架空のAPIはこれらを返さない。
  API接続失敗は 400、保存・削除の失敗は PUT の 400 で作る。https://img.example.test/** と assets/images/** は架空の画像を応える。
- それ以外のhostはすべて abort して一覧を記録する。**撮影の終わりに、api.fixture.test と 127.0.0.1 以外へのrequestが0件、本番のhost
  （*.workers.dev・1212hp.com ほか）への通信が0件であることを検査し、違えば失敗にする**（font の取得だけは遮断して数えない）。
- 時計は page.clock.install(time=...)（秒）で固定する。
- 画面 × 幅 × 状態を1枚ずつ撮り、各枚の構造・実測（metrics）を検査する。**不合格があっても最後まで撮り、末尾でまとめて失敗（exit 1）にする。**
- 行数は文字 node の Range.getClientRects の行で数える（要素の高さで判断しない）。
画像は <出力先>/screenshots/、metrics は capture-admin-occasional-metrics.json、log は capture-admin-occasional.log。出力先は repo の外
（既定は一時directoryの admin-occasional-capture/。環境変数 ADMIN_CAPTURE_OUT で変える。repo の中は拒む）。
撮影画像の全件目視・Figma v2との比較・本番の公開データでの画面確認は Front と Itsuki が別に行う（このscriptは画素を比べない）。
"""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
import tempfile
import traceback
from urllib.parse import unquote, urlparse

sys.dont_write_bytecode = True  # verification/ に __pycache__ を作らない
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fake_admin_api as fake  # noqa: E402
import fake_admin_server as hand  # noqa: E402

ROOT = fake.ROOT
FIXTURE_PATH = fake.OCCASIONAL_FIXTURE_PATH
FIXTURE = fake.load_fixture(FIXTURE_PATH)
FIXTURE_BYTES = FIXTURE_PATH.read_bytes()


def output_directory():
    """画像・実測・log は repo の外に書く。repo の中を指されたら拒む（repo に未追跡のファイルを作らない）。"""
    out = Path(os.environ.get('ADMIN_CAPTURE_OUT') or (Path(tempfile.gettempdir()) / 'admin-occasional-capture')).resolve()
    if out == ROOT or ROOT in out.parents:
        raise SystemExit(f'ADMIN_CAPTURE_OUT は repo の外にしてください（{out}）')
    return out


OUT = output_directory()
SHOTS = OUT / 'screenshots'
METRICS_PATH = OUT / 'capture-admin-occasional-metrics.json'
LOG_PATH = OUT / 'capture-admin-occasional.log'
UI_ROUTE = 'ui_route=headless_acceptance:ADM-47-05,ADM-47-06,ADM-47-09,ADM-47-12,ADM-47-13'
DEFAULT_BASE = 'http://127.0.0.1:8080'
CLOCK_SECONDS = int(datetime(2026, 11, 21, 3, 0, 0, tzinfo=timezone.utc).timestamp())  # Python Playwrightの数値単位は秒
API_HOST = urlparse(fake.API_ORIGIN).hostname
IMAGE_HOST = fake.FAKE_IMAGE_HOST
FIXTURE_IMAGE_HOSTS = {IMAGE_HOST, 'img.youtube.com'}
FONT_HOSTS = {'fonts.googleapis.com', 'fonts.gstatic.com'}
PRODUCTION_SUFFIXES = ('.workers.dev', '1212hp.com', 'openai.com', 'anthropic.com', 'twitter.com', 'x.com', 'cloudflare.com', 'github.com')
FIVE_TABS = ['Site', 'News', 'Live', 'Music', 'Profile']
FIVE_TAB_KEYS = ['site', 'news', 'live', 'music', 'profile']
NARROW, SMALL, WIDE = 390, 360, 1440
MID_WIDTHS = [821, 900, 1011]          # 2列になる画面（News・Music）の中間の幅。900px未満は1列、900px以上は2列（計画 §6）
WIDTHS = [NARROW, WIDE]                # 撮影1の幅（段2〜4の画面の名前は幅390・1440のまま残す）
PAGE_WIDTHS = [NARROW, SMALL, WIDE]    # 1画面の画面（上の帯・Site・Profile）の幅
LIST_WIDTHS = [NARROW, SMALL, *MID_WIDTHS, WIDE]  # 一覧→編集の画面（News・Music）の全幅
ALL_WIDTHS = sorted({*PAGE_WIDTHS, *LIST_WIDTHS})
HEIGHT_AT = {SMALL: 780, NARROW: 844, 821: 1180, 900: 1000, 1011: 900, WIDE: 900}  # 撮影のviewportの高さ（390・1440は撮影1と同じ）
TAP_MIN = 44


def band_height(width, local=False):
    """幅ごとの上の帯の高さ（Figma 44:494 / 47:584。Tabs は 44:497 / 47:587）。899px以下が46・49、900px以上が62・53。±1px。
    Local Mode は「JSONを書き出す」を置いた結果の値（Figma 223:924 / 223:962）で 56・64。ADM-47-13 の実測は接続中の高さ。"""
    if local:
        return 64 if width >= 900 else 56
    return 62 if width >= 900 else 46


def tabs_height(width):
    return 53 if width >= 900 else 49

NEWS_ID = 'fx-news-2'      # 題に二重引用符を含む
NEWS_OTHER_ID = 'fx-news-3'
LIVE_ID = 'fx-live-up'
WORK_ID = 'fx-release-a'   # 顔にする作品で、その場で再生する映像を持つ作品（題に二重引用符）
WORK_OTHER_ID = 'fx-release-b'
VIDEO_ID = 'yt-musicVideos-fixture-1'   # 作品が再生する映像
LONG_NEWS_ID = FIXTURE['variants']['longValues']['news'][0]['id']                        # 長い題・説明を持つお知らせ（scenario long-values）
LONG_WORK_ID = FIXTURE['variants']['longValues']['discography']['digital'][0]['id']      # 長い題の作品（scenario long-values）

# Music・Site・Profile は News と同じ作り: 一覧・編集の箱、状態・理由・「保存して公開」。Site・Profile・Channel URL は1画面（見出しの行に状態とボタン）。
MUSIC_BOXES = ['#music-master-detail', '#music-list-pane', '#music-editor-pane', '#music-editor-bar', '#music-editor-card', '#music-editor-heading',
               '#music-editor-actions', '#music-save-btn', '#music-editor-error', '#music-editor-status', '#music-editor-status-wide', '#music-editor-empty',
               '#music-delete-btn', '#music-editor-back', '#music-add-btn', '.occ-music-top', '.occ-switch', '#music-switch-works', '#music-switch-videos',
               '#music-channel-panel', '#music-channel-heading', '#channel-editor-actions', '#channel-save-btn', '#channel-editor-status', '#channel-editor-error',
               '#youtube-channel-url']
PAGE_BOXES = ['#site-tab', '.occ-page-head', '.occ-page-title', '#site-editor-actions', '#site-save-btn', '#site-editor-status', '#site-editor-error',
              '#profile-tab', '#profile-heading', '#profile-editor-actions', '#profile-save-btn', '#profile-editor-status', '#profile-editor-error',
              '#profile-link-add-btn', '#profile-links-list']
BOX_SELECTORS = ['.header', '.tab-nav', '.connection-banner', '#news-master-detail', '#news-list-pane', '#news-editor-pane', '#news-editor-bar',
                 '#news-editor-card', '#news-editor-heading', '#news-editor-actions', '#news-save-btn', '#news-editor-error', '#news-editor-status',
                 '#news-editor-status-wide', '#news-editor-empty', '#news-delete-btn', '#news-editor-back', '#news-add-btn', '#live-editor-pane',
                 '#live-master-pane', '#saveBtn', '#modeBadge', '#live-dialog'] + MUSIC_BOXES + PAGE_BOXES
TEXT_SELECTORS = ['#modeBadge', '#connectionBanner', '#news-editor-heading', '#news-editor-title', '#news-editor-status', '#news-editor-status-wide',
                  '#news-editor-error', '#news-editor-empty', '#news-list', '#news-save-btn', '#saveBtn', '#live-dialog', '#live-editor-heading',
                  '#edit-image-status', '#news-delete-btn',
                  '#music-editor-heading', '#music-editor-title', '#music-editor-status', '#music-editor-status-wide', '#music-editor-error', '#music-editor-empty',
                  '#music-works-list', '#music-videos-list', '#music-list-title', '#music-delete-btn', '#channel-editor-status', '#channel-editor-error',
                  '#site-editor-status', '#site-editor-error', '#profile-editor-status', '#profile-editor-error', '#profile-links-list',
                  '#edit-releaseDate-error', '#edit-youtube-error']
LINE_SELECTORS = ['#news-save-btn', '#news-editor-back', '#news-editor-title', '#news-editor-status', '#news-editor-status-wide', '#news-add-btn',
                  '#music-save-btn', '#music-editor-back', '#music-editor-title', '#music-editor-status', '#music-editor-status-wide', '#music-add-btn',
                  '#channel-save-btn', '#site-save-btn', '#profile-save-btn', '#profile-link-add-btn']
TAP_SELECTORS = ['.occ-row', '#news-add-btn', '#news-editor-back', '#news-save-btn', '#news-delete-btn', '.tab-nav .tab-btn', '#live-dialog .btn',
                 '#edit-image-select-btn', '#edit-image-clear-btn', '.live-row',
                 '.occ-switch-btn', '#music-add-btn', '#music-editor-back', '#music-save-btn', '#music-delete-btn', '#channel-save-btn', '#site-save-btn',
                 '#profile-save-btn', '#profile-link-add-btn', '.occ-link-delete', '#site-hero-image-select-btn', '#site-hero-image-clear-btn',
                 '#profile-image-select-btn', '#profile-image-clear-btn']
# API接続失敗（読み取り専用）で、各タブの「主な操作」は押せない・入力できない（見えている操作だけを検査する）。live は #46 の動き。
READ_ONLY_PRIMARY = {'news': 'news-add-btn', 'music': 'music-add-btn', 'site': 'site-footer-text', 'profile': 'profile-text', 'live': 'live-add-btn'}
READ_ONLY_OTHERS = {'news': ['edit-title', 'news-save-btn', 'news-delete-btn'], 'music': ['edit-title', 'music-save-btn', 'music-delete-btn', 'youtube-channel-url', 'channel-save-btn'],
                    'site': ['site-link-bandcamp', 'site-featured-release-id', 'site-save-btn'], 'profile': ['profile-link-add-btn', 'profile-save-btn'], 'live': []}
CONTROL_IDS = sorted({*READ_ONLY_PRIMARY.values(), *[i for ids in READ_ONLY_OTHERS.values() for i in ids]})
SITE_IDS = ['site-featured-release-id', 'site-link-bandcamp', 'site-link-youtube', 'site-link-x', 'site-link-instagram', 'site-link-note', 'site-footer-text',
            'contact-intro-text', 'contact-form-action']

METRICS_JS = r"""(cfg) => {
  const q = s => document.querySelector(s);
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  // 本当に見えている操作か: 閉じた折りたたみ・display:none や hidden の祖先の中にあるものは見えていない（撮影1の直しFIX3 b）。
  const shown = e => {
    if (!visible(e)) return false;
    if (typeof e.checkVisibility === 'function' && !e.checkVisibility({visibilityProperty: true, contentVisibilityAuto: true})) return false;
    for (let a = e; a && a !== document.documentElement; a = a.parentElement) {
      if (a.hidden) return false;
      if (a.tagName === 'DETAILS' && !a.open) { const summary = e.closest('summary'); if (!(summary && summary.parentElement === a)) return false; }
      const c = getComputedStyle(a);
      if (c.display === 'none' || c.contentVisibility === 'hidden') return false;
    }
    return true;
  };
  const box = e => { const b = e.getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom}; };
  // 行数は要素の高さではなく、文字nodeのRange.getClientRectsを行のtopごとに数える。
  const lines = e => {
    const tops = []; const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) if (r.width > 0 && !tops.some(t => Math.abs(t - r.top) < .5)) tops.push(r.top);
    }
    return tops.length;
  };
  const nameOf = e => {
    const labelledby = (e.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent.trim() || '').join(' ').trim();
    const label = e.labels && e.labels[0] ? e.labels[0].textContent.trim() : '';
    return (e.getAttribute('aria-label') || labelledby || label || (e.tagName === 'BUTTON' ? e.textContent.trim() : '') || e.getAttribute('title') || '').trim();
  };
  const out = {viewport: {width: innerWidth, height: innerHeight}, scrollWidth: document.documentElement.scrollWidth, bodyClasses: [...document.body.classList]};
  out.chrome = {header: visible(q('.header')), tabNav: visible(q('.tab-nav')), banner: visible(q('.connection-banner'))};
  out.tabs = [...document.querySelectorAll('.tab-nav .tab-btn')].map(b => b.textContent.trim());
  out.tabKeys = [...document.querySelectorAll('.tab-nav .tab-btn')].map(b => b.dataset.tab);
  out.activeTab = (q('.tab-nav .tab-btn.active') || {dataset: {}}).dataset.tab || '';
  out.visiblePanels = [...document.querySelectorAll('.tab-content')].filter(visible).map(e => e.id);
  out.badgeTitle = (q('#modeBadge') || {getAttribute: () => ''}).getAttribute('title') || '';
  out.boxes = {};
  for (const s of cfg.boxSelectors) { const e = q(s); if (e) { const c = getComputedStyle(e); out.boxes[s] = {visible: visible(e), ...box(e), disabled: !!e.disabled, opacity: c.opacity, position: c.position, display: c.display}; } }
  out.lines = {}; for (const s of cfg.lineSelectors) { const e = q(s); if (e) out.lines[s] = visible(e) ? lines(e) : 0; }
  out.taps = {};
  for (const s of cfg.tapSelectors) { const items = [...document.querySelectorAll(s)].filter(visible); if (items.length) out.taps[s] = {count: items.length, minHeight: Math.min(...items.map(e => e.getBoundingClientRect().height)), minWidth: Math.min(...items.map(e => e.getBoundingClientRect().width))}; }
  out.texts = {}; for (const s of cfg.textSelectors) { const e = q(s); if (e) out.texts[s] = visible(e) ? e.innerText.trim() : ''; }
  // 表示名の検査は、上の帯・Tabs・News・Music・Site・Profile・Live・確認の面。
  const scopes = ['.header', '.tab-nav', '#news-tab', '#live-tab', '#live-dialog-overlay', '#music-tab', '#site-tab', '#profile-tab'].map(s => q(s)).filter(Boolean);
  out.unnamed = scopes.flatMap(root => [...root.querySelectorAll('button,input,textarea,select')]).filter(e => visible(e) && !['hidden', 'file'].includes(e.type) && !nameOf(e)).map(e => ({tag: e.tagName, id: e.id, className: e.className}));
  out.rows = {count: document.querySelectorAll('#news-list .occ-row').length, selected: (q('#news-list .occ-row[aria-current="true"]') || {dataset: {}}).dataset.occId || '',
              firstText: ((q('#news-list .occ-row') || {}).innerText || '').replace(/\s+/g, ' ').trim()};
  out.fields = {};
  for (const id of ['edit-date', 'edit-title', 'edit-description', 'edit-image', 'edit-link', 'edit-linkText', 'edit-category', 'edit-releaseDate', 'edit-releaseType',
                    'edit-playbackVideoId', 'edit-youtube', 'youtube-channel-url', 'profile-text', ...cfg.siteIds]) { const e = document.getElementById(id); if (e) out.fields[id] = e.value; }
  const editorBodies = [...document.querySelectorAll('#news-editor-body, #music-editor-body')].filter(visible);
  out.fieldLabels = editorBodies.flatMap(root => [...root.querySelectorAll('label, .occ-field-label')]).filter(visible).map(e => e.textContent.trim());
  out.pageLabels = {site: [...document.querySelectorAll('#site-tab label, #site-tab .occ-field-label')].filter(visible).map(e => e.textContent.trim()),
                    profile: [...document.querySelectorAll('#profile-tab label, #profile-tab .occ-field-label')].filter(visible).map(e => e.textContent.trim())};
  out.pageHeadings = [...document.querySelectorAll('#site-tab .occ-panel-heading, #profile-tab .occ-panel-heading, #music-channel-heading')].filter(visible).map(e => e.textContent.trim());
  const listInfo = (id) => { const list = q(id); if (!list) return {visible: false, count: 0, selected: '', groups: [], firstText: ''};
    const rows = [...list.querySelectorAll('.occ-row')];
    return {visible: visible(list), count: rows.length, selected: (list.querySelector('.occ-row[aria-current="true"]') || {dataset: {}}).dataset.occId || '',
            groups: [...list.querySelectorAll('.occ-group-title')].map(e => e.textContent.trim()), thumbs: list.querySelectorAll('.occ-row-thumb').length,
            firstText: ((rows[0] || {}).innerText || '').replace(/\s+/g, ' ').trim(), empty: !!list.querySelector('.occ-empty')}; };
  out.lists = {works: listInfo('#music-works-list'), videos: listInfo('#music-videos-list')};
  out.switchState = {works: (q('#music-switch-works') || {getAttribute: () => ''}).getAttribute('aria-selected'), videos: (q('#music-switch-videos') || {getAttribute: () => ''}).getAttribute('aria-selected')};
  out.errors = {releaseDate: (q('#edit-releaseDate-error') || {}).textContent || '', releaseDateInvalid: (q('#edit-releaseDate') || {getAttribute: () => ''}).getAttribute('aria-invalid') || '',
                youtube: (q('#edit-youtube-error') || {}).textContent || '', youtubeInvalid: (q('#edit-youtube') || {getAttribute: () => ''}).getAttribute('aria-invalid') || ''};
  out.linkRows = document.querySelectorAll('#profile-links-list .occ-link-row').length;
  out.images = {};
  for (const id of ['site-hero-image', 'profile-image', 'edit-image']) { const input = document.getElementById(id); if (input) out.images[id] = {value: input.value, path: (document.getElementById(id + '-path') || {}).textContent || '', status: (document.getElementById(id + '-status') || {}).textContent || ''}; }
  // 接続失敗（読み取り専用）の画面で、入力・保存・追加・削除・画像が押せなくなっているか（cfg.controlIds の id ごと）
  out.controls = {};
  for (const id of (cfg.controlIds || [])) { const e = document.getElementById(id); out.controls[id] = e ? {visible: visible(e), disabled: !!e.disabled} : null; }
  out.dialogOpen = !!q('#live-dialog-overlay') && !q('#live-dialog-overlay').hidden;
  out.active = document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '';
  out.liveRows = [...document.querySelectorAll('.live-row')].filter(visible).length;
  out.liveEditing = !!(q('#live-editor-body') && q('#live-editor-body').children.length && q('#edit-date'));
  // 操作の上に、見えない（または別の）要素が残っていないか。各操作を画面の中央へ寄せ、中心の点で一番上にある要素が、その操作自身（か中身・label）かを見る。
  out.covered = [];
  if (!out.dialogOpen) {
    const root = q('.tab-content.active');
    // 見えていない欄（閉じた折りたたみの中・display:none や hidden の祖先・画面の外で scroll しても出ないもの）は相手にしない（FIX3 b）。
    const clipped = e => { const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a);
        if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { const b = a.getBoundingClientRect(); if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) return true; } }
      return false; };
    const targets = root ? [...root.querySelectorAll('button, input, textarea, select')].filter(e => shown(e) && e.type !== 'hidden' && e.type !== 'file' && getComputedStyle(e).pointerEvents !== 'none') : [];
    for (const e of targets) {
      e.scrollIntoView({block: 'center'});
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.height > window.innerHeight * 0.8 || r.bottom < 0 || r.top > window.innerHeight || clipped(e)) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const label = e.closest('label');
      // 保存・削除の失敗の直後に出る toast（#toast）は、#46 の Live と同じ動き（数秒で消え、理由は欄の上に1行出ている）なので相手にしない（FIX3 c）。
      if (!top || top === e || e.contains(top) || (label && label.contains(top)) || top.id === 'toast' || (top.closest && top.closest('#toast'))) continue;
      const name = x => (x.id ? '#' + x.id : '.' + String(x.className).split(' ')[0] || x.tagName);
      out.covered.push(name(e) + ' ← ' + name(top));
    }
    window.scrollTo(0, 0);
  }
  return out;
}"""


# ----------------------------------------------------------------------------------------------------------
# 撮影の計画（撮影1。画面 × 幅 × 状態）
# ----------------------------------------------------------------------------------------------------------
def build_plan():
    plan = []

    def add(screen, state, width, scenario='base', steps=(), hold=(), **extra):
        plan.append({'file': f'{screen}-{state}-{width}.png', 'screen': screen, 'state': state, 'width': width, 'height': HEIGHT_AT[width],
                     'scenario': scenario, 'steps': list(steps), 'hold': list(hold), **extra})

    def facet(prefix, kind, base, **extra):
        """撮影2で足した状態: 段2〜4の画面の合否の関数は使わず、その状態で見る所（kind）だけを検査する。base は見本の値の土台（screen, state）。"""
        return {'facet': kind, 'prefix': prefix, 'base': base, **extra}

    # 上の帯と5タブ: 5つのタブをそれぞれ開いた状態（接続中）。Local Mode と API接続失敗の上の帯。（P47-01。幅390・360・1440）
    for width in PAGE_WIDTHS:
        for key in FIVE_TAB_KEYS:
            add('chrome', key, width, steps=[] if key == 'live' else [('tab', key)], tab=key)
        add('chrome', 'local', width, scenario='local-mode')
        add('chrome', 'fallback', width, scenario='api-fallback')

    # API接続失敗（読み取り専用。5タブ）と Local Mode（5タブ）（P47-09・10。幅390・1440）。接続失敗は項目を開いても読める・触れない。Local Mode は保存して書き出し待ち。
    for width in WIDTHS:
        status_sel = '#news-editor-status-wide' if width >= 900 else '#news-editor-status'
        for key in FIVE_TAB_KEYS:
            steps = [] if key == 'live' else [('tab', key)]
            add('fallback', key, width, scenario='api-fallback', steps=steps, **facet(key, 'read-only', ('chrome', key), tab=key))
            add('local', key, width, scenario='local-mode', steps=steps, **facet(key, 'local-tab', ('chrome', key), tab=key))
        add('fallback', 'news-edit', width, scenario='api-fallback', steps=[('tab', 'news'), ('open-news', NEWS_ID)], **facet('news', 'read-only', ('news', 'edit'), tab='news', editing=True))
        add('fallback', 'works-edit', width, scenario='api-fallback', steps=[('tab', 'music'), ('open-work', WORK_ID)], **facet('music', 'read-only', ('music-works', 'edit'), tab='music', editing=True))
        add('local', 'news-saved', width, scenario='local-mode', steps=[('tab', 'news'), ('open-news', NEWS_ID), ('type', '#edit-title', 'ローカルで保存した題'), ('save',),
                                                                       ('wait-text', status_sel, 'JSON書き出し待ち')], **facet('news', 'local-saved', ('news', 'edit'), tab='news', editing=True))

    # News（一覧→編集。幅390・360は一覧と編集の2画面、幅900以上は2列、821は1列）（P47-02・11）
    for width in LIST_WIDTHS:
        open_news = [('tab', 'news'), ('open-news', NEWS_ID)]
        unsaved = open_news + [('type', '#edit-title', '未保存の題')]
        add('news', 'list', width, steps=[('tab', 'news')])
        add('news', 'empty', width, scenario='empty-lists', steps=[('tab', 'news')])
        add('news', 'edit', width, steps=open_news)
        add('news', 'unsaved', width, steps=unsaved)
        add('news', 'saving', width, steps=unsaved + [('save',)], hold=['put'])
        add('news', 'failed', width, scenario='save-fail', steps=unsaved + [('save',), ('wait-text', '#news-editor-error', '')])
        add('news', 'delete-confirm', width, steps=open_news + [('delete',)])
        add('news', 'leave-confirm', width, steps=unsaved + [('leave', NEWS_OTHER_ID)])
        add('news', 'new', width, steps=[('tab', 'news'), ('add-news',)])
        add('news', 'image-uploading', width, steps=open_news + [('start-image', 'edit-image'), ('wait-text', '#edit-image-status', 'アップロードしています')], hold=['upload'],
            **facet('news', 'image-uploading', ('news', 'unsaved'), image='edit-image', tab='news', editing=True))
        add('news', 'image-failed', width, steps=open_news + [('start-image', 'edit-image'), ('wait-text', '#edit-image-status', 'アップロードできませんでした')], extra_fail=['upload'],
            **facet('news', 'image-failed', ('news', 'edit'), image='edit-image', tab='news', editing=True))
        add('news', 'delete-failed', width, scenario='delete-fail', steps=open_news + [('delete',), ('confirm-delete',), ('wait-text', '#news-editor-error', '')],
            **facet('news', 'delete-failed', ('news', 'failed'), tab='news', editing=True, rows=6))
        add('news', 'long-values', width, scenario='long-values', steps=[('tab', 'news'), ('open-news', LONG_NEWS_ID)], **facet('news', 'long-values', ('news', 'edit'), tab='news', editing=True))

    # Live（上の帯の変更の確認用。一覧と、ライブを1つ開いた公開内容）
    for width in WIDTHS:
        add('live', 'list', width)
        add('live', 'open', width, steps=[('open-live', LIVE_ID)])

    # Music 作品（幅390・360は一覧と編集の別の画面、幅900以上は2列、821は1列）（P47-03・11）
    for width in LIST_WIDTHS:
        open_work = [('tab', 'music'), ('open-work', WORK_ID)]
        unsaved = open_work + [('type', '#edit-title', '未保存の作品名')]
        add('music-works', 'saving', width, steps=unsaved + [('save', '#music-save-btn')], hold=['put'], **facet('music', 'saving', ('music-works', 'unsaved'), tab='music', editing=True))
        add('music-works', 'leave-confirm', width, steps=unsaved + [('leave-music', WORK_OTHER_ID, 'release')], **facet('music', 'leave', ('music-works', 'unsaved'), tab='music', editing=True))
        add('music-works', 'image-uploading', width, steps=open_work + [('start-image', 'edit-image'), ('wait-text', '#edit-image-status', 'アップロードしています')], hold=['upload'],
            **facet('music', 'image-uploading', ('music-works', 'unsaved'), image='edit-image', tab='music', editing=True))
        add('music-works', 'image-failed', width, steps=open_work + [('start-image', 'edit-image'), ('wait-text', '#edit-image-status', 'アップロードできませんでした')], extra_fail=['upload'],
            **facet('music', 'image-failed', ('music-works', 'edit'), image='edit-image', tab='music', editing=True))
        add('music-works', 'delete-failed', width, scenario='delete-fail', steps=open_work + [('delete', '#music-delete-btn'), ('confirm-delete',), ('wait-text', '#music-editor-error', '')],
            **facet('music', 'delete-failed', ('music-works', 'failed'), tab='music', editing=True, rows=4))
        add('music-works', 'long-values', width, scenario='long-values', steps=[('tab', 'music'), ('open-work', LONG_WORK_ID)], **facet('music', 'long-values', ('music-works', 'edit'), tab='music', editing=True))
        add('music-works', 'playback-reset', width, steps=[('tab', 'music'), ('switch', 'videos'), ('open-video', VIDEO_ID), ('delete', '#music-delete-btn'), ('confirm-delete',), ('wait-closed', 'music'),
                                                           ('switch', 'works'), ('open-work', WORK_ID)], **facet('music', 'reset-playback', ('music-works', 'edit'), tab='music', editing=True))
        add('music-works', 'list', width, steps=[('tab', 'music')])
        add('music-works', 'empty', width, scenario='empty-lists', steps=[('tab', 'music')])
        add('music-works', 'edit', width, steps=open_work)
        add('music-works', 'unsaved', width, steps=unsaved)
        add('music-works', 'failed', width, scenario='save-fail', steps=unsaved + [('save', '#music-save-btn'), ('wait-text', '#music-editor-error', '')])
        add('music-works', 'delete-confirm', width, steps=open_work + [('delete', '#music-delete-btn')])
        add('music-works', 'new', width, steps=[('tab', 'music'), ('add-music',)])
        add('music-works', 'date-error', width, steps=[('tab', 'music'), ('add-music',), ('type', '#edit-title', '日付を間違えた作品'), ('type', '#edit-releaseDate', '2026/12/01'),
                                                        ('save', '#music-save-btn'), ('wait-text', '#edit-releaseDate-error', '形で入力してください')])

    # Music 映像（一覧はChannel URLを含む。幅900以上は2列、821以下は1列）（P47-04・11）
    for width in LIST_WIDTHS:
        videos = [('tab', 'music'), ('switch', 'videos')]
        open_video = videos + [('open-video', VIDEO_ID)]
        typed_video = open_video + [('type', '#edit-title', '未保存の映像名')]
        add('music-videos', 'saving', width, steps=typed_video + [('save', '#music-save-btn')], hold=['put'], **facet('music', 'saving', ('music-videos', 'unsaved'), tab='music', editing=True))
        add('music-videos', 'failed', width, scenario='save-fail', steps=typed_video + [('save', '#music-save-btn'), ('wait-text', '#music-editor-error', '')],
            **facet('music', 'failed', ('music-videos', 'unsaved'), tab='music', editing=True))
        add('music-videos', 'leave-confirm', width, steps=typed_video + [('leave-music', 'yt-musicVideos-fixture-2', 'video')], **facet('music', 'leave', ('music-videos', 'unsaved'), tab='music', editing=True))
        add('music-videos', 'channel-saving', width, steps=videos + [('type', '#youtube-channel-url', 'https://example.test/@typed-channel'), ('save', '#channel-save-btn')], hold=['put'],
            **facet('channel', 'saving', ('music-videos', 'channel-unsaved'), tab='music'))
        add('music-videos', 'channel-failed', width, scenario='save-fail', steps=videos + [('type', '#youtube-channel-url', 'https://example.test/@typed-channel'), ('save', '#channel-save-btn'),
                                                                                         ('wait-text', '#channel-editor-error', '')], **facet('channel', 'failed', ('music-videos', 'channel-unsaved'), tab='music'))
        add('music-videos', 'delete-failed', width, scenario='delete-fail', steps=open_video + [('delete', '#music-delete-btn'), ('confirm-delete',), ('wait-text', '#music-editor-error', '')],
            **facet('music', 'delete-failed', ('music-videos', 'unsaved'), tab='music', editing=True, rows=5))
        add('music-videos', 'list', width, steps=videos)
        add('music-videos', 'empty', width, scenario='empty-lists', steps=videos)
        add('music-videos', 'edit', width, steps=open_video)
        add('music-videos', 'unsaved', width, steps=open_video + [('type', '#edit-title', '未保存の映像名')])
        add('music-videos', 'channel-unsaved', width, steps=videos + [('type', '#youtube-channel-url', 'https://example.test/@typed-channel')])
        add('music-videos', 'id-error', width, steps=videos + [('add-music',), ('type', '#edit-title', 'IDを間違えた映像'), ('type', '#edit-youtube', 'short'),
                                                                ('save', '#music-save-btn'), ('wait-text', '#edit-youtube-error', '不正です')])
        add('music-videos', 'delete-confirm', width, steps=open_video + [('delete', '#music-delete-btn')])

    # Site と Profile（1画面。幅899px以下は未保存の時だけ下に固定の「保存して公開」）（P47-05・06。幅390・360・1440）
    for width in PAGE_WIDTHS:
        site_typed = [('tab', 'site'), ('type', '#site-footer-text', '未保存のフッター')]
        profile_typed = [('tab', 'profile'), ('type', '#profile-text', '未保存のプロフィール')]
        add('site', 'edit', width, steps=[('tab', 'site')])
        add('site', 'unsaved', width, steps=site_typed)
        add('site', 'failed', width, scenario='save-fail', steps=site_typed + [('save', '#site-save-btn'), ('wait-text', '#site-editor-error', '')])
        add('site', 'image-chosen', width, steps=[('tab', 'site'), ('choose-image', 'site-hero-image')])
        add('site', 'saving', width, steps=site_typed + [('save', '#site-save-btn')], hold=['put'], **facet('site', 'saving', ('site', 'unsaved'), tab='site'))
        add('site', 'leave-confirm', width, steps=site_typed + [('tab-try', 'news')], **facet('site', 'leave', ('site', 'unsaved'), tab='site'))
        add('site', 'image-uploading', width, steps=[('tab', 'site'), ('start-image', 'site-hero-image'), ('wait-text', '#site-hero-image-status', 'アップロードしています')], hold=['upload'],
            **facet('site', 'image-uploading', ('site', 'unsaved'), image='site-hero-image', tab='site'))
        add('site', 'image-failed', width, steps=[('tab', 'site'), ('start-image', 'site-hero-image'), ('wait-text', '#site-hero-image-status', 'アップロードできませんでした')], extra_fail=['upload'],
            **facet('site', 'image-failed', ('site', 'edit'), image='site-hero-image', tab='site'))
        add('site', 'long-values', width, scenario='long-values', steps=[('tab', 'site')], **facet('site', 'long-values', ('site', 'edit'), tab='site'))
        add('site', 'featured-reset', width, steps=[('tab', 'music'), ('open-work', WORK_ID), ('delete', '#music-delete-btn'), ('confirm-delete',), ('wait-closed', 'music'), ('tab', 'site')],
            **facet('site', 'reset-featured', ('site', 'edit'), tab='site'))
        add('profile', 'edit', width, steps=[('tab', 'profile')])
        add('profile', 'unsaved', width, steps=profile_typed)
        add('profile', 'link-added', width, steps=[('tab', 'profile'), ('add-link',)])
        add('profile', 'link-removed', width, steps=[('tab', 'profile'), ('remove-link', 0)])
        add('profile', 'saving', width, steps=profile_typed + [('save', '#profile-save-btn')], hold=['put'], **facet('profile', 'saving', ('profile', 'unsaved'), tab='profile'))
        add('profile', 'failed', width, scenario='save-fail', steps=profile_typed + [('save', '#profile-save-btn'), ('wait-text', '#profile-editor-error', '')],
            **facet('profile', 'failed', ('profile', 'unsaved'), tab='profile'))
        add('profile', 'leave-confirm', width, steps=profile_typed + [('tab-try', 'news')], **facet('profile', 'leave', ('profile', 'unsaved'), tab='profile'))
        add('profile', 'image-uploading', width, steps=[('tab', 'profile'), ('start-image', 'profile-image'), ('wait-text', '#profile-image-status', 'アップロードしています')], hold=['upload'],
            **facet('profile', 'image-uploading', ('profile', 'unsaved'), image='profile-image', tab='profile'))
        add('profile', 'image-failed', width, steps=[('tab', 'profile'), ('start-image', 'profile-image'), ('wait-text', '#profile-image-status', 'アップロードできませんでした')], extra_fail=['upload'],
            **facet('profile', 'image-failed', ('profile', 'edit'), image='profile-image', tab='profile'))
        add('profile', 'long-values', width, scenario='long-values', steps=[('tab', 'profile')], **facet('profile', 'long-values', ('profile', 'edit'), tab='profile'))
    return plan


def expected_images():
    return [item['file'] for item in build_plan()]


STEP_KINDS = {'tab', 'open-news', 'type', 'save', 'delete', 'add-news', 'leave', 'wait-text', 'open-live', 'wait-dialog',
              'open-work', 'open-video', 'switch', 'add-music', 'choose-image', 'add-link', 'remove-link',
              'start-image', 'confirm-delete', 'wait-closed', 'leave-music', 'tab-try'}   # 最後の5つは撮影2で足した
# 1x1 の PNG（画像を選んだあとの画面のために選ぶ。架空）
TINY_PNG = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
                         '1f15c4890000000d4944415478da6360000002000001e221bc330000000049454e44ae426082')


def config_js(item):
    if item['scenario'] == 'local-mode':
        return b'window.ADMIN_CONFIG = {"apiBaseUrl": "", "adminToken": ""};\n'
    return f'window.ADMIN_CONFIG = {json.dumps({"apiBaseUrl": fake.API_ORIGIN, "adminToken": fake.FAKE_TOKEN})};\n'.encode('utf-8')


def classify(host):
    host = host or ''
    if host == API_HOST:
        return 'fixture-api'
    if host in FIXTURE_IMAGE_HOSTS:
        return 'fixture-image'
    if host in ('127.0.0.1', 'localhost'):
        return 'local'
    if host in FONT_HOSTS:
        return 'font'
    if any(host == suffix.lstrip('.') or host.endswith(suffix) for suffix in PRODUCTION_SUFFIXES):
        return 'production'
    return 'other'


# ----------------------------------------------------------------------------------------------------------
# 1枚の撮影
# ----------------------------------------------------------------------------------------------------------
COVER_JS = '(s)=>{const e=document.querySelector(s);if(!e)return "要素なし";const r=e.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return t?(t.id?"#"+t.id:"."+String(t.className).split(" ").join(".")||t.tagName):"なし";}'


def click_target(page, selector, state):
    """普通のclick。5秒で押せなければ、重なっている要素を記録して不合格にし、click()の呼び出しで先へ進む（撮影を途中で止めない）。"""
    try:
        page.click(selector, timeout=5000)
    except Exception:  # noqa: BLE001
        covering = page.evaluate(COVER_JS, selector)
        state.setdefault('overlaps', []).append(f'{selector} を押せない（中央に重なっている要素: {covering}）')
        page.evaluate('(s)=>document.querySelector(s).click()', selector)


def run_steps(page, item, state):
    for step in item['steps']:
        kind = step[0]
        if kind == 'tab':
            click_target(page, f'.tab-nav .tab-btn[data-tab="{step[1]}"]', state)
            page.wait_for_function('(k)=>document.querySelector("#"+k+"-tab")?.classList.contains("active")', arg=step[1])
        elif kind == 'open-news':
            click_target(page, f'#news-list [data-occ-open="news"][data-occ-id="{step[1]}"]', state)
            page.wait_for_selector('#news-editor-body #edit-title', state='visible')
        elif kind == 'add-news':
            click_target(page, '#news-add-btn', state)
            page.wait_for_selector('#news-editor-body #edit-title', state='visible')
        elif kind == 'type':
            page.fill(step[1], step[2])
        elif kind == 'save':
            click_target(page, step[1] if len(step) > 1 else '#news-save-btn', state)
        elif kind == 'delete':
            click_target(page, step[1] if len(step) > 1 else '#news-delete-btn', state)
            page.wait_for_selector('#live-dialog-overlay:not([hidden])', state='visible')
        elif kind == 'open-work':
            click_target(page, f'#music-works-list [data-occ-open="release"][data-occ-id="{step[1]}"]', state)
            page.wait_for_selector('#music-editor-body #edit-title', state='visible')
        elif kind == 'open-video':
            click_target(page, f'#music-videos-list [data-occ-open="video"][data-occ-id="{step[1]}"]', state)
            page.wait_for_selector('#music-editor-body #edit-youtube', state='visible')
        elif kind == 'switch':
            click_target(page, f'#music-switch-{step[1]}', state)
            page.wait_for_function('(v)=>document.querySelector("#music-switch-"+v)?.getAttribute("aria-selected")==="true"', arg=step[1])
        elif kind == 'add-music':
            click_target(page, '#music-add-btn', state)
            page.wait_for_selector('#music-editor-body #edit-title', state='visible')
        elif kind == 'choose-image':
            # 画像を選んだあと（アップロードは架空のAPIが応える）。アップロードが終わる（「アップロードしています…」が消える）まで待つ。
            page.set_input_files(f'#{step[1]}-file', files=[{'name': 'fixture-photo.png', 'mimeType': 'image/png', 'buffer': TINY_PNG}])
            page.wait_for_function('(id)=>{const s=document.getElementById(id+"-status");return !!s&&!s.textContent.includes("アップロードしています")&&(document.getElementById(id).value||"").includes("uploaded")}', arg=step[1])
        elif kind == 'add-link':
            click_target(page, '#profile-link-add-btn', state)
            page.wait_for_selector('#profile-link-4-name', state='visible')
        elif kind == 'remove-link':
            click_target(page, f'#profile-link-{step[1]}-delete-btn', state)
        elif kind == 'leave':
            # 未保存のまま別へ移ろうとする: 幅899px以下は「‹ 一覧」、900px以上は左の一覧の別のお知らせ
            if item['width'] >= 900:
                click_target(page, f'#news-list [data-occ-open="news"][data-occ-id="{step[1]}"]', state)
            else:
                click_target(page, '#news-editor-back', state)
            page.wait_for_selector('#live-dialog-overlay:not([hidden])', state='visible')
        elif kind == 'start-image':
            # 画像を選ぶ（アップロードが終わるのを待たない）。「アップロードしています…」・失敗の文は、続く wait-text で待つ。
            page.set_input_files(f'#{step[1]}-file', files=[{'name': 'fixture-photo.png', 'mimeType': 'image/png', 'buffer': TINY_PNG}])
        elif kind == 'confirm-delete':
            click_target(page, '#live-dialog-action-delete', state)
            page.wait_for_selector('#live-dialog-overlay', state='hidden')
        elif kind == 'wait-closed':
            # 削除が終わって編集面が閉じる（編集面の本体が空になる）まで待つ。step[1] は news か music
            page.wait_for_function('(p)=>{const b=document.querySelector("#"+p+"-editor-body");return !!b&&b.children.length===0}', arg=step[1])
        elif kind == 'leave-music':
            # 未保存のまま別の項目へ移ろうとする: 幅899px以下は「‹ 一覧」、900px以上は左の一覧の別の項目（step[1] は項目の id、step[2] は release か video）
            if item['width'] >= 900:
                click_target(page, f'[data-occ-open="{step[2]}"][data-occ-id="{step[1]}"]', state)
            else:
                click_target(page, '#music-editor-back', state)
            page.wait_for_selector('#live-dialog-overlay:not([hidden])', state='visible')
        elif kind == 'tab-try':
            # 未保存のままタブを押す（確認の面が出て、タブは変わらない）
            click_target(page, f'.tab-nav .tab-btn[data-tab="{step[1]}"]', state)
            page.wait_for_selector('#live-dialog-overlay:not([hidden])', state='visible')
        elif kind == 'wait-dialog':
            page.wait_for_selector('#live-dialog-overlay:not([hidden])', state='visible')
        elif kind == 'wait-text':
            page.wait_for_function('([s,t])=>{const e=document.querySelector(s);return !!e&&(e.innerText||e.textContent||e.value||"").trim().includes(t)&&(e.innerText||e.textContent||"").trim().length>0}', arg=[step[1], step[2]])
        elif kind == 'open-live':
            click_target(page, f'[data-live-edit][data-live-id="{step[1]}"]', state)
            page.wait_for_function('()=>{const h=document.querySelector("#live-editor-heading");return h&&h.textContent.trim()&&h.textContent.trim()!=="Liveを選択"}')
        else:
            raise ValueError('unknown step ' + str(step))


def settle(page, item):
    """初期の描画が終わるまで待つ。"""
    page.wait_for_function('()=>document.querySelectorAll(".tab-nav .tab-btn").length===5&&document.querySelector("#modeBadge").textContent.trim()!==""&&document.querySelector("#modeBadge").textContent.trim()!=="Loading"')
    page.wait_for_load_state('networkidle')
    page.evaluate('document.fonts.ready')
    page.wait_for_function('()=>Array.from(document.images).every(i=>i.complete)')


def run_capture(browser, results, base, item):
    width, height = item['width'], item['height']
    api = fake.FakeAdminApi(copy.deepcopy(FIXTURE), item['scenario'], extra_fail=item.get('extra_fail', ()))
    origin = base.rstrip('/')
    base_port = urlparse(origin).port
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    net = {'blocked': [], 'production_attempts': [], 'other_blocked': [], 'fixture_api': [], 'denied_local': [], 'failed_scripts': [],
           'pageerrors': [], 'console_errors': [], 'dialogs': []}
    pending = []
    held = set(item.get('hold', []))
    page.on('pageerror', lambda error: net['pageerrors'].append(str(error)))
    page.on('console', lambda msg: net['console_errors'].append({'text': msg.text, 'url': msg.location.get('url', '')}) if msg.type == 'error' else None)
    page.on('response', lambda r: net['failed_scripts'].append({'url': r.url, 'status': r.status}) if r.request.resource_type == 'script' and r.status >= 400 else None)
    page.on('requestfailed', lambda r: net['failed_scripts'].append({'url': r.url, 'failure': r.failure}) if r.resource_type == 'script' else None)
    page.on('dialog', lambda d: (net['dialogs'].append({'type': d.type, 'message': d.message}), d.dismiss()))

    def intercept(route):
        request = route.request
        parsed = urlparse(request.url)
        host = parsed.hostname or ''
        kind = classify(host)
        if kind == 'fixture-api':
            net['fixture_api'].append(f'{request.method} {parsed.path}')
            if request.method == 'OPTIONS':
                route.fulfill(status=204, headers={**fake.CORS_HEADERS, 'Access-Control-Max-Age': '600'}, body='')
                return
            if parsed.path == '/api/admin/site-data' and request.method == 'PUT' and 'put' in held:
                pending.append(route)  # 保存中の画面のために、応えずに保留する（撮影の終わりに abort）
                return
            if parsed.path == '/api/admin/upload-image' and request.method == 'POST' and 'upload' in held:
                pending.append(route)  # 「アップロードしています…」の画面のために、応えずに保留する（撮影の終わりに abort）
                return
            status, headers, body = api.handle(request.method, parsed.path + ('?' + parsed.query if parsed.query else ''), request.headers, request.post_data_buffer or b'')
            route.fulfill(status=status, headers={k: v for k, v in headers.items() if k.lower() != 'content-length'}, body=body)
        elif kind == 'fixture-image':
            route.fulfill(status=200, content_type='image/svg+xml', body=fake.placeholder_image_svg(Path(parsed.path).stem))
        elif kind == 'local' and (parsed.port == base_port or base_port is None):
            path = unquote(parsed.path)
            if path == '/admin/config.js':
                route.fulfill(status=200, content_type='text/javascript; charset=utf-8', body=config_js(item))  # 実ファイルは読まない
            elif path == '/admin/data/site-data.json':
                route.fulfill(status=200, content_type='application/json; charset=utf-8', body=json.dumps(api.site, ensure_ascii=False))
            elif path == '/favicon.ico':
                route.fulfill(status=204, body='')
            elif path.startswith('/assets/images/') or path.startswith('/fake-images/'):
                route.fulfill(status=200, content_type='image/svg+xml', body=fake.placeholder_image_svg(Path(path).stem))
            else:
                target = hand.resolve_static(path)
                if target is None:
                    net['denied_local'].append(path)
                    route.fulfill(status=404, body='not found')
                else:
                    route.fulfill(status=200, content_type=hand.CONTENT_TYPES.get(target.suffix) or mimetypes.guess_type(str(target))[0] or 'application/octet-stream', body=target.read_bytes())
        else:
            net['blocked'].append({'method': request.method, 'host': host, 'kind': kind})
            if kind == 'production':
                net['production_attempts'].append(f'{request.method} {host}{parsed.path}')
            elif kind != 'font':
                net['other_blocked'].append(f'{request.method} {host}{parsed.path}')
            route.abort()

    context.route('**/*', intercept)
    state = {}
    findings = []
    metrics = {}
    try:
        page.clock.install(time=CLOCK_SECONDS)
        page.goto(origin + '/admin/', wait_until='domcontentloaded')
        settle(page, item)
        run_steps(page, item, state)
        # 押す・入力する間にページが送られると、画像の途中に上の帯が写る（sticky）。いつも先頭へ戻してから測る・撮る。
        page.evaluate('window.scrollTo(0,0)')
        # 空のtoast（共有の部品。fixedで画面の下端より下に隠れている）は、全体の撮影で画像が伸びると見えてしまう。撮影の間だけ隠す。
        # 色・透明度の実測が transition の途中の値を拾わないよう、撮影の間だけ transition を切って2フレーム待つ。
        page.add_style_tag(content='.toast:not(.show){visibility:hidden!important}*,*::before,*::after{transition:none!important;animation:none!important}')
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        metrics = page.evaluate(METRICS_JS, {'boxSelectors': BOX_SELECTORS, 'textSelectors': TEXT_SELECTORS, 'lineSelectors': LINE_SELECTORS, 'tapSelectors': TAP_SELECTORS, 'siteIds': SITE_IDS,
                                             'controlIds': CONTROL_IDS})
        findings = check_item(item, metrics, state)
        # 全体を撮る（Figma の frame と同じ）。画面の下に固定の「保存して公開」は、全体の画像では末尾に写る。「画面の下に固定」は上の実測で確かめる。
        page.screenshot(path=str(SHOTS / item['file']), full_page=True)
    except Exception:  # noqa: BLE001 - 失敗しても最後まで撮る
        findings.append('撮影中の例外: ' + traceback.format_exc(limit=2).strip().splitlines()[-1])
        try:
            page.screenshot(path=str(SHOTS / item['file']), full_page=False)
        except Exception:  # noqa: BLE001
            pass
    finally:
        for held_route in pending:
            try:
                held_route.abort()
            except Exception:  # noqa: BLE001
                pass
        pending.clear()
        try:
            context.unroute_all(behavior='wait')
        except Exception:  # noqa: BLE001
            pass
        context.close()
    unexpected_console = [e for e in net['console_errors'] if not any(e['url'].startswith(f'https://{h}') for h in FONT_HOSTS | {IMAGE_HOST})
                          and 'Failed to load resource' not in e['text']]
    row = {'image': 'screenshots/' + item['file'], 'screen': item['screen'], 'state': item['state'], 'width': width, 'height': height,
           'scenario': item['scenario'], 'steps': item['steps'], 'metrics': metrics, 'findings': findings,
           'production_requests_sent': 0, 'production_attempts_aborted': net['production_attempts'],
           'blocked_external_requests': net['blocked'], 'other_blocked': net['other_blocked'], 'denied_local_paths': net['denied_local'],
           'fixture_api_requests': net['fixture_api'], 'prompts_dismissed': net['dialogs'], 'pageerrors': net['pageerrors'],
           'failed_scripts': net['failed_scripts'], 'unexpected_console_errors': unexpected_console}
    results['captures'].append(row)
    METRICS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if findings or net['pageerrors'] or net['failed_scripts']:
        results.setdefault('failed_captures', []).append({k: row[k] for k in ['image', 'findings', 'pageerrors', 'failed_scripts']})
        print('FAIL', json.dumps(results['failed_captures'][-1], ensure_ascii=False), flush=True)
    else:
        print(item['file'], flush=True)


# ----------------------------------------------------------------------------------------------------------
# 各画面の合否（計画 §6。許容は罫線・丸めで±1px）
# ----------------------------------------------------------------------------------------------------------
ZERO_BOX = {'visible': False, 'x': 0, 'y': 0, 'width': 0, 'height': 0, 'right': 0, 'bottom': 0, 'disabled': False, 'opacity': '1', 'position': 'static', 'display': 'none'}


class Boxes(dict):
    """測っていない要素は「出ていない」箱として扱う（KeyErrorにしない）。"""

    def __missing__(self, key):
        return ZERO_BOX


def near(actual, expected, tolerance=1.0):
    return abs(float(actual) - float(expected)) <= tolerance


NEWS_STATUS = {'edit': '保存済み', 'unsaved': '未保存', 'saving': '保存しています…', 'failed': '保存できませんでした', 'new': '保存済み', 'delete-confirm': '保存済み',
               'leave-confirm': '未保存'}
NEWS_EDITING = {'edit', 'unsaved', 'saving', 'failed', 'new', 'delete-confirm', 'leave-confirm'}
NEWS_DIRTY = {'unsaved', 'saving', 'failed', 'leave-confirm'}  # 入力が保存した内容と違う（保存して公開が要る）


def chrome_findings(item, m):
    """上の帯（ADM-47-13）・5タブ・接続の表示。Header が出ている画面だけ高さを測る。"""
    found, width, scenario = [], item['width'], item['scenario']
    chrome, boxes, texts = m.get('chrome', {}), Boxes(m.get('boxes', {})), m.get('texts', {})
    if not chrome.get('header'):
        return found
    expected_header = band_height(width, scenario == 'local-mode')
    if not near(boxes['.header']['height'], expected_header):
        found.append(f'上の帯（Header）の高さが {expected_header}px±1 でない（{boxes[".header"]["height"]}px）')
    if not near(boxes['.tab-nav']['height'], tabs_height(width)):
        found.append(f'Tabs の高さが {tabs_height(width)}px±1 でない（{boxes[".tab-nav"]["height"]}px）')
    if m.get('tabs') != FIVE_TABS or m.get('tabKeys') != FIVE_TAB_KEYS:
        found.append(f'タブが5つの名前・順序でない（{m.get("tabs")} / {m.get("tabKeys")}）')
    if width >= 900:
        if boxes['.header']['height'] + boxes['.tab-nav']['height'] < 100:
            found.append('幅900px以上の上の帯（Header＋Tabs）が 115px 前後でない')
    badge, banner = texts.get('#modeBadge', ''), texts.get('#connectionBanner', '')
    expected_badge, save_text = {'api-fallback': ('API Fallback', None), 'local-mode': ('Local Mode', 'JSONを書き出す')}.get(scenario, ('接続中', None))
    if badge != expected_badge:
        found.append(f'Headerの右の表示が {expected_badge!r} でない（{badge!r}）')
    if scenario == 'api-fallback':
        if not chrome.get('banner') or '読み取り専用' not in banner:
            found.append(f'API接続失敗: 帯に読み取り専用の案内が出ていない（{banner!r}）')
    elif scenario == 'local-mode':
        if not chrome.get('banner') or banner != 'ローカルJSONモード（従来運用）':
            found.append(f'Local Mode: 帯に「ローカルJSONモード（従来運用）」が出ていない（{banner!r}）')
    elif chrome.get('banner') or banner:
        found.append(f'API接続中なのに接続の帯が出ている（{banner!r}）')
    save = boxes['#saveBtn']
    if save_text:
        # 書き出し待ち（未保存の変更がある間）は「JSONを書き出す *」と出る（#46 の Live の Local Mode と同じ表記）。どちらも「JSONを書き出す」が出ている
        if not save['visible'] or texts.get('#saveBtn') not in (save_text, f'{save_text} *'):
            found.append(f'Local Mode: Headerに「{save_text}」が出ていない')
        elif save['x'] < boxes['#modeBadge']['x'] - save['width'] - 24 or save['x'] > boxes['#modeBadge']['x']:
            found.append('「JSONを書き出す」が「Local Mode」の左にない')
    elif save['visible']:
        found.append('API接続中・接続失敗のHeaderに保存のボタンが出ている（全タブがその場の「保存して公開」を持つ）')
    return found


def news_findings(item, m):
    found, width, state = [], item['width'], item['state']
    boxes, texts, rows = Boxes(m.get('boxes', {})), m.get('texts', {}), m.get('rows', {})
    wide = width >= 900
    editing = state in NEWS_EDITING
    body = m.get('bodyClasses', [])
    if m.get('activeTab') != 'news' or m.get('visiblePanels') != ['news-tab']:
        found.append(f'Newsのタブだけが出ていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    expected_rows = 0 if state == 'empty' else 6
    if state in {'list', 'empty'} or editing:
        if rows.get('count') != expected_rows:
            found.append(f'一覧の行が {expected_rows} 件でない（{rows.get("count")}）')
    if state == 'empty' and 'まだ登録がありません。' not in texts.get('#news-list', ''):
        found.append('空の一覧に「まだ登録がありません。」が出ていない')
    if state == 'list' and rows.get('firstText') and '架空' not in rows['firstText']:
        found.append('一覧の行に日付と題が出ていない')
    # ---- 幅別の構造
    if not wide:
        if editing:
            if 'is-occ-editing' not in body:
                found.append('幅899px以下で編集を開いているのに body.is-occ-editing がない')
            if m.get('chrome', {}).get('header') or m.get('chrome', {}).get('tabNav') or m.get('chrome', {}).get('banner'):
                found.append('編集を開いている間は Header・接続の帯・Tabs を隠す（上の帯は「‹ 一覧｜題｜状態」の1行）')
            if not boxes['#news-editor-bar']['visible'] or not 40 <= boxes['#news-editor-bar']['height'] <= 52:
                found.append(f'編集の上の帯（‹ 一覧｜題｜状態）が出ていない／高さが 47px 前後でない（{boxes["#news-editor-bar"]["height"]}px）')
            if boxes['#news-list-pane']['visible']:
                found.append('幅899px以下は一覧→編集: 編集を開いている間は一覧を出さない')
            if m.get('lines', {}).get('#news-editor-title', 1) != 1:
                found.append('編集の上の帯の題が1行でない（長い題は末尾を…にする）')
        else:
            if 'is-occ-editing' in body or boxes['#news-editor-pane']['visible']:
                found.append('一覧の画面に編集面が出ている')
            if boxes['#news-editor-actions']['visible']:
                found.append('一覧の画面に「保存して公開」が出ている')
    else:
        if not (boxes['#news-list-pane']['visible'] and boxes['#news-editor-pane']['visible']):
            found.append('幅900px以上は左に一覧・右に編集の2列。どちらかが出ていない')
        elif not near(boxes['#news-list-pane']['width'], 320):
            found.append(f'一覧の幅が 320px±1 でない（{boxes["#news-list-pane"]["width"]}px）')
        elif boxes['#news-editor-pane']['x'] < boxes['#news-list-pane']['right'] + 23:
            found.append('編集が一覧の右（gap 24）に並んでいない')
        if boxes['#news-editor-bar']['visible']:
            found.append('幅900px以上に「‹ 一覧｜題｜状態」の帯が出ている（幅899px以下だけ）')
        if not editing and not (boxes['#news-editor-empty']['visible'] and '一覧から選ぶか、「+ 追加」を押してください。' in texts.get('#news-editor-empty', '')):
            found.append('編集を選んでいない時の「一覧から選ぶか、「+ 追加」を押してください。」が出ていない')
        if editing and not boxes['#news-editor-card']['visible']:
            found.append('編集面が出ていない')
    # ---- 編集の中身
    if editing:
        heading = '新しいお知らせ' if state == 'new' else 'お知らせを編集'
        if texts.get('#news-editor-heading') != heading:
            found.append(f'編集の見出しが {heading!r} でない（{texts.get("#news-editor-heading")!r}）')
        expected_labels = ['日付', 'タイトル', '説明', '画像', '詳細リンクURL', 'リンクテキスト']
        if m.get('fieldLabels') != expected_labels:
            found.append(f'入力欄の名前と並びが {expected_labels} でない（{m.get("fieldLabels")}）')
        if state == 'new':
            if m.get('fields', {}).get('edit-title') != '' or m.get('fields', {}).get('edit-linkText') != 'view...':
                found.append('新規の入力欄が空（リンクテキストだけ view...）でない')
            if boxes['#news-delete-btn']['visible']:
                found.append('新規に削除が出ている')
        else:
            if not boxes['#news-delete-btn']['visible'] or texts.get('#news-delete-btn') != 'このお知らせを削除':
                found.append('「このお知らせを削除」が編集のいちばん下に出ていない')
            if rows.get('selected') != NEWS_ID and state not in {'leave-confirm'}:
                found.append(f'開いている行が aria-current でない（{rows.get("selected")!r}）')
        status = texts.get('#news-editor-status' if not wide else '#news-editor-status-wide', '')
        if status != NEWS_STATUS[state]:
            found.append(f'保存の状態が {NEWS_STATUS[state]!r} でない（{status!r}）')
        # ---- 保存して公開（ADM-47-06）
        actions, button = boxes['#news-editor-actions'], boxes['#news-save-btn']
        dirty = state in NEWS_DIRTY
        if not wide:
            if state in {'delete-confirm', 'edit', 'new'}:
                if actions['visible']:
                    found.append('幅899px以下: 変更がない時に「保存して公開」が出ている')
            elif state in NEWS_DIRTY:
                if not actions['visible'] or actions['position'] != 'fixed':
                    found.append(f'幅899px以下: 未保存の時に「保存して公開」が画面の下に固定で出ていない（position={actions["position"]}）')
                elif not near(actions['bottom'], m['viewport']['height']):
                    found.append(f'固定の「保存して公開」の下端が画面の下端でない（{actions["bottom"]} / {m["viewport"]["height"]}）')
                elif button['width'] < m['viewport']['width'] - 34:
                    found.append(f'固定の「保存して公開」が幅いっぱい（358px）でない（{button["width"]}px）')
        else:
            if not button['visible']:
                found.append('幅900px以上: 「保存して公開」が見出しの右に出ていない')
            else:
                heading_box = boxes['#news-editor-heading']
                if button['x'] < heading_box['x'] + 100 or abs((button['y'] + button['height'] / 2) - (heading_box['y'] + heading_box['height'] / 2)) > 16:
                    found.append('幅900px以上: 「保存して公開」が見出しの右の同じ行にない')
                if not dirty and not (button['disabled'] and float(button['opacity']) <= 0.5):
                    found.append('幅900px以上: 変更がない時に「保存して公開」が薄く・押せない状態でない')
                if state in {'unsaved', 'failed', 'leave-confirm'} and (button['disabled'] or float(button['opacity']) < 0.9):
                    found.append('幅900px以上: 未保存の時に「保存して公開」が押せない・薄い')
        if button['visible'] and m.get('lines', {}).get('#news-save-btn') != 1:
            found.append(f'「保存して公開」が1行でない（{m.get("lines", {}).get("#news-save-btn")}行）')
        if state == 'saving' and button['visible'] and not (button['disabled'] and float(button['opacity']) <= 0.5):
            found.append('保存中なのに「保存して公開」が押せる')
        if state == 'failed':
            error = boxes['#news-editor-error']
            if not texts.get('#news-editor-error') or not error['visible']:
                found.append('保存できなかった理由の行が出ていない')
            elif wide and error['y'] < boxes['#news-editor-heading']['bottom'] - 1:
                found.append('幅900px以上: 理由の行が見出しの下にない')
            elif not wide and error['bottom'] > button['y'] + 1:
                found.append('幅899px以下: 理由の行が「保存して公開」の上にない')
        # ---- 確認の面
        if state in {'delete-confirm', 'leave-confirm'}:
            dialog = texts.get('#live-dialog', '')
            wanted = ['削除すると公開画面からも消えます。', 'やめる', '削除する', '削除しますか。'] if state == 'delete-confirm' else ['保存していない変更があります。', '破棄して移動', '編集を続ける']
            for text in wanted:
                if text not in dialog:
                    found.append(f'確認の面に {text!r} が出ていない')
            if not m.get('dialogOpen'):
                found.append('確認の面が開いていない')
            safe = 'live-dialog-action-cancel' if state == 'delete-confirm' else 'live-dialog-action-stay'
            if m.get('active') != safe:
                found.append(f'確認の面の初期のフォーカスが安全な側（{safe}）でない（{m.get("active")!r}）')
    elif m.get('dialogOpen'):
        found.append('確認の面が開いている')
    return found


def live_findings(item, m):
    found, wide = [], item['width'] >= 900
    boxes = Boxes(m.get('boxes', {}))
    if m.get('activeTab') != 'live' or m.get('visiblePanels') != ['live-tab']:
        found.append(f'Liveのタブだけが出ていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    # 幅390でライブを開いている間は一覧を隠すのが #46 の承認済みの形（撮影1の直しFIX3 a）。一覧の行を求めるのは、一覧の画面と幅1440だけ。
    if m.get('liveRows', 0) < 1 and not (item['state'] == 'open' and not wide):
        found.append('Liveの一覧の行が出ていない')
    if item['state'] == 'open':
        if not m.get('liveEditing'):
            found.append('ライブの公開内容の編集が開いていない')
        chrome = m.get('chrome', {})
        if not wide and (chrome.get('header') or chrome.get('tabNav')):
            found.append('幅899px以下でライブを開いている間は Header・Tabs を隠す（Liveの動きは変えない）')
        if wide and not (chrome.get('header') and chrome.get('tabNav') and boxes['#live-editor-pane']['visible']):
            found.append('幅900px以上: 上の帯の下に一覧と編集の2列が出ていない')
    return found


# ----------------------------------------------------------------------------------------------------------
# Music・Site・Profile の合否（段3・4。News と同じ項目: 幅別の構造・編集の中身・保存して公開・確認の面）
# ----------------------------------------------------------------------------------------------------------
SAVED, UNSAVED, SAVING, FAILED = '保存済み', '未保存', '保存しています…', '保存できませんでした'
WORK_LABELS = ['カテゴリ', 'タイトル', 'リリース日', '説明（曲リスト等）', '画像（ジャケット）', 'リンクURL', '種別', 'その場で再生する映像']
VIDEO_LABELS = ['カテゴリ', 'タイトル', 'YouTube URL / ID']
SITE_LABELS = ['顔にする作品', '共有時の画像', 'Bandcamp', 'YouTube', 'X', 'Instagram', 'note', 'フッター文言（空なら既定のまま）', '導入文', 'Form Action（Formspree URL）']
WORK_STATES = {'edit': SAVED, 'unsaved': UNSAVED, 'failed': FAILED, 'delete-confirm': SAVED, 'new': SAVED, 'date-error': UNSAVED}
VIDEO_STATES = {'edit': SAVED, 'unsaved': UNSAVED, 'delete-confirm': SAVED, 'id-error': UNSAVED}
ITEM_DIRTY = {'unsaved', 'failed', 'date-error', 'id-error'}  # 入力が保存した内容と違う（保存して公開が要る）
DATE_ERROR_TEXT = '「2025.05.05」の形で入力してください。'
ID_ERROR_TEXT = 'YouTube URL / ID が不正です（IDは11文字）'
DELETE_TEXT = {
    'music-works': ['「架空の作品 A "テスト"」を削除しますか。', '削除すると公開画面からも消えます。', '顔にする作品は「自動（最新のリリース）」に戻ります。', 'やめる', '削除する'],
    'music-videos': ['「架空のMV A」を削除しますか。', '削除すると公開画面からも消えます。',
                     '再生する映像に選んでいる作品が1件あります。「選ばない」に戻り、公開画面では「聴く」が出なくなります。', 'やめる', '削除する'],
}


def save_bar_findings(item, m, prefix, *, dirty, saving=False, failed=False, heading=None, fixed=True, label='保存して公開'):
    """「保存して公開」の出し方（ADM-47-06）。幅899px以下は、保存するものがある時だけ出て（fixed=True は画面の下に固定、Channel URL は欄の下）、
    幅900px以上は見出しの右の同じ行で、変更がない時は薄く押せない。"""
    found, width, wide = [], item['width'], item['width'] >= 900
    boxes = Boxes(m.get('boxes', {}))
    actions, button = boxes[f'#{prefix}-editor-actions'], boxes[f'#{prefix}-save-btn']
    show = dirty or saving or failed
    if not wide:
        if not show:
            if actions['visible']:
                found.append(f'幅899px以下: 変更がない時に「{label}」が出ている（{prefix}）')
        elif not actions['visible']:
            found.append(f'幅899px以下: 保存するものがある時に「{label}」が出ていない（{prefix}）')
        elif fixed and actions['position'] != 'fixed':
            found.append(f'幅899px以下: 「{label}」が画面の下に固定で出ていない（{prefix}。position={actions["position"]}）')
        elif fixed and not near(actions['bottom'], m['viewport']['height']):
            found.append(f'固定の「{label}」の下端が画面の下端でない（{prefix}。{actions["bottom"]} / {m["viewport"]["height"]}）')
        elif fixed and button['width'] < m['viewport']['width'] - 34:
            found.append(f'固定の「{label}」が幅いっぱい（358px）でない（{prefix}。{button["width"]}px）')
        elif not fixed and actions['position'] == 'fixed':
            found.append(f'Channel URL の「{label}」は欄の下に出る（画面の下に固定しない）')
    else:
        if not button['visible']:
            found.append(f'幅900px以上: 「{label}」が見出しの右に出ていない（{prefix}）')
        else:
            if heading and heading['visible'] and (button['x'] < heading['x'] + 60 or abs((button['y'] + button['height'] / 2) - (heading['y'] + heading['height'] / 2)) > 16):
                found.append(f'幅900px以上: 「{label}」が見出しの右の同じ行にない（{prefix}）')
            if not show and not (button['disabled'] and float(button['opacity']) <= 0.5):
                found.append(f'幅900px以上: 変更がない時に「{label}」が薄く・押せない状態でない（{prefix}）')
            if dirty and not saving and (button['disabled'] or float(button['opacity']) < 0.9):
                found.append(f'幅900px以上: 未保存の時に「{label}」が押せない・薄い（{prefix}）')
    if button['visible'] and m.get('lines', {}).get(f'#{prefix}-save-btn') != 1:
        found.append(f'「{label}」が1行でない（{prefix}。{m.get("lines", {}).get(f"#{prefix}-save-btn")}行）')
    if saving and button['visible'] and not (button['disabled'] and float(button['opacity']) <= 0.5):
        found.append(f'保存中なのに「{label}」が押せる（{prefix}）')
    return found


def list_findings(m, which, *, expected, groups, thumbs=0, selected=''):
    found = []
    info = (m.get('lists') or {}).get(which) or {}
    if info.get('count') != expected:
        found.append(f'{which} の一覧の行が {expected} 件でない（{info.get("count")}）')
    if expected and info.get('groups') != groups:
        found.append(f'{which} の一覧の見出しが {groups} でない（{info.get("groups")}）')
    if not expected and groups and info.get('groups'):
        found.append(f'{which} の空の一覧に見出しが出ている（{info.get("groups")}）')
    if expected and info.get('thumbs', 0) != thumbs:
        found.append(f'{which} の一覧のジャケットが {thumbs} 枚でない（{info.get("thumbs")}）')
    if selected and info.get('selected') != selected:
        found.append(f'{which} の開いている行が aria-current でない（{info.get("selected")!r}）')
    if not expected and not info.get('empty'):
        found.append(f'{which} の空の一覧に「まだ登録がありません。」が出ていない')
    return found


def dialog_findings(item, m, state, texts_key):
    found = []
    if state == 'delete-confirm':
        dialog = (m.get('texts') or {}).get('#live-dialog', '')
        for text in DELETE_TEXT[texts_key]:
            if text not in dialog:
                found.append(f'削除の確認の面に {text!r} が出ていない')
        if not m.get('dialogOpen'):
            found.append('確認の面が開いていない')
        if m.get('active') != 'live-dialog-action-cancel':
            found.append(f'確認の面の初期のフォーカスが安全な側（やめる）でない（{m.get("active")!r}）')
    elif m.get('dialogOpen'):
        found.append('確認の面が開いている')
    return found


def music_findings(item, m):
    """Music の作品（screen = music-works）と映像（music-videos）。"""
    found, width, state, screen = [], item['width'], item['state'], item['screen']
    wide, works = width >= 900, screen == 'music-works'
    boxes, texts = Boxes(m.get('boxes', {})), m.get('texts', {})
    body = m.get('bodyClasses', [])
    states = WORK_STATES if works else VIDEO_STATES
    editing = state in states
    chrome = m.get('chrome', {})
    if m.get('activeTab') != 'music' or m.get('visiblePanels') != ['music-tab']:
        found.append(f'Musicのタブだけが出ていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    which = 'works' if works else 'videos'
    switch = m.get('switchState') or {}
    if switch.get(which) != 'true' or switch.get('videos' if works else 'works') != 'false':
        found.append(f'作品／映像の切り替えが {"作品" if works else "映像"} を選んでいない（{switch}）')
    # ---- 一覧
    if works:
        found += list_findings(m, 'works', expected=0 if state == 'empty' else 4, groups=['Digital Release', '宅録Demo'], thumbs=4,
                               selected=WORK_ID if state in {'edit', 'unsaved', 'failed', 'delete-confirm'} else '')  # date-error は新規（まだ一覧に載らない）
    else:
        found += list_findings(m, 'videos', expected=0 if state == 'empty' else 5, groups=['Music Video', 'Live Movie', 'Demo'],
                               selected=VIDEO_ID if state in {'edit', 'unsaved', 'delete-confirm'} else '')
    if wide or not editing:
        title = texts.get('#music-list-title', '')
        if title != ('作品' if works else '映像') and boxes['#music-list-pane']['visible']:
            found.append(f'一覧の見出しが {"作品" if works else "映像"} でない（{title!r}）')
        if not boxes['#music-add-btn']['visible'] or not 40 <= boxes['#music-add-btn']['height']:
            found.append('一覧の「+ 追加」が出ていない')
    # ---- 幅別の構造
    if not wide:
        if editing:
            if 'is-occ-editing' not in body:
                found.append('幅899px以下で編集を開いているのに body.is-occ-editing がない')
            if chrome.get('header') or chrome.get('tabNav') or chrome.get('banner'):
                found.append('編集を開いている間は Header・接続の帯・Tabs を隠す')
            if boxes['.occ-music-top']['visible'] or boxes['.occ-switch']['visible']:
                found.append('編集を開いている間は作品／映像の切り替え（と Channel URL）を隠す')
            if not boxes['#music-editor-bar']['visible'] or not 40 <= boxes['#music-editor-bar']['height'] <= 52:
                found.append(f'編集の上の帯（‹ 一覧｜題｜状態）が出ていない／高さが 47px 前後でない（{boxes["#music-editor-bar"]["height"]}px）')
            if boxes['#music-list-pane']['visible']:
                found.append('幅899px以下は一覧→編集: 編集を開いている間は一覧を出さない')
            if m.get('lines', {}).get('#music-editor-title', 1) != 1:
                found.append('編集の上の帯の題が1行でない')
        else:
            if 'is-occ-editing' in body or boxes['#music-editor-pane']['visible']:
                found.append('一覧の画面に編集面が出ている')
            if not boxes['.occ-switch']['visible'] or not near(boxes['.occ-switch']['width'], m['viewport']['width'] - 32, 2):
                found.append(f'作品／映像の切り替えが幅いっぱい（358px）でない（{boxes[".occ-switch"]["width"]}px）')
            if boxes['#music-editor-actions']['visible']:
                found.append('一覧の画面に編集の「保存して公開」が出ている')
    else:
        if not (boxes['#music-list-pane']['visible'] and boxes['#music-editor-pane']['visible']):
            found.append('幅900px以上は左に一覧・右に編集の2列。どちらかが出ていない')
        elif not near(boxes['#music-list-pane']['width'], 320):
            found.append(f'一覧の幅が 320px±1 でない（{boxes["#music-list-pane"]["width"]}px）')
        elif boxes['#music-editor-pane']['x'] < boxes['#music-list-pane']['right'] + 23:
            found.append('編集が一覧の右（gap 24）に並んでいない')
        if boxes['#music-editor-bar']['visible']:
            found.append('幅900px以上に「‹ 一覧｜題｜状態」の帯が出ている')
        if not editing and not (boxes['#music-editor-empty']['visible'] and '一覧から選ぶか、「+ 追加」を押してください。' in texts.get('#music-editor-empty', '')):
            found.append('編集を選んでいない時の「一覧から選ぶか、「+ 追加」を押してください。」が出ていない')
        if editing and not boxes['#music-editor-card']['visible']:
            found.append('編集面が出ていない')
        if not boxes['.occ-switch']['visible'] or boxes['.occ-switch']['width'] > 200:
            found.append('幅900px以上の作品／映像の切り替えが中身に合わせた幅（134px前後）でない')
    # ---- Channel URL（映像の側。編集を開いていない時だけ出る）
    channel_shown = not works and (wide or not editing)
    if works and boxes['#music-channel-panel']['visible']:
        found.append('作品の側に Channel URL の欄が出ている（映像の側だけ）')
    if channel_shown:
        found += channel_findings(item, m)
    # ---- 編集の中身
    if editing:
        labels = WORK_LABELS if works else VIDEO_LABELS
        if m.get('fieldLabels') != labels:
            found.append(f'入力欄の名前と並びが {labels} でない（{m.get("fieldLabels")}）')
        fresh = state in {'new', 'date-error', 'id-error'}
        heading = ('新しい作品' if fresh else '作品を編集') if works else ('新しい映像' if fresh else '映像を編集')
        if texts.get('#music-editor-heading') != heading:
            found.append(f'編集の見出しが {heading!r} でない（{texts.get("#music-editor-heading")!r}）')
        delete_text = 'この作品を削除' if works else 'この映像を削除'
        if fresh:
            if boxes['#music-delete-btn']['visible']:
                found.append('新規に削除が出ている')
        elif not boxes['#music-delete-btn']['visible'] or texts.get('#music-delete-btn') != delete_text:
            found.append(f'「{delete_text}」が編集のいちばん下に出ていない')
        if state == 'new' and (m.get('fields', {}).get('edit-title') != '' or m.get('fields', {}).get('edit-category') != 'digital'):
            found.append('新規の作品が空（カテゴリは Digital Release）でない')
        if state == 'id-error' and m.get('fields', {}).get('edit-category') != 'musicVideos':
            found.append('新規の映像のカテゴリが Music Video でない')
        status = texts.get('#music-editor-status' if not wide else '#music-editor-status-wide', '')
        if status != states[state] and not (state == 'failed' and status == FAILED):
            found.append(f'保存の状態が {states[state]!r} でない（{status!r}）')
        found += save_bar_findings(item, m, 'music', dirty=state in ITEM_DIRTY, failed=state == 'failed', heading=boxes['#music-editor-heading'])
        if state == 'failed':
            error = boxes['#music-editor-error']
            if not texts.get('#music-editor-error') or not error['visible']:
                found.append('保存できなかった理由の行が出ていない')
            elif wide and error['y'] < boxes['#music-editor-heading']['bottom'] - 1:
                found.append('幅900px以上: 理由の行が見出しの下にない')
            elif not wide and error['bottom'] > boxes['#music-save-btn']['y'] + 1:
                found.append('幅899px以下: 理由の行が「保存して公開」の上にない')
        if state == 'date-error':
            errors = m.get('errors') or {}
            if errors.get('releaseDate') != DATE_ERROR_TEXT or errors.get('releaseDateInvalid') != 'true':
                found.append(f'日付の直下に {DATE_ERROR_TEXT!r} が出ていない（{errors}）')
        if state == 'id-error':
            errors = m.get('errors') or {}
            if errors.get('youtube') != ID_ERROR_TEXT or errors.get('youtubeInvalid') != 'true':
                found.append(f'YouTube URL / ID の直下に {ID_ERROR_TEXT!r} が出ていない（{errors}）')
    found += dialog_findings(item, m, state, screen)
    return found


def channel_findings(item, m):
    """映像の側の Channel URL の欄（S47-17）。幅899px以下は見出しがなく、状態と「保存して公開」は欄の下。幅900px以上は見出しの右。"""
    found, wide, state = [], item['width'] >= 900, item['state']
    boxes, texts = Boxes(m.get('boxes', {})), m.get('texts', {})
    if not boxes['#music-channel-panel']['visible'] or not boxes['#youtube-channel-url']['visible']:
        return ['映像の側に Channel URL の欄が出ていない']
    dirty = state == 'channel-unsaved'
    status = texts.get('#channel-editor-status', '')
    if status != (UNSAVED if dirty else SAVED):
        found.append(f'Channel URL の保存の状態が {(UNSAVED if dirty else SAVED)!r} でない（{status!r}）')
    if dirty and m.get('fields', {}).get('youtube-channel-url') != 'https://example.test/@typed-channel':
        found.append('Channel URL の入力が残っていない')
    heading_shown = 'Channel URL' in (m.get('pageHeadings') or [])
    if wide and not heading_shown:
        found.append('幅900px以上の Channel URL の面に見出し「Channel URL」が出ていない')
    if not wide and heading_shown:
        found.append('幅899px以下の Channel URL の面に見出しが出ている（欄のラベルだけ）')
    if not wide and boxes['#channel-editor-status']['visible'] and boxes['#channel-editor-status']['y'] < boxes['#youtube-channel-url']['bottom'] - 1:
        found.append('幅899px以下: Channel URL の保存の状態が欄の下にない')
    found += save_bar_findings(item, m, 'channel', dirty=dirty, heading=boxes['#music-channel-heading'], fixed=False)
    return found


def site_findings(item, m):
    found, width, state = [], item['width'], item['state']
    wide = width >= 900
    boxes, texts = Boxes(m.get('boxes', {})), m.get('texts', {})
    if m.get('activeTab') != 'site' or m.get('visiblePanels') != ['site-tab']:
        found.append(f'Siteのタブだけが出ていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    if (m.get('pageHeadings') or [])[:4] != ['Home', 'Home Links', 'Footer', 'Contact']:
        found.append(f'白い面の見出しが Home・Home Links・Footer・Contact でない（{m.get("pageHeadings")}）')
    if (m.get('pageLabels') or {}).get('site') != SITE_LABELS:
        found.append(f'Site の入力欄の名前と並びが {SITE_LABELS} でない（{(m.get("pageLabels") or {}).get("site")}）')
    if not boxes['.occ-page-title']['visible']:
        found.append('Site の見出し「Site」の行が出ていない')
    dirty = state in {'unsaved', 'failed', 'image-chosen'}
    status = texts.get('#site-editor-status', '')
    expected = FAILED if state == 'failed' else (UNSAVED if dirty else SAVED)
    if status != expected:
        found.append(f'Site の保存の状態が {expected!r} でない（{status!r}）')
    found += save_bar_findings(item, m, 'site', dirty=dirty, failed=state == 'failed', heading=boxes['.occ-page-title'])
    if wide and boxes['.occ-page-head']['visible'] and boxes['.occ-page-head']['width'] > 881:
        found.append(f'幅900px以上の Site の面が幅880pxに収まっていない（{boxes[".occ-page-head"]["width"]}px）')
    if state == 'failed':
        error = boxes['#site-editor-error']
        if not texts.get('#site-editor-error') or not error['visible']:
            found.append('Site: 保存できなかった理由の行が出ていない')
    if state in {'unsaved', 'failed'} and m.get('fields', {}).get('site-footer-text') != '未保存のフッター':
        found.append('Site: 入力した内容が残っていない')
    if state == 'image-chosen':
        image = (m.get('images') or {}).get('site-hero-image') or {}
        if 'uploaded' not in image.get('value', '') or not image.get('path', '').startswith('URL:') or image.get('status'):
            found.append(f'Site: 画像を選んだあとの値・pathの表示・状態の行が想定と違う（{image}）')
    found += dialog_findings(item, m, state, 'site')
    return found


def profile_findings(item, m):
    found, width, state = [], item['width'], item['state']
    boxes, texts = Boxes(m.get('boxes', {})), m.get('texts', {})
    if m.get('activeTab') != 'profile' or m.get('visiblePanels') != ['profile-tab']:
        found.append(f'Profileのタブだけが出ていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    if (m.get('pageHeadings') or [])[:2] != ['Profile', 'SNSリンク']:
        found.append(f'白い面の見出しが Profile・SNSリンク でない（{m.get("pageHeadings")}）')
    rows = {'link-added': 5, 'link-removed': 3}.get(state, 4)
    expected_labels = ['写真', 'プロフィールテキスト'] + ['名前', 'URL'] * rows
    if (m.get('pageLabels') or {}).get('profile') != expected_labels:
        found.append(f'Profile の入力欄の名前と並びが {expected_labels} でない（{(m.get("pageLabels") or {}).get("profile")}）')
    if m.get('linkRows') != rows:
        found.append(f'リンクの行が {rows} 行でない（{m.get("linkRows")}）')
    if not boxes['#profile-link-add-btn']['visible']:
        found.append('「+ リンク追加」が出ていない')
    dirty = state != 'edit'
    status = texts.get('#profile-editor-status', '')
    if status != (UNSAVED if dirty else SAVED):
        found.append(f'Profile の保存の状態が {(UNSAVED if dirty else SAVED)!r} でない（{status!r}）')
    found += save_bar_findings(item, m, 'profile', dirty=dirty, heading=boxes['#profile-heading'])
    if state == 'unsaved' and m.get('fields', {}).get('profile-text') != '未保存のプロフィール':
        found.append('Profile: 入力した内容が残っていない')
    if state == 'edit' and m.get('fields', {}).get('profile-text', '').count('\n') != 8:
        found.append('Profile: 9行（空行を含む）の文が崩れている')
    found += dialog_findings(item, m, state, 'profile')
    return found


# ----------------------------------------------------------------------------------------------------------
# 撮影2で足した状態（facet）の合否。段2〜4の画面の合否の関数は使わず、その状態で見る所だけを検査する。
# ----------------------------------------------------------------------------------------------------------
STATUS_SELECTOR = {'news': ('#news-editor-status', '#news-editor-status-wide'), 'music': ('#music-editor-status', '#music-editor-status-wide'),
                   'channel': ('#channel-editor-status', '#channel-editor-status'), 'site': ('#site-editor-status', '#site-editor-status'),
                   'profile': ('#profile-editor-status', '#profile-editor-status')}
LOCAL_WAITING = 'JSON書き出し待ち'
IMAGE_UPLOADING, IMAGE_FAILED = 'アップロードしています…', '画像をアップロードできませんでした'
UNSAVED_DIALOG = ['保存していない変更があります。', '破棄して移動', '編集を続ける']


def facet_status(item, m):
    narrow_sel, wide_sel = STATUS_SELECTOR[item['prefix']]
    return (m.get('texts') or {}).get(wide_sel if item['width'] >= 900 else narrow_sel, '')


def facet_findings(item, m):
    found, width = [], item['width']
    wide = width >= 900
    kind, prefix, tab = item['facet'], item['prefix'], item.get('tab')
    boxes, texts = Boxes(m.get('boxes', {})), m.get('texts', {})
    if tab and (m.get('activeTab') != tab or f'{tab}-tab' not in m.get('visiblePanels', [])):
        found.append(f'{tab} のタブだけが出ていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    if item.get('editing'):
        if wide:
            card = '#news-editor-card' if prefix == 'news' else '#music-editor-card'
            if not boxes[card]['visible']:
                found.append('編集面が出ていない')
        elif 'is-occ-editing' not in m.get('bodyClasses', []):
            found.append('幅899px以下で編集を開いているのに body.is-occ-editing がない')
    if kind == 'read-only':
        controls = m.get('controls') or {}
        checked = [i for i in [READ_ONLY_PRIMARY[prefix], *READ_ONLY_OTHERS[prefix]] if (controls.get(i) or {}).get('visible')]
        if prefix != 'live' and not checked:
            found.append('読み取り専用の画面に操作が1つも見えていない（一覧と各項目は読める）')
        for control_id in checked:
            if not controls[control_id]['disabled']:
                found.append(f'#{control_id} が押せる・入力できる（API接続失敗は読み取り専用）')
        if boxes['#saveBtn']['visible']:
            found.append('API接続失敗のHeaderに保存のボタンが出ている')
        if not item.get('editing'):
            if prefix == 'news' and (m.get('rows') or {}).get('count', 0) < 1:
                found.append('読み取り専用でもNewsの一覧は読める（行が出ていない）')
            if prefix == 'music' and ((m.get('lists') or {}).get('works') or {}).get('count', 0) < 1:
                found.append('読み取り専用でも作品の一覧は読める（行が出ていない）')
    elif kind == 'local-saved':
        if facet_status(item, m) != LOCAL_WAITING:
            found.append(f'Local Mode: 保存したあとの状態が {LOCAL_WAITING!r} でない（{facet_status(item, m)!r}）')
    elif kind == 'saving':
        button = boxes[f'#{prefix}-save-btn']
        if facet_status(item, m) != SAVING:
            found.append(f'保存の状態が {SAVING!r} でない（{facet_status(item, m)!r}）')
        if button['visible'] and not (button['disabled'] and float(button['opacity']) <= 0.5):
            found.append('保存中なのに「保存して公開」が押せる')
    elif kind == 'failed':
        if facet_status(item, m) != FAILED:
            found.append(f'保存の状態が {FAILED!r} でない（{facet_status(item, m)!r}）')
        if not texts.get(f'#{prefix}-editor-error'):
            found.append('保存できなかった理由の行が出ていない')
    elif kind == 'leave':
        dialog = texts.get('#live-dialog', '')
        for text in UNSAVED_DIALOG:
            if text not in dialog:
                found.append(f'確認の面に {text!r} が出ていない')
        if not m.get('dialogOpen'):
            found.append('確認の面が開いていない')
        if m.get('active') != 'live-dialog-action-stay':
            found.append(f'確認の面の初期のフォーカスが 編集を続ける でない（{m.get("active")!r}）')
        if facet_status(item, m) != UNSAVED:
            found.append(f'確認の面の後ろの保存の状態が {UNSAVED!r} でない（{facet_status(item, m)!r}）')
    elif kind == 'image-uploading':
        image = (m.get('images') or {}).get(item['image']) or {}
        if image.get('status') != IMAGE_UPLOADING:
            found.append(f'画像の状態が {IMAGE_UPLOADING!r} でない（{image.get("status")!r}）')
        if facet_status(item, m) != UNSAVED:
            found.append(f'アップロード中は未保存のはず（{facet_status(item, m)!r}）')
        button = boxes[f'#{prefix}-save-btn']
        if button['visible'] and not button['disabled']:
            found.append('アップロード中なのに「保存して公開」が押せる')
    elif kind == 'image-failed':
        image = (m.get('images') or {}).get(item['image']) or {}
        if not str(image.get('status', '')).startswith(IMAGE_FAILED) or 'テスト用のアップロードエラー' not in image.get('status', ''):
            found.append(f'画像の失敗の文が {IMAGE_FAILED!r}＋理由 でない（{image.get("status")!r}）')
        if facet_status(item, m) != SAVED:
            found.append(f'アップロードが失敗しても何も未保存にならない（{facet_status(item, m)!r}）')
    elif kind == 'delete-failed':
        if facet_status(item, m) != FAILED:
            found.append(f'削除の失敗のあとの状態が {FAILED!r} でない（{facet_status(item, m)!r}）')
        if not texts.get(f'#{prefix}-editor-error'):
            found.append('削除できなかった理由の行が出ていない')
        if m.get('dialogOpen'):
            found.append('削除の確認の面が開いたまま')
        count = (m.get('rows') or {}).get('count') if item['screen'] == 'news' else ((m.get('lists') or {}).get('works' if item['screen'] == 'music-works' else 'videos') or {}).get('count')
        if count != item['rows']:
            found.append(f'失敗した削除なのに項目が一覧から減っている（{count} / {item["rows"]}）')
    elif kind == 'long-values':
        heading = texts.get(f'#{prefix}-editor-heading', '') if item.get('editing') else ' '.join(m.get('pageHeadings') or [])
        if not heading:
            found.append('長い値の画面の見出しが出ていない')
    elif kind == 'reset-featured':
        if (m.get('fields') or {}).get('site-featured-release-id') != '':
            found.append(f'顔にする作品を削除したのに Site の選択が「自動（最新のリリース）」に戻っていない（{(m.get("fields") or {}).get("site-featured-release-id")!r}）')
    elif kind == 'reset-playback':
        if (m.get('fields') or {}).get('edit-playbackVideoId') != '':
            found.append(f'再生する映像を削除したのに作品の選択が「選ばない」に戻っていない（{(m.get("fields") or {}).get("edit-playbackVideoId")!r}）')
    return found


def check_item(item, m, state):
    """1枚の合否。測っていない値でも例外にならない（Boxes と get）。返すのは不合格の理由の一覧。"""
    found = []
    width = item['width']
    viewport = m.get('viewport', {'width': width, 'height': item['height']})
    if m.get('scrollWidth', 0) > viewport.get('width', width):
        found.append(f'横スクロールが出る（scrollWidth {m.get("scrollWidth")} > 幅 {viewport.get("width")}）')
    if not m:
        found.append('測れていない（metricsが空）')
    found += chrome_findings(item, m)
    if item.get('facet'):
        found += facet_findings(item, m)
    elif item['screen'] == 'chrome':
        if item['state'] in FIVE_TAB_KEYS:
            if m.get('activeTab') != item['state'] or f'{item["state"]}-tab' not in m.get('visiblePanels', []):
                found.append(f'{item["state"]} のタブが開いていない（{m.get("activeTab")} / {m.get("visiblePanels")}）')
    elif item['screen'] == 'news':
        found += news_findings(item, m)
    elif item['screen'] == 'live':
        found += live_findings(item, m)
    elif item['screen'] in ('music-works', 'music-videos'):
        found += music_findings(item, m)
    elif item['screen'] == 'site':
        found += site_findings(item, m)
    elif item['screen'] == 'profile':
        found += profile_findings(item, m)
    for selector, tap in (m.get('taps') or {}).items():
        if tap.get('minHeight', TAP_MIN) < TAP_MIN - 0.5:
            found.append(f'{selector} の高さが {TAP_MIN}px 未満（{tap["minHeight"]}px）')
    if m.get('unnamed'):
        found.append(f'表示名のないボタン・入力がある: {m["unnamed"]}')
    if m.get('covered'):
        found.append('覆われて押せない操作がある: ' + ', '.join(m['covered']))
    for overlap in state.get('overlaps', []):
        found.append(overlap)
    return found


# ----------------------------------------------------------------------------------------------------------
# 契約の検査（--self-check。ブラウザもbindも使わない）
# ----------------------------------------------------------------------------------------------------------
def check_network(results):
    """撮影の終わりの検査: api.fixture.test と 127.0.0.1 以外へのrequestが0件、本番のhostへの通信が0件。違えば失敗にする。"""
    problems = []
    for row in results['captures']:
        if row['other_blocked']:
            problems.append(f'{row["image"]}: 想定外のhostへのrequest {row["other_blocked"]}')
        if row['production_attempts_aborted']:
            problems.append(f'{row["image"]}: 本番のhostへのrequest（abort済み）{row["production_attempts_aborted"]}')
        if row['denied_local_paths']:
            problems.append(f'{row["image"]}: 配らないlocalのpathを呼んだ {row["denied_local_paths"]}')
        for request in row['fixture_api_requests']:
            if not request.split(' ', 1)[1].startswith('/api/admin/'):
                problems.append(f'{row["image"]}: 架空のAPIの想定外の経路 {request}')
    return problems


def check_contract():
    """ブラウザもbindも使わない契約の検査。画像名・scenario・fixture・架空の値・合否の関数だけを確かめる。"""
    plan = build_plan()
    names = [item['file'] for item in plan]
    assert len(names) == len(set(names)), '画像名が重複している: ' + ', '.join(sorted({n for n in names if names.count(n) > 1}))
    assert re.fullmatch(r'.*', names[0]) and all(re.fullmatch(r'[a-z-]+-[a-z-]+-(360|390|821|900|1011|1440)\.png', name) for name in names), names
    # 撮影1と段3・4の82枚は同じ名前で残す（Front の撮影の修正1回の記録と比べられる）
    stage4_names = {f'{screen}-{state}-{width}.png' for width in WIDTHS for screen, states in {
        'chrome': [*FIVE_TAB_KEYS, 'local', 'fallback'],
        'news': ['list', 'empty', 'edit', 'unsaved', 'saving', 'failed', 'delete-confirm', 'leave-confirm', 'new'],
        'live': ['list', 'open'],
        'music-works': ['list', 'empty', 'edit', 'unsaved', 'failed', 'delete-confirm', 'new', 'date-error'],
        'music-videos': ['list', 'empty', 'edit', 'unsaved', 'channel-unsaved', 'id-error', 'delete-confirm'],
        'site': ['edit', 'unsaved', 'failed', 'image-chosen'],
        'profile': ['edit', 'unsaved', 'link-added', 'link-removed']}.items() for state in states}
    assert len(stage4_names) == 82 and stage4_names <= set(names), sorted(stage4_names - set(names))
    assert {item['screen'] for item in plan} == {'chrome', 'news', 'live', 'music-works', 'music-videos', 'site', 'profile', 'fallback', 'local'}
    # 画面 × 幅 × 状態（Requirements §5 の P47-01〜11。P47-12 は #46 の capture-admin-live.py を Front が実行して比べる）
    by_screen = {screen: {item['state'] for item in plan if item['screen'] == screen} for screen in {item['screen'] for item in plan}}
    assert by_screen['chrome'] == set(FIVE_TAB_KEYS) | {'local', 'fallback'}
    assert by_screen['news'] == {'list', 'empty', 'edit', 'unsaved', 'saving', 'failed', 'delete-confirm', 'leave-confirm', 'new', 'image-uploading', 'image-failed', 'delete-failed', 'long-values'}
    assert by_screen['live'] == {'list', 'open'}
    assert by_screen['music-works'] == {'list', 'empty', 'edit', 'unsaved', 'failed', 'delete-confirm', 'new', 'date-error', 'saving', 'leave-confirm', 'image-uploading', 'image-failed',
                                        'delete-failed', 'long-values', 'playback-reset'}
    assert by_screen['music-videos'] == {'list', 'empty', 'edit', 'unsaved', 'channel-unsaved', 'id-error', 'delete-confirm', 'saving', 'failed', 'leave-confirm', 'channel-saving',
                                         'channel-failed', 'delete-failed'}
    assert by_screen['site'] == {'edit', 'unsaved', 'failed', 'image-chosen', 'saving', 'leave-confirm', 'image-uploading', 'image-failed', 'long-values', 'featured-reset'}
    assert by_screen['profile'] == {'edit', 'unsaved', 'link-added', 'link-removed', 'saving', 'failed', 'leave-confirm', 'image-uploading', 'image-failed', 'long-values'}
    assert by_screen['fallback'] == set(FIVE_TAB_KEYS) | {'news-edit', 'works-edit'} and by_screen['local'] == set(FIVE_TAB_KEYS) | {'news-saved'}
    widths_of = lambda screen: sorted({item['width'] for item in plan if item['screen'] == screen})  # noqa: E731
    assert widths_of('chrome') == sorted(PAGE_WIDTHS) and widths_of('site') == sorted(PAGE_WIDTHS) and widths_of('profile') == sorted(PAGE_WIDTHS)
    assert all(widths_of(screen) == sorted(LIST_WIDTHS) for screen in ('news', 'music-works', 'music-videos')), '一覧→編集の画面は全幅（390・360・821・900・1011・1440）'
    assert widths_of('live') == sorted(WIDTHS) and widths_of('fallback') == sorted(WIDTHS) and widths_of('local') == sorted(WIDTHS)
    assert sorted(LIST_WIDTHS) == [360, 390, 821, 900, 1011, 1440] and sorted(PAGE_WIDTHS) == [360, 390, 1440]
    assert len(TINY_PNG) > 40 and TINY_PNG[:8] == b'\x89PNG\r\n\x1a\n'
    for item in plan:
        assert item['width'] in ALL_WIDTHS and item['height'] == HEIGHT_AT[item['width']], item['file']
        assert item['scenario'] in FIXTURE['scenarios'], item['file']
        fake.FakeAdminApi(copy.deepcopy(FIXTURE), item['scenario'], extra_fail=item.get('extra_fail', ()))
        assert all(step[0] in STEP_KINDS for step in item['steps']), item['steps']
        assert set(item['hold']) <= {'put', 'upload'} and set(item.get('extra_fail', [])) <= {'upload'}
        if item.get('facet'):
            assert item['base'][0] in {'chrome', 'news', 'music-works', 'music-videos', 'site', 'profile'}, item['file']
            assert item['prefix'] in {'news', 'music', 'channel', 'site', 'profile', 'live'}, item['file']
        if 'upload' in item['hold'] or 'image-uploading' in item['state']:
            assert item['hold'] == ['upload'], item['file']
    assert {item['scenario'] for item in plan} == {'base', 'empty-lists', 'save-fail', 'local-mode', 'api-fallback', 'delete-fail', 'long-values'}, '撮影2に要るscenario'
    assert len(plan) == len(names) and len(plan) > 82
    # 通信: 本番のAPIへ再送される応答を、架空のAPIは返さない（401・403・404・5xx）。api-fallback は400。
    for scenario in FIXTURE['scenarios']:
        api = fake.FakeAdminApi(copy.deepcopy(FIXTURE), scenario)
        for method, path in [('GET', '/api/admin/site-data'), ('GET', '/api/admin/ticket-reservation-summary'), ('GET', '/api/admin/ticket-reservations')]:
            status = api.handle(method, path)[0]
            assert status not in (401, 403, 404) and status < 500, (scenario, path, status)
        if scenario == 'save-fail':
            assert api.handle('PUT', '/api/admin/site-data', body=json.dumps(api.site).encode())[0] == 400
    assert fake.FakeAdminApi(copy.deepcopy(FIXTURE), 'api-fallback').handle('GET', '/api/admin/site-data')[0] == 400
    assert classify('api.fixture.test') == 'fixture-api' and classify('127.0.0.1') == 'local' and classify('localhost') == 'local'
    assert classify('1212hp.itsukimatsumoto.workers.dev') == 'production' and classify('www.1212hp.com') == 'production' and classify('api.openai.com') == 'production'
    assert classify('fonts.googleapis.com') == 'font' and classify('example.com') == 'other'
    # admin/config.js は実ファイルを読まない（架空の設定を応える）。出力は repo の外。
    source = Path(__file__).read_text(encoding='utf-8')
    assert not re.search(r"(read_text|read_bytes|open)\([^)]*config\.js", source), 'admin/config.js を読む処理がある'
    assert "'/admin/config.js'" in source and 'config_js(item)' in source
    assert b'apiBaseUrl": "https://api.fixture.test"' in config_js({'scenario': 'base'}) and b'workers.dev' not in config_js({'scenario': 'base'})
    assert ROOT not in OUT.parents and OUT != ROOT, '出力先が repo の中'
    # 架空の値だけ
    text = FIXTURE_PATH.read_text(encoding='utf-8')
    assert not re.search(r'https?://(?!(?:[\w.-]+\.)?example\.test|youtu\.be/fixture)', text), 'fixtureに架空でないURLがある'
    assert not re.search(r'1212hp|workers\.dev|itsuki|matsumoto', text, re.I), 'fixtureに本番の値がある'
    assert API_HOST == 'api.fixture.test' and fake.FAKE_TOKEN.startswith('fixture-')
    # 合否の関数: 何も測れていない画面は必ず不合格。正しい値の画面は合格する（合否の検査が効いている）。
    for item in plan:
        assert check_item(item, {}, {}), f'何も測れていない画面が合格してしまう: {item["file"]}'
    for item in plan:
        good = synthetic_metrics(item)
        problems = check_item(item, good, {})
        assert problems == [], (item['file'], problems)
    # 外れた値は不合格になる（上の帯の高さ・タブ・保存して公開・横スクロール・タップの高さ）
    narrow_list = next(i for i in plan if i['file'] == 'news-list-390.png')
    narrow_saved = next(i for i in plan if i['file'] == 'news-edit-390.png')
    tall = synthetic_metrics(narrow_list)
    tall['boxes']['.header']['height'] = 92
    assert any('Header' in f and '46' in f for f in check_item(narrow_list, tall, {})), '高さ92pxの Header が不合格にならない'
    six = synthetic_metrics(narrow_list)
    six['tabs'] = ['Site', 'News', 'Live', 'YouTube', 'Disco', 'Profile']
    assert any('タブが5つ' in f for f in check_item(narrow_list, six, {})), '6タブが不合格にならない'
    shown = synthetic_metrics(narrow_saved)
    shown['boxes']['#news-editor-actions'] = {**ZERO_BOX, 'visible': True, 'position': 'fixed', 'bottom': 844, 'width': 390}
    assert any('変更がない時に「保存して公開」が出ている' in f for f in check_item(narrow_saved, shown, {})), '変更なしで出ている「保存して公開」が不合格にならない'
    unsaved = next(i for i in plan if i['file'] == 'news-unsaved-390.png')
    hidden_bar = synthetic_metrics(unsaved)
    hidden_bar['boxes']['#news-editor-actions'] = {**ZERO_BOX, 'visible': False}
    assert any('未保存の時に「保存して公開」が画面の下に固定で出ていない' in f for f in check_item(unsaved, hidden_bar, {})), '未保存で出ていない「保存して公開」が不合格にならない'
    scroll = synthetic_metrics(narrow_list)
    scroll['scrollWidth'] = 420
    assert any('横スクロール' in f for f in check_item(narrow_list, scroll, {})), '横スクロールが不合格にならない'
    small = synthetic_metrics(narrow_list)
    small['taps']['.occ-row'] = {'count': 6, 'minHeight': 40, 'minWidth': 300}
    assert any('44px 未満' in f for f in check_item(narrow_list, small, {})), '44px未満が不合格にならない'
    wide_idle = next(i for i in plan if i['file'] == 'news-edit-1440.png')
    pressable = synthetic_metrics(wide_idle)
    pressable['boxes']['#news-save-btn']['disabled'] = False
    pressable['boxes']['#news-save-btn']['opacity'] = '1'
    assert any('変更がない時に「保存して公開」が薄く・押せない状態でない' in f for f in check_item(wide_idle, pressable, {})), '幅1440で変更なしでも押せる「保存して公開」が不合格にならない'
    # 撮影1の直し（FIX3）: (a) スマホ幅でライブを開いている間は一覧の行を求めない（一覧の画面と幅1440は求める）、(b)(c) 覆いの検査は見えていない欄と toast を相手にしない
    live_open = next(i for i in plan if i['file'] == 'live-open-390.png')
    hidden_list = synthetic_metrics(live_open)
    hidden_list['liveRows'] = 0
    assert check_item(live_open, hidden_list, {}) == [], 'live-open-390 は一覧の行がなくても合格する（#46 の承認済みの形）'
    live_list = next(i for i in plan if i['file'] == 'live-list-390.png')
    no_rows = synthetic_metrics(live_list)
    no_rows['liveRows'] = 0
    assert any('Liveの一覧の行が出ていない' in f for f in check_item(live_list, no_rows, {})), '一覧の画面で行がないのは不合格'
    assert 'checkVisibility' in METRICS_JS and 'DETAILS' in METRICS_JS and "top.id === 'toast'" in METRICS_JS and 'const shown' in METRICS_JS, '覆いの検査が見えていない欄と toast を除く'
    assert 'shown(e) && e.type' in METRICS_JS and 'clipped(e)' in METRICS_JS
    # 撮影の修正1回の直し（FIX6）: 新規でまだ保存していない作品（一覧に載らない）に「開いている行が aria-current」を求めない。保存済みの作品は求める
    for date_error in (i for i in plan if i['screen'] == 'music-works' and i['state'] == 'date-error'):
        unlisted = synthetic_metrics(date_error)
        assert unlisted['lists']['works']['selected'] == '', '新規の作品は一覧に載らないので、開いている行はない'
        assert not any('aria-current' in f for f in check_item(date_error, unlisted, {})), f'{date_error["file"]}: 一覧に載らない新規の作品に aria-current を求めない'
    for edited in (i for i in plan if i['screen'] == 'music-works' and i['state'] == 'edit'):
        no_current = synthetic_metrics(edited)
        no_current['lists']['works']['selected'] = ''
        assert any('aria-current' in f for f in check_item(edited, no_current, {})), f'{edited["file"]}: 保存済みの作品を開いている時は開いている行が必要'
    # 段3・4: 外れた値は不合格になる（Music・Site・Profile）
    wdc =next(i for i in plan if i['file'] == 'music-works-delete-confirm-1440.png')
    no_sentence = synthetic_metrics(wdc)
    no_sentence['texts']['#live-dialog'] = no_sentence['texts']['#live-dialog'].replace('顔にする作品は「自動（最新のリリース）」に戻ります。', '')
    assert any('顔にする作品は' in f for f in check_item(wdc, no_sentence, {})), '顔にする作品の文がない削除の確認が不合格にならない'
    vdc = next(i for i in plan if i['file'] == 'music-videos-delete-confirm-390.png')
    no_playback = synthetic_metrics(vdc)
    no_playback['texts']['#live-dialog'] = no_playback['texts']['#live-dialog'].replace('再生する映像に選んでいる作品が1件あります。', '')
    assert any('再生する映像に選んでいる作品' in f for f in check_item(vdc, no_playback, {})), '再生する映像の文がない削除の確認が不合格にならない'
    vlist = next(i for i in plan if i['file'] == 'music-videos-list-390.png')
    heading = synthetic_metrics(vlist)
    heading['pageHeadings'] = ['Channel URL']
    assert any('見出しが出ている' in f for f in check_item(vlist, heading, {})), '幅390の Channel URL に見出しが出ていても不合格にならない'
    wunsaved = next(i for i in plan if i['file'] == 'music-works-unsaved-390.png')
    no_bar = synthetic_metrics(wunsaved)
    no_bar['boxes']['#music-editor-actions'] = {**ZERO_BOX, 'visible': False}
    assert any('画面の下に固定で出ていない' in f or '出ていない' in f for f in check_item(wunsaved, no_bar, {})), '未保存で出ていない「保存して公開」が不合格にならない'
    wide_switch = next(i for i in plan if i['file'] == 'music-works-list-1440.png')
    stretched = synthetic_metrics(wide_switch)
    stretched['boxes']['.occ-switch'] = {**ZERO_BOX, 'visible': True, 'width': 1300}
    assert any('中身に合わせた幅' in f for f in check_item(wide_switch, stretched, {})), '幅1440で伸びた切り替えが不合格にならない'
    site_item = next(i for i in plan if i['file'] == 'site-unsaved-390.png')
    missing = synthetic_metrics(site_item)
    missing['pageLabels']['site'] = missing['pageLabels']['site'][:-1]
    assert any('Site の入力欄の名前と並び' in f for f in check_item(site_item, missing, {})), 'Siteの欄が足りなくても不合格にならない'
    profile_item = next(i for i in plan if i['file'] == 'profile-link-added-1440.png')
    four_rows = synthetic_metrics(profile_item)
    four_rows['linkRows'] = 4
    assert any('リンクの行が 5 行でない' in f for f in check_item(profile_item, four_rows, {})), 'リンクの追加が写っていなくても不合格にならない'
    # 撮影2で足した状態: 外れた値は不合格になる（読み取り専用・保存中・確認の面・画像・削除の失敗・参照が戻ること・Local Mode）
    # 撮影2の直し（FIX7）: 書き出し待ちの「JSONを書き出す *」（#46 の Live の Local Mode と同じ表記）も「JSONを書き出す」が出ている、として受け入れる。別の文字は不合格
    local_saved = next(i for i in plan if i['file'] == 'local-news-saved-1440.png')
    pending = synthetic_metrics(local_saved)
    assert pending['texts']['#saveBtn'] == 'JSONを書き出す *' and not any('JSONを書き出す' in f for f in check_item(local_saved, pending, {})), '書き出し待ちの「JSONを書き出す *」を受け入れる'
    for other in ('保存', '保存 *', 'JSON書き出す'):
        wrong = synthetic_metrics(local_saved)
        wrong['texts']['#saveBtn'] = other
        assert any('Headerに「JSONを書き出す」が出ていない' in f for f in check_item(local_saved, wrong, {})), f'{other!r} は「JSONを書き出す」ではない'
    local_plain = next(i for i in plan if i['screen'] == 'local' and i['state'] == 'news')
    assert synthetic_metrics(local_plain)['texts']['#saveBtn'] == 'JSONを書き出す' and not any('JSONを書き出す' in f for f in check_item(local_plain, synthetic_metrics(local_plain), {}))
    by_file = {i['file']: i for i in plan}
    for file, mutate, expected in [
        ('fallback-news-390.png', lambda m: m['controls']['news-add-btn'].update(disabled=False), '押せる・入力できる'),
        ('fallback-music-1440.png', lambda m: m['boxes'].update({'#saveBtn': {**ZERO_BOX, 'visible': True}}), 'Headerに保存のボタンが出ている'),
        ('fallback-news-edit-390.png', lambda m: m.update(bodyClasses=[]), 'is-occ-editing'),
        ('local-news-saved-1440.png', lambda m: m['texts'].update({'#news-editor-status-wide': '保存済み'}), 'JSON書き出し待ち'),
        ('music-works-saving-390.png', lambda m: m['boxes']['#music-save-btn'].update(disabled=False, opacity='1'), '押せる'),
        ('music-works-leave-confirm-1440.png', lambda m: m.update(dialogOpen=False), '確認の面が開いていない'),
        ('music-videos-leave-confirm-821.png', lambda m: m.update(active='live-dialog-action-discard'), '初期のフォーカス'),
        ('news-image-uploading-360.png', lambda m: m['images']['edit-image'].update(status=''), 'アップロードしています'),
        ('news-image-failed-900.png', lambda m: m['images']['edit-image'].update(status='画像をアップロードできませんでした'), '理由'),
        ('site-image-failed-390.png', lambda m: m['texts'].update({'#site-editor-status': '未保存'}), '何も未保存にならない'),
        ('news-delete-failed-1011.png', lambda m: m['rows'].update(count=5), '一覧から減っている'),
        ('music-videos-delete-failed-390.png', lambda m: m['lists']['videos'].update(count=4), '一覧から減っている'),
        ('music-videos-channel-failed-360.png', lambda m: m['texts'].update({'#channel-editor-error': ''}), '理由の行'),
        ('site-featured-reset-1440.png', lambda m: m['fields'].update({'site-featured-release-id': 'fx-release-a'}), '自動'),
        ('music-works-playback-reset-900.png', lambda m: m['fields'].update({'edit-playbackVideoId': 'yt-musicVideos-fixture-1'}), '選ばない'),
        ('profile-leave-confirm-360.png', lambda m: m.update(activeTab='news', visiblePanels=['news-tab']), 'タブだけが出ていない'),
        ('news-long-values-821.png', lambda m: m['texts'].update({'#news-editor-heading': ''}), '見出し'),
    ]:
        bad = synthetic_metrics(by_file[file])
        mutate(bad)
        assert any(expected in f for f in check_item(by_file[file], bad, {})), f'{file}: {expected!r} の外れが不合格にならない'
    # 本番のhostへの通信は失敗にする
    assert check_network({'captures': [{'image': 'x', 'other_blocked': [], 'production_attempts_aborted': ['GET 1212hp.itsukimatsumoto.workers.dev/api'], 'denied_local_paths': [], 'fixture_api_requests': []}]})
    assert check_network({'captures': [{'image': 'x', 'other_blocked': ['GET example.com/'], 'production_attempts_aborted': [], 'denied_local_paths': [], 'fixture_api_requests': []}]})
    assert not check_network({'captures': [{'image': 'x', 'other_blocked': [], 'production_attempts_aborted': [], 'denied_local_paths': [], 'fixture_api_requests': ['GET /api/admin/site-data']}]})
    hand.self_check()
    fake.self_check()
    print(f'契約OK: {len(names)}画像 / {len({i["screen"] for i in plan})}画面 / {len({i["scenario"] for i in plan})}scenario（ブラウザ・bindなし）', flush=True)


def synthetic_metrics(item):
    """画面ごとの「正しい値」の見本（--self-check が合否の検査を確かめるための値。ブラウザで測った値ではない）。"""
    if item.get('base'):  # 撮影2で足した状態: 土台の画面・状態の見本に、その状態で見る所（facet）の値を重ねる
        screen, state = item['base']
        m = synthetic_metrics({**item, 'screen': screen, 'state': state, 'base': None, 'facet': None})
        overlay_facet(item, m)
        return m
    width, height = item['width'], item['height']
    wide = width >= 900
    scenario, screen, state = item['scenario'], item['screen'], item['state']
    box = lambda **kw: {**ZERO_BOX, **kw}  # noqa: E731
    m = {'viewport': {'width': width, 'height': height}, 'scrollWidth': width, 'bodyClasses': [], 'tabs': FIVE_TABS, 'tabKeys': FIVE_TAB_KEYS,
         'activeTab': 'live', 'visiblePanels': ['live-tab'], 'boxes': {}, 'lines': {}, 'taps': {}, 'texts': {}, 'unnamed': [], 'covered': [], 'rows': {},
         'fields': {}, 'fieldLabels': [], 'dialogOpen': False, 'active': '', 'liveRows': 1, 'liveEditing': False, 'chrome': {'header': True, 'tabNav': True, 'banner': False}}
    header_height = band_height(width, scenario == 'local-mode')
    m['boxes']['.header'] = box(visible=True, height=header_height)
    m['boxes']['.tab-nav'] = box(visible=True, height=tabs_height(width))
    m['boxes']['#modeBadge'] = box(visible=True, x=width - 100, width=70)
    m['texts']['#modeBadge'] = {'api-fallback': 'API Fallback', 'local-mode': 'Local Mode'}.get(scenario, '接続中')
    m['texts']['#connectionBanner'] = ''
    if scenario == 'api-fallback':
        m['chrome']['banner'] = True
        m['texts']['#connectionBanner'] = 'API接続失敗（ローカルJSONを読み取り専用で表示）'
    if scenario == 'local-mode':
        m['chrome']['banner'] = True
        m['texts']['#connectionBanner'] = 'ローカルJSONモード（従来運用）'
        m['boxes']['#saveBtn'] = box(visible=True, x=width - 220, width=120)
        m['texts']['#saveBtn'] = 'JSONを書き出す'
    if screen == 'chrome' and state in FIVE_TAB_KEYS:
        m['activeTab'] = state
        m['visiblePanels'] = [f'{state}-tab']
    if screen == 'live':
        m['liveEditing'] = state == 'open'
        if state == 'open' and not wide:
            m['chrome'] = {'header': False, 'tabNav': False, 'banner': False}
        if state == 'open' and wide:
            m['boxes']['#live-editor-pane'] = box(visible=True)
    if screen == 'news':
        m['activeTab'], m['visiblePanels'] = 'news', ['news-tab']
        editing = state in NEWS_EDITING
        m['rows'] = {'count': 0 if state == 'empty' else 6, 'selected': NEWS_ID if editing and state not in {'new', 'leave-confirm'} else '', 'firstText': '2026/11/20 架空'}
        m['texts']['#news-list'] = 'まだ登録がありません。' if state == 'empty' else '架空'
        m['boxes']['#news-list-pane'] = box(visible=not (editing and not wide), width=320, right=352)
        m['boxes']['#news-editor-pane'] = box(visible=wide or editing, x=376)
        if wide:
            m['boxes']['#news-editor-empty'] = box(visible=not editing)
            m['texts']['#news-editor-empty'] = '' if editing else '一覧から選ぶか、「+ 追加」を押してください。'
            m['boxes']['#news-editor-card'] = box(visible=editing)
        else:
            m['bodyClasses'] = ['is-occ-editing'] if editing else []
            if editing:
                m['chrome'] = {'header': False, 'tabNav': False, 'banner': False}
                m['boxes']['#news-editor-bar'] = box(visible=True, height=47)
                m['lines']['#news-editor-title'] = 1
        if editing:
            m['fieldLabels'] = ['日付', 'タイトル', '説明', '画像', '詳細リンクURL', 'リンクテキスト']
            m['fields'] = {'edit-title': '' if state == 'new' else 'x', 'edit-linkText': 'view...' if state == 'new' else 'x'}
            m['texts']['#news-editor-heading'] = '新しいお知らせ' if state == 'new' else 'お知らせを編集'
            m['texts']['#news-editor-status' if not wide else '#news-editor-status-wide'] = NEWS_STATUS[state]
            if state != 'new':
                m['boxes']['#news-delete-btn'] = box(visible=True)
                m['texts']['#news-delete-btn'] = 'このお知らせを削除'
            dirty = state in NEWS_DIRTY
            heading = box(visible=True, x=400, y=163, height=30, bottom=193)
            m['boxes']['#news-editor-heading'] = heading
            if wide:
                m['boxes']['#news-save-btn'] = box(visible=True, x=1249, y=163, height=46, width=135, disabled=(not dirty) or state == 'saving', opacity='1' if dirty and state != 'saving' else '0.4')
                m['boxes']['#news-editor-actions'] = box(visible=True, position='static')
            else:
                shown = dirty
                m['boxes']['#news-editor-actions'] = box(visible=shown, position='fixed', bottom=height, width=width)
                m['boxes']['#news-save-btn'] = box(visible=shown, x=16, y=height - 60, height=46, width=width - 32, disabled=state == 'saving', opacity='0.4' if state == 'saving' else '1')
            if state == 'saving' and wide:
                m['boxes']['#news-save-btn']['disabled'] = True
            m['lines']['#news-save-btn'] = 1 if m['boxes']['#news-save-btn']['visible'] else 0
            if state == 'failed':
                m['texts']['#news-editor-error'] = 'テスト用の保存エラー'
                m['boxes']['#news-editor-error'] = box(visible=True, y=200 if wide else height - 90, bottom=222 if wide else height - 66)
            if state in {'delete-confirm', 'leave-confirm'}:
                m['dialogOpen'] = True
                m['texts']['#live-dialog'] = ('「テスト \"引用符\" のお知らせ」を削除しますか。 削除すると公開画面からも消えます。 やめる 削除する' if state == 'delete-confirm'
                                              else '保存していない変更があります。 破棄して移動 編集を続ける')
                m['active'] = 'live-dialog-action-cancel' if state == 'delete-confirm' else 'live-dialog-action-stay'
        else:
            m['boxes']['#news-editor-actions'] = box(visible=False)
    if screen in ('music-works', 'music-videos'):
        synthetic_music(item, m)
    if screen in ('site', 'profile'):
        synthetic_page(item, m)
    return m


def synthetic_item_bar(m, item, prefix, heading_box, *, dirty, saving=False, failed=False, fixed=True):
    """見本: 「保存して公開」の箱（save_bar_findings が合格する正しい値）。"""
    width, height, wide = item['width'], item['height'], item['width'] >= 900
    box = lambda **kw: {**ZERO_BOX, **kw}  # noqa: E731
    m['boxes'][f'#{prefix}-editor-heading' if prefix in ('music', 'news') else f'#{prefix}-heading'] = heading_box
    show = dirty or saving or failed
    if wide:
        m['boxes'][f'#{prefix}-save-btn'] = box(visible=True, x=1249, y=heading_box['y'], height=46, width=135, disabled=(not dirty) or saving, opacity='1' if dirty and not saving else '0.4')
        m['boxes'][f'#{prefix}-editor-actions'] = box(visible=True, position='static')
    elif fixed:
        m['boxes'][f'#{prefix}-editor-actions'] = box(visible=show, position='fixed', bottom=height, width=width)
        m['boxes'][f'#{prefix}-save-btn'] = box(visible=show, x=16, y=height - 60, height=46, width=width - 32, disabled=saving, opacity='0.4' if saving else '1')
    else:
        m['boxes'][f'#{prefix}-editor-actions'] = box(visible=show, position='static')
        m['boxes'][f'#{prefix}-save-btn'] = box(visible=show, x=16, y=500, height=46, width=width - 64, disabled=saving, opacity='1')
    m['lines'][f'#{prefix}-save-btn'] = 1 if m['boxes'][f'#{prefix}-save-btn']['visible'] else 0


def synthetic_music(item, m):
    width, height, state, screen = item['width'], item['height'], item['state'], item['screen']
    wide, works = width >= 900, screen == 'music-works'
    box = lambda **kw: {**ZERO_BOX, **kw}  # noqa: E731
    states = WORK_STATES if works else VIDEO_STATES
    editing = state in states
    m['activeTab'], m['visiblePanels'] = 'music', ['music-tab']
    m['switchState'] = {'works': 'true' if works else 'false', 'videos': 'false' if works else 'true'}
    empty = state == 'empty'
    selected = (WORK_ID if works else VIDEO_ID) if state in {'edit', 'unsaved', 'failed', 'delete-confirm'} and not (not works and state == 'failed') else ''
    shape = lambda count, groups, thumbs, sel: {'visible': True, 'count': count, 'selected': sel, 'groups': groups if count else [], 'thumbs': thumbs, 'firstText': '架空', 'empty': count == 0}  # noqa: E731
    m['lists'] = {'works': shape(0 if empty else 4, ['Digital Release', '宅録Demo'], 4, selected if works else ''),
                  'videos': shape(0 if empty else 5, ['Music Video', 'Live Movie', 'Demo'], 0, selected if not works else '')}
    m['texts']['#music-list-title'] = '作品' if works else '映像'
    list_visible = wide or not editing
    m['boxes']['#music-list-pane'] = box(visible=list_visible, width=320 if wide else width - 32, right=352)
    m['boxes']['#music-editor-pane'] = box(visible=wide or editing, x=376)
    m['boxes']['#music-add-btn'] = box(visible=list_visible, height=48)
    m['boxes']['.occ-switch'] = box(visible=list_visible, width=134 if wide else width - 32)
    m['boxes']['.occ-music-top'] = box(visible=list_visible)
    if wide:
        m['boxes']['#music-editor-empty'] = box(visible=not editing)
        m['texts']['#music-editor-empty'] = '' if editing else '一覧から選ぶか、「+ 追加」を押してください。'
        m['boxes']['#music-editor-card'] = box(visible=editing)
    else:
        m['bodyClasses'] = ['is-occ-editing'] if editing else []
        if editing:
            m['chrome'] = {'header': False, 'tabNav': False, 'banner': False}
            m['boxes']['#music-editor-bar'] = box(visible=True, height=47)
            m['lines']['#music-editor-title'] = 1
    if not works and list_visible:
        dirty = state == 'channel-unsaved'
        m['boxes']['#music-channel-panel'] = box(visible=True)
        m['boxes']['#youtube-channel-url'] = box(visible=True, y=233, bottom=285)
        m['boxes']['#channel-editor-status'] = box(visible=True, y=293)
        m['texts']['#channel-editor-status'] = UNSAVED if dirty else SAVED
        m['pageHeadings'] = ['Channel URL'] if wide else []
        m['boxes']['#music-channel-heading'] = box(visible=wide, x=56, y=229, height=30, bottom=259)
        synthetic_item_bar(m, item, 'channel', m['boxes']['#music-channel-heading'], dirty=dirty, fixed=False)
        if dirty:
            m['fields']['youtube-channel-url'] = 'https://example.test/@typed-channel'
    if editing:
        m['fieldLabels'] = WORK_LABELS if works else VIDEO_LABELS
        fresh = state in {'new', 'date-error', 'id-error'}
        m['texts']['#music-editor-heading'] = ('新しい作品' if fresh else '作品を編集') if works else ('新しい映像' if fresh else '映像を編集')
        m['texts']['#music-editor-status' if not wide else '#music-editor-status-wide'] = states[state]
        if not fresh:
            m['boxes']['#music-delete-btn'] = box(visible=True)
            m['texts']['#music-delete-btn'] = 'この作品を削除' if works else 'この映像を削除'
        m['fields']['edit-title'] = '' if state == 'new' else 'x'
        m['fields']['edit-category'] = ('digital' if works else 'musicVideos') if fresh else 'x'
        heading_box = box(visible=True, x=400, y=163, height=30, bottom=193)
        synthetic_item_bar(m, item, 'music', heading_box, dirty=state in ITEM_DIRTY, failed=state == 'failed')
        if state == 'failed':
            m['texts']['#music-editor-error'] = 'テスト用の保存エラー'
            m['boxes']['#music-editor-error'] = box(visible=True, y=200 if wide else height - 90, bottom=222 if wide else height - 66)
        if state == 'date-error':
            m['errors'] = {'releaseDate': DATE_ERROR_TEXT, 'releaseDateInvalid': 'true', 'youtube': '', 'youtubeInvalid': 'false'}
        if state == 'id-error':
            m['errors'] = {'releaseDate': '', 'releaseDateInvalid': 'false', 'youtube': ID_ERROR_TEXT, 'youtubeInvalid': 'true'}
    else:
        m['boxes']['#music-editor-actions'] = box(visible=False)
    if state == 'delete-confirm':
        m['dialogOpen'] = True
        m['texts']['#live-dialog'] = ' '.join(DELETE_TEXT[screen])
        m['active'] = 'live-dialog-action-cancel'


def synthetic_page(item, m):
    width, state, screen = item['width'], item['state'], item['screen']
    box = lambda **kw: {**ZERO_BOX, **kw}  # noqa: E731
    site = screen == 'site'
    m['activeTab'], m['visiblePanels'] = screen, [f'{screen}-tab']
    dirty = state != 'edit' if not site else state in {'unsaved', 'failed', 'image-chosen'}
    expected = FAILED if state == 'failed' else (UNSAVED if dirty else SAVED)
    m['texts'][f'#{screen}-editor-status'] = expected
    if site:
        m['pageHeadings'] = ['Home', 'Home Links', 'Footer', 'Contact']
        m['pageLabels'] = {'site': SITE_LABELS, 'profile': []}
        title = box(visible=True, x=32, y=139, height=30, bottom=169)
        m['boxes']['.occ-page-title'] = title
        m['boxes']['.occ-page-head'] = box(visible=True, width=880)
        synthetic_item_bar(m, item, 'site', title, dirty=dirty, failed=state == 'failed')
        if state in {'unsaved', 'failed'}:
            m['fields']['site-footer-text'] = '未保存のフッター'
        if state == 'image-chosen':
            m['images'] = {'site-hero-image': {'value': 'https://api.fixture.test/fake-images/uploaded-1.jpg', 'path': 'URL: https://api.fixture.test/fake-images/uploaded-1.jpg', 'status': ''}}
    else:
        rows = {'link-added': 5, 'link-removed': 3}.get(state, 4)
        m['pageHeadings'] = ['Profile', 'SNSリンク']
        m['pageLabels'] = {'site': [], 'profile': ['写真', 'プロフィールテキスト'] + ['名前', 'URL'] * rows}
        m['linkRows'] = rows
        heading = box(visible=True, x=56, y=163, height=30, bottom=193)
        m['boxes']['#profile-heading'] = heading
        m['boxes']['#profile-link-add-btn'] = box(visible=True, height=48)
        synthetic_item_bar(m, item, 'profile', heading, dirty=dirty)
        m['fields']['profile-text'] = '未保存のプロフィール' if state == 'unsaved' else 'a\nb\nc\n\nd\ne\nf\ng\nh'
    if state == 'failed':
        m['texts'][f'#{screen}-editor-error'] = 'テスト用の保存エラー'
        m['boxes'][f'#{screen}-editor-error'] = box(visible=True, y=200, bottom=222)


def overlay_facet(item, m):
    """見本: 撮影2で足した状態（facet）の正しい値（facet_findings が合格する値）。土台の見本 m を書き換える。"""
    kind, prefix, tab = item['facet'], item['prefix'], item.get('tab')
    wide = item['width'] >= 900
    box = lambda **kw: {**ZERO_BOX, **kw}  # noqa: E731
    if tab:
        m['activeTab'], m['visiblePanels'] = tab, [f'{tab}-tab']
    texts, boxes = m['texts'], m['boxes']
    status_selector = None
    if prefix in STATUS_SELECTOR:
        status_selector = STATUS_SELECTOR[prefix][1 if wide else 0]

    def set_status(text):
        if status_selector:
            texts[status_selector] = text

    def set_button(**kw):
        boxes[f'#{prefix}-save-btn'] = box(visible=True, height=46, width=135 if wide else item['width'] - 32, **kw)

    if item.get('editing') and not wide:
        m['bodyClasses'] = ['is-occ-editing']
        m['chrome'] = {'header': False, 'tabNav': False, 'banner': False}
    if item.get('editing') and wide:
        boxes['#news-editor-card' if prefix == 'news' else '#music-editor-card'] = box(visible=True)
    if kind == 'read-only':
        ids = [READ_ONLY_PRIMARY[prefix], *READ_ONLY_OTHERS[prefix]]
        editing = bool(item.get('editing'))
        # 一覧の画面では「+ 追加」（主な操作）と最初の入力・ボタンが見え、編集の画面では「+ 追加」は隠れる。見えているものはすべて押せない・入力できない。
        m['controls'] = {i: {'visible': (not editing) if index == 0 else index == 1, 'disabled': True} for index, i in enumerate(ids)}
        if prefix == 'live':
            m['controls'] = {'live-add-btn': {'visible': True, 'disabled': True}}
        if not editing:
            m['rows'] = {'count': 6, 'selected': '', 'firstText': '架空'}
            m['lists'] = {'works': {'visible': True, 'count': 4, 'selected': '', 'groups': [], 'empty': False}, 'videos': {'visible': False, 'count': 5, 'selected': '', 'groups': [], 'empty': False}}
    elif kind == 'local-saved':
        set_status(LOCAL_WAITING)
        m['texts']['#saveBtn'] = 'JSONを書き出す *'  # 書き出し待ちの間（#46 の Live の Local Mode と同じ表記）
    elif kind == 'saving':
        set_status(SAVING)
        set_button(disabled=True, opacity='0.4')
    elif kind == 'failed':
        set_status(FAILED)
        texts[f'#{prefix}-editor-error'] = 'テスト用の保存エラー'
    elif kind == 'leave':
        set_status(UNSAVED)
        m['dialogOpen'] = True
        texts['#live-dialog'] = ' '.join(UNSAVED_DIALOG)
        m['active'] = 'live-dialog-action-stay'
    elif kind == 'image-uploading':
        set_status(UNSAVED)
        m['images'] = {item['image']: {'value': '', 'path': '', 'status': IMAGE_UPLOADING}}
        set_button(disabled=True, opacity='0.4')
    elif kind == 'image-failed':
        set_status(SAVED)
        m['images'] = {item['image']: {'value': '', 'path': '', 'status': f'{IMAGE_FAILED}: テスト用のアップロードエラー'}}
    elif kind == 'delete-failed':
        set_status(FAILED)
        texts[f'#{prefix}-editor-error'] = 'テスト用の削除エラー'
        count = item['rows']
        if item['screen'] == 'news':
            m['rows'] = {'count': count, 'selected': NEWS_ID, 'firstText': '架空'}
        else:
            m['lists'] = {'works': {'visible': True, 'count': count if item['screen'] == 'music-works' else 4, 'selected': '', 'groups': [], 'empty': False},
                          'videos': {'visible': True, 'count': count if item['screen'] == 'music-videos' else 5, 'selected': '', 'groups': [], 'empty': False}}
    elif kind == 'long-values':
        if item.get('editing'):
            texts[f'#{prefix}-editor-heading'] = 'お知らせを編集' if prefix == 'news' else '作品を編集'
        else:
            m['pageHeadings'] = ['Home', 'Home Links', 'Footer', 'Contact'] if prefix == 'site' else ['Profile', 'SNSリンク']
    elif kind == 'reset-featured':
        m['fields']['site-featured-release-id'] = ''
    elif kind == 'reset-playback':
        m['fields']['edit-playbackVideoId'] = ''


def capture_all(args):
    from playwright.sync_api import sync_playwright
    SHOTS.mkdir(parents=True, exist_ok=True)
    widths = {int(w) for w in args.width.split(',')} if args.width else None
    plan = [item for item in build_plan() if (not args.only or args.only in item['file']) and (widths is None or item['width'] in widths)]
    results = {'ui_route': UI_ROUTE, 'fixture': 'test/fixtures/admin-occasional-states.json', 'fixture_sha256': hashlib.sha256(FIXTURE_BYTES).hexdigest(),
               'base': args.base, 'clock_seconds': CLOCK_SECONDS, 'expected_images': expected_images(), 'captures': [], 'status': 'running',
               'network': '本番のAPI・予約・AIのprovider・X投稿の画面へ届いたrequestは0件（localhostと架空のhost以外は全件abort。abortの一覧は各枚の blocked_external_requests）。',
               'visual_review': '未実施。Frontが全画像をFigma v2（figma-snapshot-v2）と並べて確認する。画素の比較はない。font は取得を遮断しているため代替fontで描かれる（文字の最終確認は別）。',
               'production_data': '未実施（本番の値では撮らない）。本番の見え方はmerge後にItsukiが確認する。'}
    try:
        with sync_playwright() as p:
            launch = {'headless': True}
            if args.chromium:
                launch['executable_path'] = args.chromium
            browser = p.chromium.launch(**launch)
            results['browser'] = browser.version
            for item in plan:
                run_capture(browser, results, args.base, item)
            browser.close()
        failed = results.get('failed_captures', [])
        network_problems = check_network(results)
        results['network_problems'] = network_problems
        actual = sorted(Path(row['image']).name for row in results['captures'])
        assert actual == sorted(item['file'] for item in plan), '撮影名・件数が契約と一致しない'
        for problem in network_problems:
            print('FAIL network:', problem, flush=True)
        results['status'] = ('captured; visual acceptance pending' if not failed and not network_problems
                             else f'{len(failed)} image(s) failed the structure checks; {len(network_problems)} network problem(s)')
        print(f'{len(actual)}画像。構造と実測の確認は{"すべて合格" if not failed else str(len(failed)) + "枚が不合格"}。'
              f'本番へ届いたrequest: {sum(len(r["production_attempts_aborted"]) for r in results["captures"])}件。全画像の目視は別の受入。', flush=True)
        if failed or network_problems:
            raise SystemExit(1)  # 不合格があっても最後まで撮り、ここでまとめて失敗にする
    except SystemExit:
        raise
    except Exception:
        results['status'] = 'failed'
        results['failure'] = traceback.format_exc(limit=3)
        traceback.print_exc()
        raise
    finally:
        METRICS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--base', default=DEFAULT_BASE, help='応えるページの見かけの配信元（serverは要らない。route が応える）')
    parser.add_argument('--chromium', help='既存Chromiumの実行ファイル（download・installしない）')
    parser.add_argument('--only', help='ファイル名にこの文字列を含む画面だけ撮る')
    parser.add_argument('--width', help='この幅だけ撮る（カンマ区切り。例: 821,900,1011）')
    parser.add_argument('--self-check', action='store_true', help='ブラウザもbindも使わず契約だけ検査する')
    args = parser.parse_args()
    if args.self_check:
        check_contract()
        return
    OUT.mkdir(parents=True, exist_ok=True)
    log = LOG_PATH.open('w', buffering=1, encoding='utf-8')

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
