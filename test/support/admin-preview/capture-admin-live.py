"""管理画面（Live・予約・Ticket Page共通設定）の撮影（Issue #46）。Front用。架空のAPIと架空のfixtureだけを使う。

execution target（worktreeのroot）で、1行で全画面を撮る:
  /usr/bin/python3 test/support/admin-preview/capture-admin-live.py
--only <部分文字列> でファイル名に一致する画面だけを撮り直せる。--chromium は入っている実行ファイルだけを指定する（download・installしない）。
--self-check はブラウザもbindも使わず、契約（画像名・scenario・架空の値）だけを検査する。

仕組み（計画 §6）:
- 静的配信のserverもbindも要らない。context.route が、管理画面に必要なファイル（admin/index.html・app.js・style.css、assets/css・assets/js）だけを
  repoから応える（admin/config.js・admin/data・.git・他は配らない）。--base は応えるページの見かけの配信元（既定 http://127.0.0.1:8080）。
- admin/config.js は実ファイルを読まず、架空の設定（apiBaseUrl: https://api.fixture.test、架空の合言葉）で応える。
- https://api.fixture.test/** は fake_admin_api.py が応える（メモリ上の架空のデータ。scenario で応答を切り替える）。
  https://img.example.test/** と assets/images/** は架空の画像を応える。
- それ以外はすべて abort して記録する。本番のAPI・予約・AIのprovider・X投稿の画面へ届いたrequestは0件（全件abort）。管理画面の adminFetch は
  401・403・404・5xx を受けると本番のAPIへ再送する作りなので、それらを返すscenario（api-fallback・予約の取得失敗）では再送の試みが出る。
  予約の数の読み取り（summary-404/401/500）は再送しない作り（allowBaseFallback: false。review RV46-04）なので、試みが出たら不合格にする。
  試みは abort されて記録され、期待したscenario以外で試みがあれば不合格にする。
- 時計は page.clock.install(time=...)（秒）で固定する。window.open（X投稿の画面）は呼び出しだけを記録し、開かない。
- 画面 P46-01〜16 × 幅 × 状態を1枚ずつ撮り、各枚の構造・実測（metrics）を検査する。不合格があっても最後まで撮り、末尾でまとめて失敗（exit 1）にする。
- 行数は文字 node の Range.getClientRects の行で数える（要素の高さで判断しない）。
画像は verification/screenshots/、metrics は capture-admin-live-metrics.json、log は capture-admin-live.log。
撮影画像の全件目視・同じfontでの文字確認・本番の公開データでの画面確認は Front と Itsuki が別に行う（このscriptは画素を比べない）。
"""
import argparse
import os
import tempfile
import copy
from datetime import datetime, timezone
import hashlib
import json
import mimetypes
from pathlib import Path
import re
import sys
import traceback
from urllib.parse import unquote, urlparse

sys.dont_write_bytecode = True  # verification/ に __pycache__ を作らない
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fake_admin_api as fake  # noqa: E402
import fake_admin_server as hand  # noqa: E402

ROOT = fake.ROOT
# 画像・実測・log は repo の外（既定は一時 directory。ADMIN_CAPTURE_OUT で変えられる）に書く。repo の中に未追跡のファイルを作らない。
OUT = Path(os.environ.get('ADMIN_CAPTURE_OUT') or (Path(tempfile.gettempdir()) / 'admin-live-capture'))
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = OUT / 'screenshots'
METRICS_PATH = OUT / 'capture-admin-live-metrics.json'
LOG_PATH = OUT / 'capture-admin-live.log'
UI_ROUTE = 'ui_route=headless_acceptance:AC46-01,AC46-04,AC46-11,AC46-14'
FIXTURE = fake.load_fixture()
FIXTURE_BYTES = fake.FIXTURE_PATH.read_bytes()
DEFAULT_BASE = 'http://127.0.0.1:8080'
CLOCK_SECONDS = int(datetime(2026, 11, 20, 3, 0, 0, tzinfo=timezone.utc).timestamp())  # fixture.meta.today = 2026-11-20。Python Playwrightの数値単位は秒
API_HOST = urlparse(fake.API_ORIGIN).hostname
IMAGE_HOST = fake.FAKE_IMAGE_HOST
# YouTubeタブの見本のthumbnail。本番のAPI・予約・AI providerではない。scriptが架空の画像で応える（実際の取得はしない）。
FIXTURE_IMAGE_HOSTS = {IMAGE_HOST, 'img.youtube.com'}
FONT_HOSTS = {'fonts.googleapis.com', 'fonts.gstatic.com'}
PRODUCTION_SUFFIXES = ('.workers.dev', '1212hp.com', 'openai.com', 'anthropic.com', 'twitter.com', 'x.com', 'cloudflare.com', 'github.com')
SIX_TABS = ['Site', 'News', 'Live', 'YouTube', 'Disco', 'Profile']
WIDE = 900
# 401・403・404・5xx を返すと管理画面は本番のAPIへ再送する。再送の試みが出てよいscenario（試みはabortされる）。
RETRY_SCENARIOS = {'api-fallback'}  # 予約の数の読み取り（summary-*）は再送しない（review RV46-04）。試みが出たら期待外
SCENARIOS_WITH_PROMPT = {'summary-401'}  # 401は合言葉の再入力の窓（window.prompt）を開く。撮影は閉じる（未入力）
ALL_WIDTHS = [390, 360, 821, 900, 1011, 1440]
BASIC_WIDTHS = [390, 360, 1440]
TWO = [390, 1440]
ANNOUNCE_COMMENT = '架空のひとこと'  # 「ひとことが入っている」状態の撮影だけで fx-live-long に足す架空の文（fixtureは変えない）
TAP_SELECTORS = ['.live-row', '.live-list-tab', '.live-workspace-tab', '.live-editor-task-tab', '.live-collapse-summary', '.live-segment-option',
                 '.reservation-chip', '.reservation-row', '.reservation-row-action', '.live-text-button', '#live-editor-footer .btn',
                 '#ticket-settings-save-btn', '#live-editor-back', '#live-ticket-settings-close', '.live-dialog-actions .btn',
                 '.reservation-detail-actions .btn', '#live-reservation-add-btn', '#x-intent-btn', '#live-postsave-x-btn', '#live-source-parse-btn',
                 '.live-switch-row', '#live-add-btn', '#live-ticket-settings-open']
LINE_SELECTORS = ['#live-editor-save-btn', '#live-list-upcoming-tab', '#live-list-past-tab', '#live-editor-back', '#live-editor-heading',
                  '#live-editor-save-status', '#live-ticket-settings-title', '#ticket-settings-status', '#live-ticket-settings-close']
BOX_SELECTORS = ['#live-master-pane', '#live-editor-pane', '.live-editor-header', '#live-editor-task-tabs', '#live-editor-footer', '#live-editor-save-btn',
                 '#edit-date', '#edit-venue', '#edit-title', '#edit-openTime', '#edit-startTime', '#edit-ticket', '#edit-notes', '#edit-performers',
                 '#edit-xComment', '#x-post-preview', '#live-reservation-list-view', '#live-reservation-detail', '#manual-reservation-form',
                 '#tickets-list-view', '#tickets-detail-view', '#live-ticket-settings-panel', '#ticket-settings-actions', '#ticket-settings-save-btn',
                 '.live-flyer-preview', '#live-dialog', '#live-dialog-overlay', '.reservation-table-head', '.reservation-cell-contact',
                 '.reservation-row-action', '#live-postsave', '#live-source-intake', '#live-public-fields', '#live-source-parse-btn', '#live-manual-entry-btn',
                 '#edit-sourceText', '#edit-ticketUrl', '#live-links-details', '#edit-image-select-btn', '#edit-image-clear-btn', '.live-flyer-actions',
                 '#edit-date-error', '#edit-venue-error', '#live-add-btn', '.live-workspace-tabs', '#live-workspace-page-tab', '#live-workspace-reservations-tab',
                 '#live-draft-notice']
TEXT_SELECTORS = ['#live-summary-note', '#live-editor-save-error', '#live-editor-save-status', '#live-editor-heading', '#live-dialog',
                  '#live-upcoming-list', '#live-past-list', '#live-reservation-ledger', '#live-reservation-detail', '#reservation-detail-error',
                  '#manual-reservation-error', '#tickets-list', '#ticket-settings-status', '#ticket-settings-error', '#live-source-warnings',
                  '#live-category-warning', '#live-postsave', '#live-copy-status', '#edit-date-error', '#edit-venue-error', '#live-source-parse-btn',
                  '#modeBadge', '#connectionBanner', '#live-editor-reservation-count', '#live-editor-body', '#live-draft-notice']

METRICS_JS = r"""(cfg) => {
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
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
  const q = s => document.querySelector(s);
  const nameOf = e => {
    const labelledby = (e.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent.trim() || '').join(' ').trim();
    const label = e.labels && e.labels[0] ? e.labels[0].textContent.trim() : '';
    return (e.getAttribute('aria-label') || labelledby || label || (e.tagName === 'BUTTON' ? e.textContent.trim() : '') || e.getAttribute('title') || '').trim();
  };
  const out = {viewport: {width: innerWidth, height: innerHeight}, scrollWidth: document.documentElement.scrollWidth, bodyClasses: [...document.body.classList]};
  out.chrome = {header: visible(q('.header')), tabNav: visible(q('.tab-nav')), banner: visible(q('.connection-banner')),
    sectionHeader: visible(q('#live-tab > .section-header')), workspaceTabs: visible(q('.live-workspace-tabs')), listToolbar: visible(q('.live-page-toolbar'))};
  out.tabs = [...document.querySelectorAll('.tab-btn')].map(b => b.textContent.trim());
  out.badgeTitle = (q('#modeBadge') || {getAttribute: () => ''}).getAttribute('title') || '';
  out.saveBtn = {visible: visible(q('#saveBtn')), text: (q('#saveBtn') || {}).textContent || '', disabled: !!(q('#saveBtn') || {}).disabled};
  const inputs = [...document.querySelectorAll('input,textarea,select')].filter(e => visible(e) && !['hidden', 'file'].includes(e.type));
  out.fullyVisibleInputs = inputs.filter(e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; }).length;
  out.visibleInputs = inputs.length;
  out.unnamed = [...document.querySelectorAll('button,input,textarea,select')].filter(e => visible(e) && !['hidden', 'file'].includes(e.type) && !nameOf(e)).map(e => ({tag: e.tagName, id: e.id, className: e.className}));
  out.lines = {}; for (const s of cfg.lineSelectors) { const e = q(s); if (e) out.lines[s] = visible(e) ? lines(e) : 0; }
  out.boxes = {};
  for (const s of cfg.boxSelectors) { const e = q(s); if (e) { const c = getComputedStyle(e); out.boxes[s] = {visible: visible(e), ...box(e), disabled: !!e.disabled, opacity: c.opacity, position: c.position, display: c.display}; } }
  out.taps = {};
  for (const s of cfg.tapSelectors) { const items = [...document.querySelectorAll(s)].filter(visible); if (items.length) out.taps[s] = {count: items.length, minHeight: Math.min(...items.map(e => e.getBoundingClientRect().height)), minWidth: Math.min(...items.map(e => e.getBoundingClientRect().width))}; }
  out.texts = {}; for (const s of cfg.textSelectors) { const e = q(s); if (e) out.texts[s] = visible(e) ? e.innerText.trim() : ''; }
  out.values = {}; for (const s of ['#edit-xComment', '#x-post-preview']) { const e = q(s); if (e) out.values[s] = e.value; }
  out.counts = {
    rows: [...document.querySelectorAll('.live-row')].filter(visible).length, seats: [...document.querySelectorAll('.live-row-seats')].filter(visible).length,
    pending: [...document.querySelectorAll('.live-row-pending')].filter(visible).length, nextLive: [...document.querySelectorAll('.next-live-badge')].filter(visible).length,
    reservationRows: [...document.querySelectorAll('.reservation-row')].filter(visible).length,
    cells: [...document.querySelectorAll('.reservation-cell')].filter(visible).length,
    rowActions: [...document.querySelectorAll('.reservation-row-action')].filter(visible).length,
    chips: [...document.querySelectorAll('.reservation-chip')].filter(visible).length,
    chipsSelected: [...document.querySelectorAll('.reservation-chip.is-selected')].length,
    errors: [...document.querySelectorAll('.form-error')].filter(e => visible(e) && e.textContent.trim()).length,
  };
  const pane = q('#live-editor-pane');
  out.overflow = [];
  if (pane && visible(pane)) {
    const pr = pane.getBoundingClientRect();
    for (const e of document.querySelectorAll('#live-editor-body button, #live-editor-body input, #live-editor-body textarea, #live-editor-body select, #live-editor-body img')) {
      if (!visible(e) || ['hidden', 'file'].includes(e.type)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 0 && (r.right > pr.right + 1 || r.left < pr.left - 1)) out.overflow.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) + ' right=' + Math.round(r.right) + ' pane=' + Math.round(pr.right));
    }
  }
  // 操作の上に、見えない（または別の）要素が残っていないか。各操作を画面の中央へ寄せ、中心の点で一番上にある要素が、その操作自身（か中身・label）かを見る。
  // 幅1440で見えない下の帯 #live-editor-footer が「このライブを削除」「+ 取り置きを追加」を覆っていた不具合の再発を止める。ダイアログが開いている間は背面が覆われるのが正しいので測らない。
  out.covered = [];
  if (!(q('#live-dialog-overlay') && !q('#live-dialog-overlay').hidden)) {
    const targets = [...document.querySelectorAll('#live-tab button, #live-tab input, #live-tab textarea, #live-tab select, #live-tab summary, #live-tab a[href]')]
      .filter(e => visible(e) && e.type !== 'hidden' && e.type !== 'file' && getComputedStyle(e).pointerEvents !== 'none');
    for (const e of targets) {
      // 閉じた折りたたみ（details）の中身は描画されないので測らない（見出しの summary は測る）。
      const fold = e.closest('details');
      if (fold && !fold.open && !e.closest('summary')) continue;
      e.scrollIntoView({block: 'center'});
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.height > window.innerHeight * 0.8 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const label = e.closest('label');
      if (!top || top === e || e.contains(top) || (label && label.contains(top))) continue;
      const name = x => (x.id ? '#' + x.id : '.' + String(x.className).split(' ')[0] || x.tagName);
      out.covered.push(name(e) + ' ← ' + name(top));
    }
    window.scrollTo(0, 0);
  }
  out.rowMainWidths = [...document.querySelectorAll('.reservation-row-main')].filter(visible).map(e => Math.round(e.getBoundingClientRect().width));
  out.rowTexts = [...document.querySelectorAll('.live-row')].filter(visible).map(e => e.innerText.replace(/\s+/g, ' ').trim());
  out.active = document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '';
  out.inert = {liveTab: q('#live-tab') ? q('#live-tab').hasAttribute('inert') : null, overlay: q('#live-dialog-overlay') ? q('#live-dialog-overlay').hasAttribute('inert') : null};
  out.dialogOpen = !!q('#live-dialog-overlay') && !q('#live-dialog-overlay').hidden;
  out.editorScreen = (q('#live-editor-pane') || {}).dataset ? q('#live-editor-pane').dataset.liveScreen || '' : '';
  out.opened = window.__opened || [];
  out.images = [...document.querySelectorAll('img')].map(i => ({src: i.getAttribute('src'), complete: i.complete, ok: i.naturalWidth > 0, width: Math.round(i.getBoundingClientRect().width), height: Math.round(i.getBoundingClientRect().height)}));
  return out;
}"""


# ----------------------------------------------------------------------------------------------------------
# 撮影の計画（画面 P46-01〜16 × 幅 × 状態）
# ----------------------------------------------------------------------------------------------------------
def build_plan():
    plan = []

    def add(screen, state, width, scenario='base', steps=(), height=None, full=True, suffix='', **extra):
        height = height or (844 if width <= 390 else (667 if width < 600 else 900))
        plan.append({'file': f'{screen}-{state}-{width}{suffix}.png', 'screen': screen, 'state': state, 'width': width, 'height': height,
                     'scenario': scenario, 'steps': list(steps), 'full': full, **extra})

    OPEN_LONG = [('open', 'fx-live-long')]
    OPEN_TODAY = [('open', 'fx-live-today')]
    # P46-01 Live一覧（開催予定）
    for width in ALL_WIDTHS:
        add('list-upcoming', 'reserved', width, steps=[('wait-summary',)])
    for width in TWO:
        add('list-upcoming', 'handled-only', width, steps=[('wait-summary',)], summary_override='handled-only')
        add('list-upcoming', 'loading', width, hold=['summary'])
        add('list-upcoming', 'summary-failed', width, scenario='summary-404')
        add('list-upcoming', 'summary-500', width, scenario='summary-500')
        add('list-upcoming', 'unauthorized', width, scenario='summary-401')
        add('list-upcoming', 'read-only', width, scenario='api-fallback')
        add('list-upcoming', 'local-mode', width, scenario='local-mode')
        add('list-upcoming', 'empty', width, scenario='empty-lists')
        add('list-upcoming', 'legacy', width, scenario='legacy-only', steps=[('wait-summary',)])
        add('list-upcoming', 'long-venue', width, data_patch='long-venue', steps=[('wait-summary',)])
        add('list-upcoming', 'broken-images', width, broken_images=True, steps=[('wait-summary',)])
    add('list-upcoming', 'reserved', 360, scenario='many-reservations', steps=[('wait-summary',)], suffix='-many')
    # P46-02 Live一覧（公演終了）
    for width in TWO:
        add('list-past', 'base', width, steps=[('list-tab', 'past')])
        add('list-past', 'empty', width, scenario='empty-lists', steps=[('list-tab', 'past')])
    # P46-03 新しいライブ 元情報
    SOURCE = [('add-live',)]
    for width in TWO:
        add('new-source', 'initial', width, steps=SOURCE)
        add('new-source', 'drafting', width, steps=SOURCE + [('type', '#edit-sourceText', '2099-02-14 テスト会場Z 18:00開場 18:30開演 ¥2,500'), ('click', '#live-source-parse-btn'), ('wait-text', '#live-source-parse-btn', '下書きを作っています…')], hold=['intake'])
        add('new-source', 'draft-failed', width, scenario='draft-fail', steps=SOURCE + [('type', '#edit-sourceText', '2099-02-14 テスト会場Z'), ('click', '#live-source-parse-btn'), ('wait-text', '#live-source-warnings, #live-editor-body', '下書きを作れませんでした。')])
    # P46-04 新しいライブ 下書きの確認
    DRAFT = SOURCE + [('type', '#edit-sourceText', '2099-02-14 テスト会場Z 18:00開場 18:30開演 ¥2,500'), ('click', '#live-source-parse-btn'), ('wait', '#live-public-fields'),
                      ('wait-text', '#live-draft-notice', 'OpenAIで整理しました。')]
    for width in BASIC_WIDTHS:
        add('new-edit', 'unsaved', width, steps=DRAFT, sequence=True)
        add('new-edit', 'ai-notice', width, steps=DRAFT)
        add('new-edit', 'required-empty', width, steps=SOURCE + [('click', '#live-manual-entry-btn'), ('wait', '#live-public-fields'), ('type', '#edit-title', '架空の企画'), ('click', '#live-editor-save-btn'), ('wait', '#edit-date-error:not(:empty)')])
    # P46-05 保存のあと
    for width in TWO:
        add('postsave', 'announce', width, steps=DRAFT + [('click', '#live-editor-save-btn'), ('wait', '#live-postsave')], sequence=True)
    # P46-06 ライブの公開内容
    for width in ALL_WIDTHS:
        add('open-public', 'saved', width, steps=OPEN_TODAY)
    for width in TWO:
        add('open-public', 'unsaved', width, steps=OPEN_TODAY + [('type', '#edit-venue', 'テスト会場A（変更）')])
        add('open-public', 'saving', width, steps=OPEN_TODAY + [('type', '#edit-venue', 'テスト会場A（変更）'), ('click', '#live-editor-save-btn'), ('wait-text', '#live-editor-save-status', '保存しています…')], hold=['put'])
        add('open-public', 'save-failed', width, scenario='save-fail', steps=OPEN_TODAY + [('type', '#edit-venue', 'テスト会場A（変更）'), ('click', '#live-editor-save-btn'), ('wait-text', '#live-editor-save-status', '保存できませんでした')])
        add('open-public', 'legacy', width, scenario='legacy-only', steps=[('list-tab', 'past'), ('open', 'fx-live-old-1')])
        add('open-public', 'long-text', width, steps=OPEN_LONG)
        add('open-public', 'no-flyer', width, steps=[('list-tab', 'past'), ('open', 'fx-live-past-3')])
        add('open-public', 'date-warning', width, steps=OPEN_TODAY + [('type', '#edit-date', '2026-01-01'), ('wait-text', '#live-category-warning', '区分は自動変更しません。')])
        add('open-public', 'read-only', width, scenario='api-fallback', steps=OPEN_TODAY)
        add('open-public', 'broken-flyer', width, broken_images=True, steps=OPEN_TODAY)
    add('open-public', 'unsaved', 360, steps=OPEN_TODAY + [('type', '#edit-venue', 'テスト会場A（変更）')])
    add('open-public', 'saved', 390, height=667, full=False, steps=OPEN_TODAY, suffix='x667', first_screen=True)
    add('open-public', 'saved', 390, height=844, full=False, steps=OPEN_TODAY, suffix='x844', first_screen=True)
    add('open-public', 'delete-failed', 390, scenario='delete-fail', steps=OPEN_TODAY + [('click', '#live-editor-delete-btn'), ('wait', '#live-dialog-action-delete'), ('click', '#live-dialog-action-delete'), ('wait-text', '#live-editor-save-status', '保存できませんでした')])
    # P46-07 / P46-08
    for width in TWO:
        add('links-open', 'unsaved', width, steps=OPEN_LONG + [('details', '#live-links-details'), ('type', '#edit-ticketUrl', 'https://tickets.example.test/changed')])
    add('rebuild-open', 'existing', 390, steps=OPEN_LONG + [('details', '#live-source-intake')])
    # P46-09 告知
    ANNOUNCE = OPEN_LONG + [('task', 'announcement')]
    for width in TWO:
        add('announce', 'comment-empty', width, steps=OPEN_TODAY + [('task', 'announcement')])
        add('announce', 'comment-filled', width, steps=ANNOUNCE, data_patch='comment-filled')
        add('announce', 'copied', width, steps=ANNOUNCE + [('click', '#x-post-copy-btn'), ('wait-text', '#live-copy-status', 'コピーしました。')])
        add('announce', 'comment-typed', width, steps=ANNOUNCE + [('type', '#edit-xComment', '架空のひとこと（変更）')])
    # P46-10 予約（ライブごと）
    RESERVATION = OPEN_LONG + [('task', 'reservation'), ('wait', '#live-reservation-ledger .reservation-totals')]
    for width in [390, 821, 900, 1011, 1440]:
        add('reservation', 'normal', width, steps=RESERVATION)
    for width in TWO:
        add('reservation', 'zero', width, scenario='no-reservations', steps=OPEN_LONG + [('task', 'reservation'), ('wait-text', '#live-reservation-ledger', 'まだ予約はありません。')])
        add('reservation', 'many', width, scenario='many-reservations', steps=RESERVATION)
        add('reservation', 'filter-pending', width, steps=RESERVATION + [('filter', 'pending')])
        add('reservation', 'read-failed', width, extra_fail=['reservations-read'], steps=OPEN_LONG + [('task', 'reservation'), ('wait-text', '#live-reservation-ledger', '取得失敗')])
    # P46-11 予約1件
    FIRST = RESERVATION + [('reservation', 0)]
    for width in TWO:
        add('reservation-detail', 'pending', width, steps=RESERVATION + [('reservation-by-status', 'pending')])
        add('reservation-detail', 'handled', width, steps=RESERVATION + [('reservation-by-status', 'handled')])
        add('reservation-detail', 'cancelled', width, steps=RESERVATION + [('reservation-by-status', 'cancelled')])
        add('reservation-detail', 'status-failed', width, scenario='status-fail', steps=RESERVATION + [('reservation-by-status', 'pending'), ('click', '#live-reservation-detail [data-reservation-status="handled"]'), ('wait-text', '#reservation-detail-error', '更新失敗')])
    # P46-12 取り置きを追加
    ADD = RESERVATION + [('click', '#live-reservation-add-btn'), ('wait', '#manual-reservation-form')]
    for width in TWO:
        add('manual-add', 'initial', width, steps=ADD)
        add('manual-add', 'invalid', width, steps=ADD + [('click', '#manual-reservation-submit'), ('wait-text', '#manual-reservation-error', 'お名前と1〜10の枚数を確認してください。')])
        add('manual-add', 'failed', width, extra_fail=['manual'], steps=ADD + [('type', '#manual-reservation-name', '架空 五郎'), ('click', '#manual-reservation-submit'), ('wait-text', '#manual-reservation-error', 'テスト用の取り置きエラー')])
    # P46-13 予約管理
    TICKETS = [('ws', 'reservations'), ('wait', '#tickets-list .reservation-row')]
    for width in [390, 821, 900, 1011, 1440]:
        add('tickets', 'normal', width, steps=TICKETS)
    for width in TWO:
        add('tickets', 'detail', width, steps=TICKETS + [('click-first', '#tickets-list .reservation-row'), ('wait', '#tickets-detail-view')])
        add('tickets', 'empty', width, scenario='no-reservations', steps=[('ws', 'reservations'), ('wait-text', '#tickets-list', 'まだ予約はありません。')])
        add('tickets', 'local-mode', width, scenario='local-mode', steps=[('ws', 'reservations')])
        add('tickets', 'read-only', width, scenario='api-fallback', steps=[('ws', 'reservations')])
    # P46-14 Ticket Page共通設定
    SETTINGS = [('settings',)]
    for width in [390, 821, 900, 1011, 1440]:
        add('ticket-settings', 'saved', width, steps=SETTINGS)
    for width in TWO:
        add('ticket-settings', 'unsaved', width, steps=SETTINGS + [('type', '#ticket-complete-text', '架空の完了文です。（変更）')])
        add('ticket-settings', 'saving', width, steps=SETTINGS + [('type', '#ticket-complete-text', '架空の完了文です。（変更）'), ('click', '#ticket-settings-save-btn'), ('wait-text', '#ticket-settings-status', '保存しています…')], hold=['put'])
        add('ticket-settings', 'failed', width, scenario='save-fail', steps=SETTINGS + [('type', '#ticket-complete-text', '架空の完了文です。（変更）'), ('click', '#ticket-settings-save-btn'), ('wait-text', '#ticket-settings-status', '保存できませんでした')])
    # P46-15 確認の面
    for width in TWO:
        add('dialog', 'unsaved-move', width, full=False, steps=OPEN_TODAY + [('type', '#edit-venue', 'テスト会場A（変更）'), ('leave',), ('wait', '#live-dialog-action-stay')], dialog='unsaved')
        add('dialog', 'delete-none', width, full=False, steps=OPEN_TODAY + [('click', '#live-editor-delete-btn'), ('wait', '#live-dialog-action-delete')], dialog='delete')
        add('dialog', 'delete-reserved', width, full=False, steps=OPEN_LONG + [('click', '#live-editor-delete-btn'), ('wait', '#live-dialog-action-delete')], dialog='delete')
        add('dialog', 'delete-unknown', width, full=False, extra_fail=['reservations-read'], steps=OPEN_TODAY + [('click', '#live-editor-delete-btn'), ('wait', '#live-dialog-action-delete')], dialog='delete')
    # P46-16 外枠
    for width in TWO:
        add('chrome', 'six-tabs', width, full=False)
    return plan


def expected_images():
    return [item['file'] for item in build_plan()]


# ----------------------------------------------------------------------------------------------------------
# 架空のデータの調整（撮影だけの状態。fixtureの scenario 名には入れない）
# ----------------------------------------------------------------------------------------------------------
def patched_api(item):
    summary_override = None
    if item.get('summary_override') == 'handled-only':
        summary_override = [{'liveId': 'fx-live-long', 'seats': 5, 'records': 2, 'pending': 0}]
    api = fake.FakeAdminApi(copy.deepcopy(FIXTURE), item['scenario'], extra_fail=item.get('extra_fail', ()), summary_override=summary_override)
    if item.get('data_patch') == 'comment-filled':
        next(live for live in api.site['live']['upcoming'] if live['id'] == 'fx-live-long')['xComment'] = ANNOUNCE_COMMENT
    if item.get('data_patch') == 'long-venue':
        api.site['live']['upcoming'][0]['venue'] = 'テスト会場A 架空の非常に長い会場名のテストホール 第2ステージ（地下2階・架空の通りに面した入口）'
    return api


def expects_retry(item):
    return item['scenario'] in RETRY_SCENARIOS or 'reservations-read' in item.get('extra_fail', ())


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
        if kind == 'open':
            click_target(page, f'[data-live-edit][data-live-id="{step[1]}"]', state)
            page.wait_for_function('()=>{const h=document.querySelector("#live-editor-heading");return h&&h.textContent.trim()&&h.textContent.trim()!=="Liveを選択"}')
        elif kind == 'list-tab':
            click_target(page, f'#live-list-{step[1]}-tab', state)
        elif kind == 'add-live':
            click_target(page, '#live-add-btn', state)
            page.wait_for_selector('#edit-sourceText', state='visible')
        elif kind == 'type':
            page.fill(step[1], step[2])
        elif kind == 'click':
            click_target(page, step[1], state)
            if item.get('sequence'):
                state['pressed'].append(step[1])
                if page.evaluate('()=>!document.getElementById("live-dialog-overlay").hidden'):
                    state['dialog_between'].append(step[1])
        elif kind == 'click-first':
            page.locator(step[1]).first.click()
        elif kind == 'leave':
            # 未保存のまま別へ移ろうとする: 幅899px以下は「‹ 一覧」、900px以上は左の一覧の別のライブ
            if item['width'] >= WIDE:
                click_target(page, '[data-live-edit][data-live-id="fx-live-long"]', state)
            else:
                click_target(page, '#live-editor-back', state)
        elif kind == 'details':
            click_target(page, step[1] + ' > summary', state)
        elif kind == 'task':
            click_target(page, f'#live-editor-task-{step[1]}', state)
        elif kind == 'wait':
            page.wait_for_selector(step[1], state='visible')
        elif kind == 'wait-text':
            page.wait_for_function('([s,t])=>{const e=document.querySelector(s);return !!e&&(e.innerText||e.textContent||e.value||"").includes(t)}', arg=[step[1], step[2]])
        elif kind == 'wait-summary':
            page.wait_for_function('()=>document.querySelectorAll("#live-upcoming-list .live-row-seats").length>0||!!document.querySelector("#live-summary-note")?.textContent.trim()')
        elif kind == 'save':
            click_target(page, '#live-editor-save-btn', state)
        elif kind == 'ws':
            click_target(page, f'#live-workspace-{step[1]}-tab', state)
        elif kind == 'settings':
            click_target(page, '#live-ticket-settings-open', state)
            page.wait_for_selector('#live-ticket-settings-panel', state='visible')
        elif kind == 'reservation':
            page.locator('.reservation-row[data-reservation-open]:visible').nth(step[1]).click()
            page.wait_for_selector('#live-reservation-detail', state='visible')
        elif kind == 'reservation-by-status':
            page.locator(f'.reservation-row[data-reservation-open]:visible:has(.status-badge.is-{step[1]})').first.click()
            page.wait_for_selector('#live-reservation-detail', state='visible')
        elif kind == 'filter':
            click_target(page, f'[data-reservation-filter="{step[1]}"]', state)
        else:
            raise ValueError('unknown step ' + str(step))


def settle(page, item):
    """初期の描画が終わるまで待つ（保留scenarioは待たない）。"""
    page.wait_for_function('()=>!!document.querySelector("#live-upcoming-list")&&document.querySelector("#live-upcoming-list").children.length>0&&document.querySelector("#modeBadge").textContent.trim()!==""')
    if not item.get('hold'):
        page.wait_for_load_state('networkidle')
    page.evaluate('document.fonts.ready')
    page.wait_for_function('()=>Array.from(document.images).every(i=>i.complete)')


def run_capture(browser, results, base, item):
    width, height = item['width'], item['height']
    api = patched_api(item)
    origin = base.rstrip('/')
    base_port = urlparse(origin).port
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, reduced_motion='reduce', service_workers='block')
    context.grant_permissions(['clipboard-read', 'clipboard-write'], origin=origin)
    context.add_init_script('window.__opened=[];window.open=function(u){window.__opened.push(String(u));return null;};')
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

    def hold_kind(path, method):
        if path == '/api/admin/ticket-reservation-summary' and 'summary' in held:
            return True
        if path == '/api/admin/site-data' and method == 'PUT' and 'put' in held:
            return True
        return path == '/api/admin/live-source-intake' and 'intake' in held

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
            if hold_kind(parsed.path, request.method):
                pending.append(route)
                return
            status, headers, body = api.handle(request.method, parsed.path + ('?' + parsed.query if parsed.query else ''), request.headers, request.post_data_buffer or b'')
            route.fulfill(status=status, headers={k: v for k, v in headers.items() if k.lower() != 'content-length'}, body=body)
        elif kind == 'fixture-image':
            if item.get('broken_images'):
                route.fulfill(status=404, body='')
            else:
                route.fulfill(status=200, content_type='image/svg+xml', body=fake.placeholder_image_svg(Path(parsed.path).stem))
        elif kind == 'local' and (parsed.port == base_port or base_port is None):
            path = unquote(parsed.path)
            if path == '/admin/config.js':
                route.fulfill(status=200, content_type='text/javascript; charset=utf-8', body=config_js(item))
            elif path == '/admin/data/site-data.json':
                route.fulfill(status=200, content_type='application/json; charset=utf-8', body=json.dumps(api.site, ensure_ascii=False))
            elif path == '/favicon.ico':
                route.fulfill(status=204, body='')
            elif path.startswith('/assets/images/') or path.startswith('/fake-images/'):
                if item.get('broken_images'):
                    route.fulfill(status=404, body='')
                else:
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
    state = {'pressed': [], 'dialog_between': []}
    findings = []
    metrics = {}
    try:
        page.clock.install(time=CLOCK_SECONDS)
        page.goto(origin + '/admin/', wait_until='domcontentloaded')
        settle(page, item)
        run_steps(page, item, state)
        # 押す・入力する間にページが送られると、画像の途中に上の帯が写る（sticky）。いつも先頭へ戻してから測る・撮る（ADM-46-01は「スクロール0」の画面）。
        page.evaluate('window.scrollTo(0,0)')
        # 空のtoast（共有の部品。fixedで画面の下端より下に隠れている）は、全体の撮影で画像が伸びると見えてしまう。撮影の間だけ隠す。
        # 色・透明度の実測は、button の `transition: all 0.3s`（reduced-motion でも1フレーム残る）の途中の値を拾わないよう、撮影の間だけ transition を切って2フレーム待つ。
        page.add_style_tag(content='.toast:not(.show){visibility:hidden!important}*,*::before,*::after{transition:none!important;animation:none!important}')
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        metrics = page.evaluate(METRICS_JS, {'lineSelectors': LINE_SELECTORS, 'boxSelectors': BOX_SELECTORS, 'tapSelectors': TAP_SELECTORS, 'textSelectors': TEXT_SELECTORS})
        findings = check_item(item, metrics, state, net)
        page.screenshot(path=str(SHOTS / item['file']), full_page=item['full'])
        # 幅1440の status-failed は、測った時に理由の行が出ていたのに画像には写っていなかった（Front 2回目）。撮ったあとにも出ているかを見て、消えたら不合格にして手がかりを残す。
        if item['screen'] == 'reservation-detail' and item['state'] == 'status-failed':
            after = page.evaluate('()=>{const e=document.querySelector("#reservation-detail-error");return e?e.innerText.trim():null}')
            if '更新失敗' not in (after or ''):
                findings.append(f'撮影の間に状態の変更の失敗の理由の行が消えた（撮影後の文: {after!r}）')
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
           'production_requests_sent': 0, 'production_attempts_aborted': net['production_attempts'], 'expects_retry': expects_retry(item),
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
# 各画面の合否（計画 §6。許容は罫線・丸めで±2px）
# ----------------------------------------------------------------------------------------------------------
ZERO_BOX = {'visible': False, 'x': 0, 'y': 0, 'width': 0, 'height': 0, 'right': 0, 'bottom': 0, 'disabled': False, 'opacity': '1', 'position': 'static', 'display': 'none'}


class Boxes(dict):
    """測っていない要素は「出ていない」箱として扱う（KeyErrorにしない）。"""

    def __missing__(self, key):
        return ZERO_BOX


EDITING_SCREENS = {'new-source', 'new-edit', 'postsave', 'open-public', 'links-open', 'rebuild-open', 'announce', 'reservation', 'reservation-detail', 'manual-add'}


BUILD_MARK = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{4}Z$')


def connection_findings(scenario, chrome, texts, badge_title):
    """外枠の接続の表示（要件 §6 の最後の行）。Header が出ている画面だけ測る。API接続中は Header に「接続中」だけで帯は出さない。
    帯は API接続失敗（読み取り専用）と Local Mode の時だけ。ビルド標識は文字にせず title 属性。"""
    if not chrome.get('header'):
        return []
    found = []
    badge, banner = texts.get('#modeBadge', ''), texts.get('#connectionBanner', '')
    if scenario == 'api-fallback':
        expected_badge = 'API Fallback'
        if not chrome.get('banner') or '読み取り専用' not in banner:
            found.append(f'API接続失敗: 帯に読み取り専用の案内が出ていない（{banner!r}）')
    elif scenario == 'local-mode':
        expected_badge = 'Local Mode'
        if not chrome.get('banner') or banner != 'ローカルJSONモード（従来運用）':
            found.append(f'Local Mode: 帯に「ローカルJSONモード（従来運用）」が出ていない（{banner!r}）')
    else:
        expected_badge = '接続中'
        if chrome.get('banner') or banner:
            found.append(f'API接続中なのに接続の帯が出ている（{banner!r}）。帯は接続失敗・Local Modeの時だけ')
    if badge != expected_badge:
        found.append(f'Headerの右の表示が {expected_badge!r} でない（{badge!r}）')
    if not BUILD_MARK.match(badge_title or ''):
        found.append(f'ビルド標識が title 属性にない（{badge_title!r}）')
    return found


def check_item(item, m, state, net):
    findings = []
    width, screen, name, scenario = item['width'], item['screen'], item['state'], item['scenario']
    wide = width >= WIDE
    box, texts, counts, taps, lines = Boxes(m['boxes']), m['texts'], m['counts'], m['taps'], m['lines']

    def need(condition, message):
        if not condition:
            findings.append(message)

    def shown(selector):
        return bool(box[selector]['visible'])

    for overlap in state.get('overlaps', []):
        findings.append('操作が重なりで押せない: ' + overlap)
    if m.get('overflow'):
        findings.append('編集面からはみ出している・切れている: ' + ', '.join(m['overflow'][:6]))
    if m.get('covered'):
        findings.append('操作が別の要素に覆われて押せない（操作 ← 上にある要素）: ' + ', '.join(m['covered'][:6]))
    need(m['scrollWidth'] <= m['viewport']['width'] + 1, f'横スクロールが出る（scrollWidth {m["scrollWidth"]} > {m["viewport"]["width"]}）')
    need(m['tabs'] == SIX_TABS, f'外枠のタブが6つの表記でない: {m["tabs"]}')
    need(not m['unnamed'], '表示名のない操作: ' + json.dumps(m['unnamed'], ensure_ascii=False))
    for selector, info in taps.items():
        if selector in ('#live-add-btn',) and wide:
            continue
        need(info['minHeight'] >= 43.5, f'タップの高さが44px未満: {selector}（{info["minHeight"]:.1f}px）')
    # 本番へのrequest: 届いたものは0件（全件abort）。試みは期待したscenarioだけ。
    if net['production_attempts'] and not expects_retry(item):
        findings.append('本番への再送の試みが期待外: ' + json.dumps(net['production_attempts'], ensure_ascii=False))
    if net['other_blocked']:
        findings.append('想定外のhostへのrequest（abort済み）: ' + json.dumps(net['other_blocked'], ensure_ascii=False))
    if net['denied_local']:
        findings.append('配布の許可外のpathを呼んだ: ' + json.dumps(net['denied_local'], ensure_ascii=False))
    if m['opened']:
        findings.append('window.open が呼ばれた（X投稿の画面は開かない契約）: ' + json.dumps(m['opened']))
    # 開いたライブの間は、幅899px以下でページの外枠が退き、900px以上では出る。
    chrome = m['chrome']
    narrow_editing = (not wide) and (screen in EDITING_SCREENS or screen == 'ticket-settings')
    if narrow_editing:
        need(not any(chrome[k] for k in ('header', 'tabNav', 'banner', 'sectionHeader', 'workspaceTabs')), f'幅{width}で開いている間に外枠が残る: {chrome}')
        need('is-live-editing' in m['bodyClasses'] or 'is-live-ticket-settings' in m['bodyClasses'], 'body に is-live-editing / is-live-ticket-settings がない')
    if wide and screen != 'chrome':
        need(chrome['header'] and chrome['tabNav'], f'幅{width}でグローバルのHeader・タブが出ていない: {chrome}')
    findings.extend(connection_findings(scenario, chrome, texts, m.get('badgeTitle', '')))
    if screen == 'chrome':
        need(chrome['header'] and chrome['tabNav'], '外枠のHeaderと6つのタブが出る')
    # 保存して公開
    save = box['#live-editor-save-btn']
    editing = screen in EDITING_SCREENS and screen not in ('new-source', 'postsave')
    if screen == 'open-public' and wide and name in ('saved', 'legacy', 'long-text', 'no-flyer', 'broken-flyer'):
        need(save and save['visible'] and save['disabled'] and float(save['opacity']) < 0.6, '幅900px以上: 変更がない間は薄く押せない「保存して公開」が見出しの右に出る')
    if screen == 'open-public' and wide and name in ('unsaved', 'save-failed'):
        need(save and save['visible'] and not save['disabled'] and float(save['opacity']) > 0.9, '幅900px以上: 未保存の間は押せる「保存して公開」')
    if screen == 'open-public' and wide and save and save['visible']:
        header = box['.live-editor-header']
        need(header['y'] - 1 <= save['y'] and save['bottom'] <= header['bottom'] + 1 and save['right'] <= header['right'] + 1 and save['x'] > header['x'] + header['width'] * 0.5,
             f'幅900px以上: 「保存して公開」が見出しの右に収まらない（{save} / {header}）')
    if not wide and name in ('unsaved', 'save-failed', 'saving') and screen in ('open-public', 'new-edit', 'links-open'):
        need(save and save['visible'], '幅899px以下: 未保存の間は下に「保存して公開」が出る')
        need(box['#live-editor-footer']['position'] == 'sticky', '下の帯が固定（sticky）でない')
    if not wide and screen == 'open-public' and name in ('saved', 'legacy', 'long-text', 'no-flyer', 'read-only', 'broken-flyer'):
        need(not (save and save['visible']), '幅899px以下: 変更がない間は「保存して公開」を出さない')
    # ADM-46-04（幅390・360。未保存の画面で測る）
    if width in (390, 360) and screen == 'open-public' and name == 'unsaved':
        need(lines.get('#live-editor-save-btn') == 1, f'「保存して公開」が1行でない（{lines.get("#live-editor-save-btn")}）')
    if width in (390, 360) and screen in ('list-upcoming', 'list-past') and name != 'empty':
        for selector in ('#live-list-upcoming-tab', '#live-list-past-tab'):
            need(lines.get(selector) == 1, f'{selector} が1行でない（{lines.get(selector)}）')
    if width in (390, 360) and editing:
        for selector in ('#live-editor-back', '#live-editor-heading', '#live-editor-save-status'):
            if selector in lines and screen not in ('reservation-detail', 'manual-add'):
                need(lines[selector] <= 1, f'上の帯の {selector} が1行でない（{lines[selector]}）')
        if screen == 'reservation-detail' or screen == 'manual-add':
            for selector in ('#live-editor-back', '#live-editor-heading'):
                need(lines.get(selector, 0) <= 1, f'上の帯の {selector} が1行でない（{lines.get(selector)}）')
    # ADM-46-01（幅390×844・667で、開いた直後に全体が見える入力欄が3つ以上）
    if item.get('first_screen'):
        need(m['fullyVisibleInputs'] >= 3, f'ADM-46-01: 画面に全体が入る入力欄が{m["fullyVisibleInputs"]}つ（3以上が必要）')
        need(lines.get('#live-editor-heading', 0) <= 1 and lines.get('#live-editor-back', 0) <= 1, 'ADM-46-01: 上の帯が1行でない')
    # 幅900の境界と2〜3列
    if screen in ('list-upcoming', 'open-public') and name in ('reserved', 'saved'):
        master, pane = box.get('#live-master-pane'), box.get('#live-editor-pane')
        if screen == 'open-public':
            if wide:
                need(master and master['visible'] and abs(master['width'] - 320) <= 2, f'幅{width}: 左の一覧が幅320でない（{master and master["width"]}）')
                need(pane and pane['visible'] and pane['x'] >= master['right'] - 1, '右の編集面が一覧の右にない')
                date, venue = box['#edit-date'], box['#edit-venue']
                if width >= 1180:
                    need(abs(date['y'] - venue['y']) <= 2 and venue['x'] > date['x'], f'幅{width}: 日付と会場が2列でない')
                openb, start, fee = box['#edit-openTime'], box['#edit-startTime'], box['#edit-ticket']
                need(abs(openb['y'] - start['y']) <= 2, 'OPENとSTARTが同じ行にない')
                if width >= 1180:
                    need(abs(openb['y'] - fee['y']) <= 2, f'幅{width}: OPEN・START・料金が3列でない')
                    need(abs(box['#edit-notes']['y'] - box['#edit-performers']['y']) <= 2, f'幅{width}: 補足と共演者が2列でない')
                else:
                    need(fee['y'] > openb['bottom'], f'幅{width}: 料金が次の行へ落ちていない（列を1つ減らす）')
                    need(box['#edit-performers']['y'] > box['#edit-notes']['bottom'], f'幅{width}: 補足と共演者が縦に積まれていない')
                    need(venue['y'] >= date['bottom'] - 1, f'幅{width}: 日付と会場が縦に積まれていない（列を1つ減らす）')
            else:
                need(not (master and master['visible']), f'幅{width}: 開いている間は一覧が編集に切り替わる')
                need(pane and pane['visible'], '編集面が出る')
        else:
            if wide:
                need(master and master['visible'] and abs(master['width'] - 320) <= 2, f'幅{width}: 左の一覧が幅320でない')
            else:
                need(master and master['visible'] and master['width'] >= width - 33, f'幅{width}: 一覧が幅いっぱいでない（本文の余白16×2を除いた幅）')
                tabs = box['.live-workspace-tabs']
                page_tab, res_tab = box['#live-workspace-page-tab'], box['#live-workspace-reservations-tab']
                need(tabs['visible'] and tabs['width'] >= width - 33 and abs(page_tab['width'] - res_tab['width']) <= 2,
                     f'幅{width}: 「Liveページ｜予約管理」が幅いっぱいの2等分でない（{page_tab["width"]:.0f} / {res_tab["width"]:.0f}）')
                add_btn = box['#live-add-btn']
                need(add_btn['visible'] and add_btn['width'] >= width - 33 and add_btn['y'] >= tabs['bottom'] - 1,
                     f'幅{width}: 「+ 新しいライブ」が切り替えの下で幅いっぱいでない（{add_btn["width"]:.0f}）')
    # 出していない注記・警告は高さを取らない（日付と会場の下の空き）。入力欄の次の項目までは gap 16 + ラベル 28 の44px前後
    if screen == 'open-public' and name in ('saved', 'legacy', 'long-text', 'no-flyer', 'read-only', 'broken-flyer') and width in (390, 360):
        date, venue, title = box['#edit-date'], box['#edit-venue'], box['#edit-title']
        need(date['visible'] and venue['y'] - date['bottom'] <= 50 and title['y'] - venue['bottom'] <= 50,
             f'日付・会場・ライブ名の間に空きがある（{venue["y"] - date["bottom"]:.0f}px・{title["y"] - venue["bottom"]:.0f}px。44px前後が正）')
        need(box['#edit-date-error']['height'] <= 1 and box['#edit-venue-error']['height'] <= 1, '出していない注記が高さを取っている')
    # フライヤー: 画像・「画像を変える」・「画像を外す」が編集面の中に収まる
    if screen == 'open-public' and box['#edit-image-select-btn']['visible']:
        pane = box['#live-editor-pane']
        need(box['#edit-image-select-btn']['right'] <= pane['right'] + 1, '「画像を変える」が編集面の右に切れている')
        if box['#edit-image-clear-btn']['visible']:
            need(box['#edit-image-clear-btn']['right'] <= pane['right'] + 1, '「画像を外す」が編集面の右に切れている')
    # 一覧の予約の数
    if screen == 'list-upcoming':
        note, rows = texts.get('#live-summary-note', ''), m['rowTexts']
        if name in ('reserved', 'handled-only', 'long-venue', 'broken-images', 'legacy') and scenario in ('base', 'many-reservations', 'legacy-only'):
            if scenario != 'legacy-only':
                need(counts['seats'] >= 1, '予約の数が出ない')
                need(name == 'handled-only' or any('予約 0枚' in r for r in rows), '予約がないライブに「予約 0枚」が出ない')
            need(note == '', f'案内の行が出ている: {note}')
        if name == 'reserved' and scenario == 'base':
            need(any('予約 5枚' in r and '未対応 1' in r for r in rows), '「予約 5枚」「未対応 1」が出ない')
            need(counts['nextLive'] == 1, 'Next Liveが1つでない')
        if name == 'reserved' and scenario == 'many-reservations':
            need(any('予約' in r and '未対応' in r for r in rows), '予約の数と未対応が出ない')
        if name == 'handled-only':
            need(any('予約 5枚' in r for r in rows) and counts['pending'] == 0, '未対応0の行に札が出ない')
        if name == 'loading':
            need(counts['seats'] == 0 and note == '', '読み込み中は予約の行も案内も出さない')
        if name in ('summary-failed', 'summary-500'):
            need(note == '予約の数を読み込めませんでした。' and counts['seats'] == 0, f'取得失敗の案内が違う: {note}')
        if name == 'unauthorized':
            need(note == '認証できませんでした。' and counts['seats'] == 0, f'認証失敗の案内が違う: {note}')
        if name in ('read-only', 'local-mode'):
            need(counts['seats'] == 0 and note == '', 'API接続失敗・Local Modeでは予約の数も案内も出さない')
        if name == 'empty':
            need('開催予定のライブはありません' in texts.get('#live-upcoming-list', ''), '空の一覧の文')
        if name == 'legacy':
            need(any('テスト会場K' in r for r in rows), '旧形式の行が出る')
        if name == 'long-venue':
            need(all(r['width'] <= width for r in [box.get('#live-master-pane', {'width': 0})]), '長い会場名で一覧が幅を超えない')
        if name == 'broken-images':
            need(any(not i['ok'] for i in m['images']), '画像が読めない状態を作れていない')
    if screen == 'list-past':
        need(counts['seats'] == 0 and counts['pending'] == 0, '公演終了の行に予約の数を出さない')
        if name == 'empty':
            need('終了したライブはありません' in texts.get('#live-past-list', ''), '空の一覧の文（公演終了）')
        else:
            need(counts['rows'] >= 1, '公演終了の行が出る')
    # 新しいライブの流れ
    if item.get('sequence'):
        need(state['dialog_between'] == [], f'押下の間に確認の面が出た: {state["dialog_between"]}')
        expected = ['#live-source-parse-btn', '#live-editor-save-btn'] if screen == 'postsave' else ['#live-source-parse-btn']
        need(state['pressed'] == expected, f'押したボタンの列が契約と違う: {state["pressed"]}（期待 {expected}）')
    if screen == 'new-source':
        need(shown('#live-source-intake') and shown('#live-source-parse-btn') and shown('#live-manual-entry-btn'), '元情報・下書きを作る・手入力で作るが出る')
        need(not shown('#live-public-fields') and not shown('#live-editor-task-tabs'), '元情報の画面に公開内容・切り替えは出ない')
        if name == 'drafting':
            need('下書きを作っています…' in texts.get('#live-source-parse-btn', ''), '実行中のボタン文言')
        if name == 'draft-failed':
            need('下書きを作れませんでした。' in texts.get('#live-source-warnings', '') + texts.get('#live-editor-body', ''), '失敗の文言')
    if screen == 'new-edit':
        need(shown('#live-public-fields') and not shown('#live-editor-task-tabs'), '下書きの確認: 公開内容が出て、公演の中の切り替えは出ない')
        need(not shown('#live-source-intake'), '下書きの確認に元情報は出ない')
        if name in ('unsaved', 'ai-notice'):
            need(texts.get('#live-editor-save-status') == '未保存', f'右の状態が「未保存」でない: {texts.get("#live-editor-save-status")}')
            need(m['inert']['liveTab'] is False, '確認の面がないのに背面が inert になっている')
        if name == 'ai-notice':
            need('OpenAIで整理しました。内容を確認してから更新してください。' in texts.get('#live-draft-notice', ''), 'provider表示の固定文が確認の画面の上に見える')
        if name == 'required-empty':
            need(texts.get('#edit-date-error') == '日付を入力してください。' and texts.get('#edit-venue-error') == '会場を入力してください。', '必須の空の文が空の項目の下に出る')
    if screen == 'postsave':
        need(shown('#live-postsave') and '保存して公開しました。' in texts.get('#live-postsave', '') and 'Xで告知する' in texts.get('#live-postsave', '') and 'あとで' in texts.get('#live-postsave', ''), '保存のあとの文言')
    # ライブを開いた画面
    if screen == 'open-public':
        need(shown('#live-public-fields'), '公開内容が出る')
        need(box['.live-flyer-preview']['visible'], 'フライヤーが出る（画像がなくても枠が出る）')
        flyer = box['.live-flyer-preview']
        need(abs(flyer['width'] - 96) <= 2, f'フライヤーの枠の幅が96でない（{flyer["width"]}）')
        status = texts.get('#live-editor-save-status', '')
        expected_status = {'saved': '保存済み', 'legacy': '保存済み', 'long-text': '保存済み', 'no-flyer': '保存済み', 'read-only': '保存済み', 'broken-flyer': '保存済み', 'date-warning': '未保存',
                           'unsaved': '未保存', 'saving': '保存しています…', 'save-failed': '保存できませんでした', 'delete-failed': '保存できませんでした'}.get(name)
        if expected_status:
            need(status == expected_status, f'右の状態が「{expected_status}」でない: {status}')
        if name in ('save-failed', 'delete-failed'):
            need(texts.get('#live-editor-save-error', '') != '', '失敗の理由の1行が出る')
        if name == 'date-warning':
            need('区分は自動変更しません。' in texts.get('#live-category-warning', ''), '日付と区分の警告')
        if name == 'read-only':
            need(m['saveBtn']['text'] == '読み取り専用' and m['saveBtn']['disabled'] and (m['saveBtn']['visible'] or not wide),
                 'API接続失敗は読み取り専用（header の保存は押せない。幅899px以下で開いている間は header ごと退くので画面には出ない）')
        if name == 'legacy':
            need(texts.get('#live-editor-heading', '').startswith('2025.5.5') or '2025' in texts.get('#live-editor-heading', ''), '旧形式のライブを開く')
        if name == 'broken-flyer':
            need(abs(box['.live-flyer-preview']['width'] - 96) <= 2, '画像が読めなくても枠が崩れない')
        # header の保存はAPI接続中のLiveでは出さない
        if scenario in ('base', 'save-fail', 'delete-fail', 'legacy-only'):
            need(not m['saveBtn']['visible'], 'Liveタブでは header の「保存」を出さない（API接続中）')
    if screen == 'links-open':
        need(shown('#edit-ticketUrl') and shown('#live-links-details'), '「予約先・リンクなど」が開いて予約URLが出る')
        need(texts.get('#live-editor-save-status') == '未保存', '未保存')
    if screen == 'rebuild-open':
        need(shown('#edit-sourceText') and shown('#live-source-parse-btn'), '「元情報から作り直す」が開いて元情報と「下書きを作る」が出る')
    if screen == 'announce':
        need(shown('#edit-xComment') and shown('#x-post-preview'), 'ひとことと投稿の内容が出る')
        if wide and width >= 1180:
            comment, preview = box['#edit-xComment'], box['#x-post-preview']
            need(preview['x'] > comment['right'] - 1 and abs(preview['y'] - comment['y']) <= 80, f'幅{width}: 告知は左に文章、右に投稿の内容')
        if name == 'comment-filled':
            values = m.get('values', {})
            need(values.get('#edit-xComment') == ANNOUNCE_COMMENT, 'ひとことが入っている状態でひとこと欄が空')
            need(ANNOUNCE_COMMENT in values.get('#x-post-preview', ''), '投稿の内容にひとことが入っていない')
        if name == 'copied':
            need('コピーしました。' in texts.get('#live-copy-status', ''), 'コピーの結果')
        if name == 'comment-typed':
            need(texts.get('#live-editor-save-status') == '未保存', 'ひとこと変更は未保存')
    # 予約
    if screen == 'reservation':
        ledger = texts.get('#live-reservation-ledger', '')
        if name == 'normal':
            need('5枚' in ledger and '2件' in ledger, '合計がキャンセルを除く「5枚」「2件」でない')
            need(counts['reservationRows'] == 3 and counts['chips'] == 3, '行3つと札3つ')
        if name == 'many':
            need(counts['reservationRows'] >= 10, '二桁の行が出る')
        if name == 'zero':
            need('まだ予約はありません。' in ledger, '0件の文')
        if name == 'filter-pending':
            need(counts['chipsSelected'] == 1 and counts['reservationRows'] == 1, '未対応の札が選ばれ、1件に絞られる')
        if name == 'read-failed':
            need('取得失敗' in ledger, '取得失敗の文')
        if wide and name in ('normal', 'many') and scenario in ('base', 'many-reservations'):
            if width >= 1180:
                need(counts['cells'] >= 4 * counts['reservationRows'] and shown('.reservation-table-head') and shown('.reservation-cell-contact'), f'幅{width}: 予約が表（名前・枚数・連絡先・受付・状態）で出る')
            else:
                # 幅900〜1179は編集面が440〜600pxで6列は入らない（900pxで名前・連絡先が0幅に潰れた）。2行の形のまま、名前が読める幅で出る
                need(counts['cells'] == 0 and not shown('.reservation-table-head'), f'幅{width}: 表の列は出さず2行の形')
                need(counts['reservationRows'] >= 1 and all(width_ >= 120 for width_ in m.get('rowMainWidths', [])) and m.get('rowMainWidths'), f'幅{width}: 行の名前の欄が読める幅（120px以上）: {m.get("rowMainWidths")}')
            need(counts['rowActions'] >= 1, f'幅{width}: 未対応の行に「対応済みにする」が出る')
        if not wide:
            need(counts['cells'] == 0 and counts['rowActions'] == 0, f'幅{width}: 表の列と行の操作は出さない')
        need(texts.get('#live-editor-reservation-count', '') != '' or name in ('zero', 'read-failed', 'filter-pending'), '予約の枚数が切り替えに出る')
    if screen == 'reservation-detail':
        detail = texts.get('#live-reservation-detail', '')
        for label in ('ライブ', '枚数', '連絡先', '受付元', '受付'):
            need(label in detail, f'予約1件に「{label}」の行がない')
        if name == 'pending':
            need('対応済みにする' in detail and 'キャンセルにする' in detail, '未対応: 2つの操作')
        if name in ('handled', 'cancelled'):
            need('未対応に戻す' in detail and 'キャンセルにする' not in detail, '対応済み・キャンセル: 「未対応に戻す」だけ')
        if name == 'status-failed':
            need('更新失敗' in texts.get('#reservation-detail-error', ''), '状態の変更の失敗の文')
        if wide:
            pane = box['#live-reservation-detail']
            lst = box['#live-reservation-list-view']
            need(pane['visible'] and abs(pane['width'] - 320) <= 32 and lst['visible'] and pane['x'] >= lst['right'] - 1, f'幅{width}: 表の右に幅320の面が開く（{pane["width"]}）')
            need('2099' in texts.get('#live-editor-heading', ''), '見出しは日付と会場のまま')
        else:
            need(not shown('#live-reservation-list-view') and '　' in texts.get('#live-editor-heading', ''), '幅899px以下: 見出しが名前と枚数に替わり、一覧は隠れる')
    if screen == 'manual-add':
        need(shown('#manual-reservation-form'), '取り置きの入力が出る')
        if wide:
            need(box['#manual-reservation-form']['x'] >= box['#live-reservation-list-view']['right'] - 1, '表の右の面に出る')
        else:
            need('取り置きを追加' in texts.get('#live-editor-heading', ''), '見出しが「取り置きを追加」')
        if name == 'initial':
            need('（任意）' not in texts.get('#live-editor-body', ''), '「（任意）」は出さない')
    # 予約管理
    if screen == 'tickets':
        listing = texts.get('#tickets-list', '')
        if name == 'normal':
            need(counts['reservationRows'] >= 1, '予約管理に行が出る')
            if wide:
                need(counts['cells'] >= 4 and shown('.reservation-table-head'), f'幅{width}: 予約管理が表')
                need(counts['rowActions'] >= 1, f'幅{width}: 行に「対応済みにする」')
            else:
                need(counts['cells'] == 0, '幅899px以下は2行の一覧')
        if name == 'detail':
            need(shown('#tickets-detail-view'), '予約1件が開く')
            if wide:
                need(shown('#tickets-list-view') and box['#tickets-detail-view']['x'] >= box['#tickets-list-view']['right'] - 1, '表の右に開く')
            else:
                need(not shown('#tickets-list-view'), '幅899px以下は一覧から1件へ切り替わる')
        if name == 'empty':
            need('まだ予約はありません。' in listing, '空の文')
        if name in ('read-only', 'local-mode'):
            need(counts['reservationRows'] == 0, 'API接続失敗・Local Modeでは予約を読まない')
    # Ticket Page共通設定
    if screen == 'ticket-settings':
        need(shown('#live-ticket-settings-panel'), '共通設定の画面が出る')
        status = texts.get('#ticket-settings-status', '')
        expected_status = {'saved': '保存済み', 'unsaved': '未保存', 'saving': '保存しています…', 'failed': '保存できませんでした'}[name]
        need(status == expected_status, f'共通設定の状態が「{expected_status}」でない: {status}')
        actions = box['#ticket-settings-actions']
        button = box['#ticket-settings-save-btn']
        if wide:
            need(shown('#live-master-pane') and abs(box['#live-master-pane']['width'] - 320) <= 2, f'幅{width}: 左の一覧が残る')
            need(actions['visible'] and button['visible'], '幅900px以上: 見出しの右に「保存して公開」が常に出る')
            need((button['disabled'] and float(button['opacity']) < 0.6) == (name in ('saved', 'saving')), '保存済みは薄く押せない')
            if name != 'saving':
                need((not button['disabled']) == (name in ('unsaved', 'failed')), '未保存・失敗は押せる')
        else:
            need(actions['visible'] == (name != 'saved'), f'幅899px以下: 下の操作は未保存の時だけ（{name}）')
            need(not shown('#live-master-pane'), '幅899px以下: 共通設定の画面が一覧に替わる')
        if name == 'failed':
            need(texts.get('#ticket-settings-error', '') != '', '失敗の理由の1行')
        need(lines.get('#live-ticket-settings-title', 1) <= 1, '見出しが1行')
    # 確認の面
    if screen == 'dialog':
        dialog = texts.get('#live-dialog', '')
        need(m['dialogOpen'] and shown('#live-dialog'), '確認の面が出る')
        overlay = box['#live-dialog-overlay']
        need(overlay['width'] >= m['viewport']['width'] - 1 and overlay['height'] >= m['viewport']['height'] - 1, '背面を覆う')
        need(m['inert']['liveTab'] is True and m['inert']['overlay'] is False, '背面が inert（操作できない）')
        dialog_box = box['#live-dialog']
        need(dialog_box['width'] <= 361 and dialog_box['x'] >= 0 and dialog_box['right'] <= m['viewport']['width'], f'面の寸法が最大360を超える・はみ出す（{dialog_box["width"]}）')
        if item['dialog'] == 'unsaved':
            need('保存していない変更があります。' in dialog and '破棄して移動' in dialog and '編集を続ける' in dialog, '未保存の確認の文言')
            need(m['active'] == 'live-dialog-action-stay', f'フォーカスが「編集を続ける」にない（{m["active"]}）')
        else:
            need('このライブを削除しますか。' in dialog and 'やめる' in dialog and '削除する' in dialog, '削除の確認の文言')
            need(m['active'] == 'live-dialog-action-cancel', f'フォーカスが「やめる」にない（{m["active"]}）')
            expected = {'delete-none': '削除すると公開画面からも消えます。', 'delete-reserved': '予約が2件あります。削除すると公開画面からも消えます。',
                        'delete-unknown': '予約の件数を確認できませんでした。削除すると公開画面からも消えます。'}[name]
            need(expected in dialog.replace('\n', ''), f'削除の説明が違う（期待: {expected}）')
    return findings


# ----------------------------------------------------------------------------------------------------------
def check_contract():
    """ブラウザもbindも使わない契約の検査。画像名・scenario・fixture・架空の値だけを確かめる。"""
    plan = build_plan()
    names = [item['file'] for item in plan]
    assert len(names) == len(set(names)), '画像名が重複している: ' + ', '.join(sorted({n for n in names if names.count(n) > 1}))
    screens = {item['screen'] for item in plan}
    required_screens = {'list-upcoming', 'list-past', 'new-source', 'new-edit', 'postsave', 'open-public', 'links-open', 'rebuild-open', 'announce', 'reservation',
                        'reservation-detail', 'manual-add', 'tickets', 'ticket-settings', 'dialog', 'chrome'}  # P46-01〜16
    assert screens == required_screens, sorted(screens ^ required_screens)
    used = {item['scenario'] for item in plan}
    assert used == set(FIXTURE['scenarios']), 'fixtureの全scenarioを撮る: ' + str(sorted(used ^ set(FIXTURE['scenarios'])))
    for item in plan:
        assert item['width'] in ALL_WIDTHS and item['height'] in (667, 844, 900), item['file']
        patched_api(item)
        for step in item['steps']:
            assert step[0] in {'open', 'list-tab', 'add-live', 'type', 'click', 'details', 'task', 'wait', 'wait-text', 'wait-summary', 'save', 'ws', 'settings',
                               'reservation', 'reservation-by-status', 'filter', 'click-first', 'leave'}, step
    # 幅: 2列以上になる画面（P46-01・06・10・11・13・14）は821・900・1011も（計画 §6。P46-11 は右に開く面を幅900以上で見る）
    for screen, wanted in {'list-upcoming': ALL_WIDTHS, 'open-public': ALL_WIDTHS, 'reservation': [390, 821, 900, 1011, 1440], 'tickets': [390, 821, 900, 1011, 1440],
                           'ticket-settings': [390, 821, 900, 1011, 1440]}.items():
        got = {item['width'] for item in plan if item['screen'] == screen}
        assert set(wanted) <= got, (screen, sorted(set(wanted) - got))
    assert {360, 390, 1440} <= {item['width'] for item in plan if item['screen'] == 'new-edit'}
    assert {item['file'] for item in plan if item.get('first_screen')} == {'open-public-saved-390x667.png', 'open-public-saved-390x844.png'}
    assert {int(f.split('-')[-1].split('.')[0].split('x')[0]) for f in names if f.startswith('open-public-saved-390x')} == {390}
    # 架空の値だけ
    text = fake.FIXTURE_PATH.read_text(encoding='utf-8')
    assert not re.search(r'https?://(?!(?:[\w.-]+\.)?example\.test)', text), 'fixtureに架空でないURLがある'
    assert API_HOST == 'api.fixture.test' and fake.FAKE_TOKEN.startswith('fixture-')
    assert classify('1212hp.itsukimatsumoto.workers.dev') == 'production' and classify('api.openai.com') == 'production' and classify('api.fixture.test') == 'fixture-api'
    assert classify('img.youtube.com') == 'fixture-image' and classify('www.youtube.com') == 'other' and classify('x.com') == 'production', 'img.youtube.com だけを架空の画像で応える。本番の判定は緩めない'
    assert expects_retry({'scenario': 'api-fallback'}) and not expects_retry({'scenario': 'base'}) and not expects_retry({'scenario': 'summary-404'}), '予約の数の読み取りは再送の試みを期待しない'
    for scenario in FIXTURE['scenarios']:
        fake.FakeAdminApi(copy.deepcopy(FIXTURE), scenario)
    # 合否の関数が、測っていない値でも例外にならない（撮影の途中で落ちない）
    empty = {'viewport': {'width': 390, 'height': 844}, 'scrollWidth': 390, 'bodyClasses': [], 'chrome': {k: False for k in ('header', 'tabNav', 'banner', 'sectionHeader', 'workspaceTabs', 'listToolbar')},
             'tabs': SIX_TABS, 'badgeTitle': '', 'saveBtn': {'visible': False, 'text': '', 'disabled': False}, 'fullyVisibleInputs': 0, 'visibleInputs': 0, 'unnamed': [], 'lines': {}, 'boxes': {},
             'taps': {}, 'texts': {}, 'counts': {k: 0 for k in ('rows', 'seats', 'pending', 'nextLive', 'reservationRows', 'cells', 'rowActions', 'chips', 'chipsSelected', 'errors')},
             'rowTexts': [], 'active': '', 'inert': {'liveTab': None, 'overlay': None}, 'dialogOpen': False, 'editorScreen': '', 'opened': [], 'images': []}
    net = {'blocked': [], 'production_attempts': [], 'other_blocked': [], 'denied_local': []}
    judged = [bool(check_item(item, copy.deepcopy(empty), {'pressed': [], 'dialog_between': []}, net)) for item in plan]
    assert sum(judged) >= len(plan) * 0.8, '何も測れていない画面が合格してしまう（合否の検査が効いていない）'
    # 操作が別の要素に覆われていたら不合格にする（幅1440で #live-editor-footer が削除・取り置きの上に残った不具合の再発を止める）
    covered = copy.deepcopy(empty)
    covered['covered'] = ['#live-editor-delete-btn ← #live-editor-footer']
    assert any('覆われて押せない' in f for f in check_item(plan[0], covered, {'pressed': [], 'dialog_between': []}, net)), '覆われた操作が不合格にならない'
    assert not any('覆われて押せない' in f for f in check_item(plan[0], copy.deepcopy(empty), {'pressed': [], 'dialog_between': []}, net))
    # 閉じた折りたたみ（details）の中身は描画されないので、覆いの検査で測らない（summary は測る）。測る前（scrollIntoView・elementFromPoint の前）で飛ばしていること。
    cover_block = METRICS_JS[METRICS_JS.index('out.covered = [];'):METRICS_JS.index('out.rowMainWidths')]
    skip = "const fold = e.closest('details');\n      if (fold && !fold.open && !e.closest('summary')) continue;"
    assert skip in cover_block, '閉じたdetailsの中身を覆いの検査から外す規則がない'
    assert cover_block.index(skip) < cover_block.index('scrollIntoView') < cover_block.index('elementFromPoint'), '外す規則が測る処理より後ろにある'
    assert "#live-tab summary" in cover_block, 'details の見出し（summary）は測る'
    # 接続の表示（Header「接続中」・帯は失敗とLocal Modeの時だけ・ビルド標識はtitle）。Headerが出ていない画面は測らない。
    shown = {'header': True, 'banner': False}
    ok_title = '2026-11-20T1600Z'
    assert connection_findings('base', shown, {'#modeBadge': '接続中', '#connectionBanner': ''}, ok_title) == []
    assert connection_findings('api-fallback', {**shown, 'banner': True}, {'#modeBadge': 'API Fallback', '#connectionBanner': 'API接続失敗（ローカルJSONを読み取り専用で表示）'}, ok_title) == []
    assert connection_findings('local-mode', {**shown, 'banner': True}, {'#modeBadge': 'Local Mode', '#connectionBanner': 'ローカルJSONモード（従来運用）'}, ok_title) == []
    assert connection_findings('base', {'header': False, 'banner': True}, {'#modeBadge': 'API Mode (x)'}, '') == [], 'Headerが出ていない画面（開いている間）は測らない'
    assert connection_findings('base', {**shown, 'banner': True}, {'#modeBadge': '接続中', '#connectionBanner': 'Cloudflare API接続中'}, ok_title), 'API接続中に帯が出たら不合格'
    assert connection_findings('base', shown, {'#modeBadge': 'API Mode (2026-11-20T1600Z)', '#connectionBanner': ''}, ok_title), '版が文字に出たら不合格'
    assert connection_findings('base', shown, {'#modeBadge': '接続中', '#connectionBanner': ''}, ''), 'ビルド標識が title にないと不合格'
    assert connection_findings('api-fallback', shown, {'#modeBadge': 'API Fallback', '#connectionBanner': ''}, ok_title), '接続失敗で帯が出ていなければ不合格'
    assert connection_findings('local-mode', {**shown, 'banner': True}, {'#modeBadge': 'Local Mode', '#connectionBanner': ''}, ok_title), 'Local Modeで帯の文言が違えば不合格'
    # 幅900〜1179の予約: 表の列を出さず、行の名前の欄が120px未満なら不合格にする
    reservation = next(entry for entry in plan if entry['screen'] == 'reservation' and entry['state'] == 'normal' and entry['width'] == 900)
    squeezed = copy.deepcopy(empty)
    squeezed['viewport'] = {'width': 900, 'height': 900}
    squeezed['rowMainWidths'] = [18]
    assert any('120px以上' in f for f in check_item(reservation, squeezed, {'pressed': [], 'dialog_between': []}, net)), '潰れた行が不合格にならない'
    hand.self_check()
    fake.self_check()
    print(f'契約OK: {len(names)}画像 / {len(screens)}画面 / {len(used)}scenario（ブラウザ・bindなし）', flush=True)


def capture_all(args):
    from playwright.sync_api import sync_playwright
    SHOTS.mkdir(exist_ok=True)
    plan = [item for item in build_plan() if not args.only or args.only in item['file']]
    results = {'ui_route': UI_ROUTE, 'fixture': 'test/fixtures/admin-live-states.json', 'fixture_sha256': hashlib.sha256(FIXTURE_BYTES).hexdigest(),
               'base': args.base, 'clock_seconds': CLOCK_SECONDS, 'expected_images': expected_images(), 'captures': [], 'status': 'running',
               'network': '本番のAPI・予約・AIのprovider・X投稿の画面へ届いたrequestは0件（localhostと架空のhost以外は全件abort）。',
               'visual_review': '未実施。Frontが全画像をFigma v2と並べて確認する。画素の比較はない。font は取得を遮断しているため代替fontで描かれる（文字の最終確認は別）。',
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
        actual = sorted(Path(row['image']).name for row in results['captures'])
        assert actual == sorted(item['file'] for item in plan), '撮影名・件数が契約と一致しない'
        results['status'] = 'captured; visual acceptance pending' if not failed else f'{len(failed)} image(s) failed the structure checks'
        print(f'{len(actual)}画像。構造と実測の確認は{"すべて合格" if not failed else str(len(failed)) + "枚が不合格"}。本番へ届いたrequestは全件0。全画像の目視は別の受入。', flush=True)
        if failed:
            raise SystemExit(1)
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
    parser.add_argument('--self-check', action='store_true', help='ブラウザもbindも使わず契約だけ検査する')
    args = parser.parse_args()
    if args.self_check:
        check_contract()
        return
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
