import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const adminHtml = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const adminJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
const adminCss = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');
const adminReadme = readFileSync(join(repoRoot, 'admin/README.md'), 'utf8');
const require = createRequire(import.meta.url);
const LiveOperations = require(join(repoRoot, 'assets/js/live-operations.js'));
const musicSource = readFileSync(join(repoRoot, 'assets/js/music-data.js'), 'utf8');

import {
  answerLiveDialog,
  decodeHtml,
  createElement,
  createDomHarness,
  loadAdminApp,
  setLiveForm,
  LIVE_SOURCE_INTAKE_FIELD_IDS,
  snapshotLiveSourceIntake,
  assertLiveSourceIntakeUnchanged,
  validLiveSourceIntakeDraft,
  deferred,
  jsonResponse,
  flushAsync,
} from './support/admin-app-harness.mjs';


test('Live is the initial primary tab and Tickets is not a global tab', () => {
  const primaryNav = adminHtml.match(/<nav class="tab-nav">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.match(primaryNav, /class="tab-btn active" data-tab="live"/);
  assert.doesNotMatch(primaryNav, /data-tab="tickets"/);
  assert.match(adminHtml, /id="live-tab"[^>]*class="tab-content active"|class="tab-content active"[^>]*id="live-tab"/);
});

test('Live workspace has semantic Liveページ and 予約管理 tabs', () => {
  assert.match(adminHtml, /class="live-workspace-tabs"[^>]*role="tablist"/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-workspace-view="page"[^>]*>Liveページ<\/button>/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-workspace-view="reservations"[^>]*>予約管理<\/button>/);
});

test('Live workspace Liveページ has semantic 開催予定 and 公演終了 filters', () => {
  assert.match(adminHtml, /class="live-list-tabs"[^>]*role="tablist"/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-list-view="upcoming"[^>]*>開催予定<\/button>/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-list-view="past"[^>]*>公演終了<\/button>/);
});

test('Live workspace separates reservations and Ticket Page共通設定 from Live list details', () => {
  assert.match(adminHtml, /id="live-workspace-reservations-panel"[^>]*role="tabpanel"/);
  assert.match(adminHtml, /id="live-workspace-reservations-panel"[\s\S]*id="tickets-list"/);
  assert.match(adminHtml, /id="live-ticket-settings-open"[^>]*>Ticket Page共通設定<\/button>/);
  assert.match(adminHtml, /id="live-ticket-settings-open"[^>]*aria-controls="live-ticket-settings-panel"/);
  assert.match(adminHtml, /id="live-ticket-settings-open"[^>]*aria-expanded="false"/);
  assert.match(adminHtml, /id="live-ticket-settings-panel"[^>]*role="region"/);
  assert.match(adminHtml, /id="live-ticket-settings-close"[^>]*>‹ 一覧<\/button>/);
  assert.doesNotMatch(adminHtml, /<details[^>]*[\s\S]*?(?:Ticket Page|予約一覧（全Live）)[\s\S]*?<\/details>/);
});

test('Live workspace Ticket Page settings moves focus and synchronizes disclosure state', async () => {
  const app = loadAdminApp();
  app.setupLiveWorkspace();
  const openButton = app.elements.get('live-ticket-settings-open');
  const closeButton = app.elements.get('live-ticket-settings-close');
  const primaryPanel = app.elements.get('live-page-primary');
  const settingsPanel = app.elements.get('live-ticket-settings-panel');

  openButton.focus();
  await openButton.dispatch('click');
  assert.equal(openButton.getAttribute('aria-expanded'), 'true');
  assert.equal(primaryPanel.classList.contains('is-ticket-settings'), true);
  assert.equal(settingsPanel.hidden, false);
  assert.equal(app.document.activeElement, closeButton);

  await closeButton.dispatch('click');
  assert.equal(openButton.getAttribute('aria-expanded'), 'false');
  assert.equal(primaryPanel.classList.contains('is-ticket-settings'), false);
  assert.equal(settingsPanel.hidden, true);
  assert.equal(app.document.activeElement, openButton);
});

test('Live workspace initial state is Liveページ and 開催予定', () => {
  assert.match(adminHtml, /id="live-workspace-page-tab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(adminHtml, /id="live-workspace-reservations-tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(adminHtml, /id="live-workspace-reservations-panel"[^>]*hidden/);
  assert.match(adminHtml, /id="live-list-upcoming-tab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(adminHtml, /id="live-list-past-tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(adminHtml, /id="live-list-past-panel"[^>]*hidden/);
});

test('Live workspace tablists support ArrowLeft ArrowRight Home and End movement', async () => {
  const app = loadAdminApp();
  assert.equal(typeof app.setupLiveWorkspace, 'function');
  app.setupLiveWorkspace();

  const pageTab = app.elements.get('live-workspace-page-tab');
  const reservationsTab = app.elements.get('live-workspace-reservations-tab');
  await pageTab.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(reservationsTab.getAttribute('aria-selected'), 'true');
  assert.equal(reservationsTab.focusCount, 1);
  assert.equal(app.elements.get('live-workspace-page-panel').hidden, true);
  assert.equal(app.elements.get('live-workspace-reservations-panel').hidden, false);
  await reservationsTab.dispatch('keydown', { key: 'Home' });
  assert.equal(pageTab.getAttribute('aria-selected'), 'true');

  const upcomingTab = app.elements.get('live-list-upcoming-tab');
  const pastTab = app.elements.get('live-list-past-tab');
  await upcomingTab.dispatch('keydown', { key: 'End' });
  assert.equal(pastTab.getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('live-list-upcoming-panel').hidden, true);
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  await pastTab.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(upcomingTab.getAttribute('aria-selected'), 'true');
});

test('master-detail Live workspace contains list and empty editor panes with the adaptive desktop grid', () => {
  assert.match(adminHtml, /id="live-master-detail"/);
  assert.match(adminHtml, /id="live-master-pane"/);
  assert.match(adminHtml, /id="live-editor-pane"/);
  assert.match(adminHtml, /id="live-editor-body"[\s\S]*Liveを選択/);
  assert.match(adminCss, /@media\s*\(min-width:\s*900px\)/);
  assert.match(adminCss, /grid-template-columns:\s*320px\s+minmax\(0,\s*1fr\)/);
});

test('Live edit workspace renders add and edit in the detail pane while News keeps the generic dialog', () => {
  const app = loadAdminApp();
  app.setSiteData({
    news: [],
    live: {
      upcoming: [{ id: 'detail-live', date: '2026-08-10', title: '山頂', venue: '下北沢おてまえ', image: '' }],
      past: [],
    },
  });
  app.renderLive();
  const trigger = app.elements.get('live-upcoming-list').children[0];
  trigger.focus();

  app.editLive('detail-live', 'upcoming');

  assert.doesNotMatch(adminHtml, /id="live-editor-context"/, 'the eyebrow row is gone from the one-line Header (R46-01)');
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-sourceText"/);
  assert.equal(app.elements.get('modal-body').innerHTML, '');
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.equal(app.elements.get('live-editor-heading').textContent, '2026.08.10(Mon) 下北沢おてまえ');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.equal(app.elements.get('live-editor-back').hidden, false);
  assert.equal(trigger.getAttribute('aria-current'), 'true');
  assert.equal(trigger.classList.contains('is-selected'), true);
  assert.match(app.elements.get('live-editor-body').innerHTML, />保存して公開<\/button>/);
  assert.match(app.elements.get('live-editor-body').innerHTML, />このライブを削除<\/button>/);

  app.closeLiveEditor();
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(app.getModalState().currentEditId, null);

  app.addLive();
  assert.equal(app.elements.get('live-editor-heading').textContent, '新しいライブ');
  assert.doesNotMatch(app.elements.get('live-editor-body').innerHTML, /id="live-editor-delete-btn"/, 'a new Live has no delete');
  assert.equal(app.elements.get('modal').classList.contains('active'), false);

  app.setConfirm(() => true);
  assert.equal(app.closeLiveEditor(), true);
  assert.equal(app.addNews(), true);
  assert.equal(app.elements.get('modal').classList.contains('active'), true);
  assert.match(app.elements.get('modal-body').innerHTML, /ニュースタイトル/);
});

test('master-detail marks only the first upcoming card as Next Live', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'next', date: '2026-08-10', title: 'Next', venue: 'A', image: '' },
        { id: 'later', date: '2026-08-20', title: 'Later', venue: 'B', image: '' },
      ],
      past: [{ id: 'past', date: '2026-07-01', title: 'Past', venue: 'C', image: '' }],
    },
  });

  app.renderLive();

  const upcomingHtml = app.elements.get('live-upcoming-list').innerHTML;
  assert.equal((upcomingHtml.match(/aria-label="Next Live"/g) || []).length, 1);
  assert.match(upcomingHtml, /data-live-id="next"[\s\S]*aria-label="Next Live"/);
  assert.doesNotMatch(app.elements.get('live-past-list').innerHTML, /Next Live/);
});

test('Live task tabs are semantic, keyboard operable, and preserve mounted input', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'task-live', date: '2026-08-10', title: 'Task', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.editLive('task-live', 'upcoming');

  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /class="live-editor-task-tabs"[^>]*role="tablist"/);
  assert.match(editorHtml, /role="tab"[^>]*data-live-editor-task="public"[^>]*aria-selected="true"/);
  assert.match(editorHtml, /role="tab"[^>]*data-live-editor-task="announcement"[^>]*>告知<\/button>/);
  assert.match(editorHtml, /role="tab"[^>]*data-live-editor-task="reservation"[^>]*>予約(<span[^>]*><\/span>)?<\/button>/);
  assert.match(editorHtml, /role="tabpanel"[^>]*data-live-editor-task-panel="public"/);
  assert.equal(typeof app.setLiveEditorTask, 'function');

  const title = app.elements.get('edit-title');
  title.value = '入力保持';
  const publicTab = app.elements.get('live-editor-task-public');
  const announcementTab = app.elements.get('live-editor-task-announcement');
  await publicTab.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(announcementTab.getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('live-editor-panel-public').hidden, true);
  assert.equal(app.elements.get('live-editor-panel-announcement').hidden, false);
  assert.equal(title.value, '入力保持');

  await announcementTab.dispatch('keydown', { key: 'Home' });
  assert.equal(publicTab.getAttribute('aria-selected'), 'true');
  assert.equal(title.value, '入力保持');
});

test('new Live prioritizes source intake and gates post-save tasks until first save', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });

  app.addLive();

  const newHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(newHtml, /<section[^>]*id="live-source-intake"[^>]*class="live-source-intake live-source-screen"/, 'a new Live starts on the source screen, not a folded block');
  assert.match(newHtml, /id="live-source-parse-btn"[^>]*>下書きを作る<\/button>/);
  assert.match(newHtml, /id="live-manual-entry-btn"[^>]*>手入力で作る<\/button>/);
  assert.match(newHtml, /id="live-public-fields"[^>]*hidden/);
  assert.equal(app.elements.get('live-editor-task-announcement').disabled, true);
  assert.equal(app.elements.get('live-editor-task-reservation').disabled, true);
  assert.ok(app.elements.get('edit-date'), 'hidden public inputs stay mounted for AI intake');

  await app.elements.get('live-manual-entry-btn').dispatch('click');
  assert.equal(app.elements.get('live-public-fields').hidden, false);
  assert.equal(app.elements.get('edit-date').focusCount, 1);

  setLiveForm(app.elements);
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.elements.get('live-editor-task-announcement').disabled, false);
  assert.equal(app.elements.get('live-editor-task-reservation').disabled, false);

  app.editLive(app.getSiteData().live.upcoming[0].id, 'upcoming');
  const existingHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(existingHtml, /<details[^>]*id="live-source-intake"[^>]*class="live-source-intake live-collapse"/);
  assert.doesNotMatch(existingHtml, /<details[^>]*id="live-source-intake"[^>]*open/);
  assert.doesNotMatch(existingHtml, /id="live-public-fields"[^>]*hidden/);
});

test('Live validation blocks missing date and venue before changing data or saving', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.setSaveSpy();
  app.addLive();
  await app.elements.get('live-manual-entry-btn').dispatch('click');
  setLiveForm(app.elements, { 'edit-date': '', 'edit-venue': '' });

  const saved = await app.saveLiveWorkspace();

  assert.equal(saved, false);
  assert.equal(app.getSiteData().live.upcoming.length, 0);
  assert.equal(app.getSaveCalls(), 0);
  assert.equal(app.elements.get('edit-date').getAttribute('aria-invalid'), 'true');
  assert.equal(app.elements.get('edit-venue').getAttribute('aria-invalid'), 'true');
  assert.match(app.elements.get('edit-date-error').textContent, /日付/);
  assert.match(app.elements.get('edit-venue-error').textContent, /会場/);
  assert.equal(app.document.activeElement, app.elements.get('edit-date'));
});

test('Live category mismatch warns but saves without automatically moving collection', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'mismatch-live', date: '2000-01-01', title: 'Past date', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.editLive('mismatch-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2000-01-01', 'edit-venue': 'Venue', isPast: false });

  const saved = await app.saveLiveWorkspace();

  assert.equal(saved, true);
  assert.equal(app.getSiteData().live.upcoming[0].id, 'mismatch-live');
  assert.equal(app.getSiteData().live.past.length, 0);
  assert.equal(app.getModalState().currentEditType, 'live-upcoming');
  assert.match(app.elements.get('live-category-warning').textContent, /開催予定.*過去の日付/);
});

test('Live API save reports saving, saved, and failed states around the existing save route', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [{ id: 'state-live', date: '2026-08-20', title: 'State', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.editLive('state-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2026-08-20', 'edit-venue': 'Venue' });
  const response = deferred();
  app.useAdminFetch(() => response.promise);

  const pendingSave = app.saveLiveWorkspace();
  await flushAsync();
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存しています…');
  response.resolve(jsonResponse({ data: app.getSiteData() }));
  assert.equal(await pendingSave, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');

  app.elements.get('edit-title').value = 'Retry';
  app.useAdminFetch(async () => jsonResponse({ error: 'failed' }, { ok: false, status: 500 }));
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
});

test('Live dirty guard blocks and then discards navigation to another Live, list, and global tab', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'dirty-a', date: '2026-08-20', title: 'A', venue: 'A venue', image: '' },
        { id: 'dirty-b', date: '2026-08-21', title: 'B', venue: 'B venue', image: '' },
      ],
      past: [],
    },
  });
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.editLive('dirty-a', 'upcoming');
  app.elements.get('edit-title').value = 'Unsaved A';
  await app.elements.get('edit-title').dispatch('input');
  let dialogs = 0;
  const stay = async (action) => {
    const pending = action();
    dialogs += 1;
    await answerLiveDialog(app, 'stay');
    return pending;
  };

  assert.equal(await stay(() => app.editLive('dirty-b', 'upcoming')), false);
  assert.equal(app.getModalState().currentEditId, 'dirty-a');
  assert.equal(app.elements.get('edit-title').value, 'Unsaved A');
  assert.equal(await stay(() => app.closeLiveEditor()), false);
  assert.equal(app.getModalState().currentEditId, 'dirty-a');
  assert.equal(await stay(() => app.setLiveWorkspaceView('reservations')), false);
  assert.equal(app.elements.get('live-workspace-page-panel').hidden, false);
  await stay(() => app.elements.get('global-tab-news').dispatch('click'));
  assert.equal(app.elements.get('global-tab-live').classList.contains('active'), true);
  assert.equal(app.elements.get('global-tab-news').classList.contains('active'), false);
  assert.equal(dialogs, 4);

  const discarded = app.editLive('dirty-b', 'upcoming');
  await answerLiveDialog(app, 'discard');
  assert.equal(await discarded, true);
  assert.equal(app.getModalState().currentEditId, 'dirty-b');
  app.elements.get('edit-title').value = 'Unsaved B';
  await app.elements.get('edit-title').dispatch('input');
  const leaving = app.elements.get('global-tab-news').dispatch('click');
  await answerLiveDialog(app, 'discard');
  await leaving;
  assert.equal(app.elements.get('global-tab-news').classList.contains('active'), true);
  assert.equal(app.getModalState().currentEditId, null);
});

test('reselecting the active global Live tab is a no-op for a dirty editor', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'reselect-dirty', date: '2026-08-20', title: 'Stored', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.editLive('reselect-dirty', 'upcoming');
  const title = app.elements.get('edit-title');
  title.value = 'Unsaved value';
  await title.dispatch('input');
  title.focus();
  const selectedTrigger = app.elements.get('live-upcoming-list').children.find(
    (trigger) => trigger.dataset.liveId === 'reselect-dirty',
  );
  let confirmations = 0;
  app.setConfirm(() => {
    confirmations += 1;
    return false;
  });

  await app.elements.get('global-tab-live').dispatch('click');

  assert.equal(confirmations, 0, 'an already-active destination does not request a discard decision');
  assert.equal(app.getModalState().currentEditId, 'reselect-dirty');
  assert.equal(app.elements.get('edit-title'), title);
  assert.equal(title.value, 'Unsaved value');
  assert.equal(app.document.activeElement, title);
  assert.equal(
    app.elements.get('live-upcoming-list').children.find((trigger) => trigger.dataset.liveId === 'reselect-dirty'),
    selectedTrigger,
  );
  assert.equal(selectedTrigger.classList.contains('is-selected'), true);
  assert.equal(selectedTrigger.getAttribute('aria-current'), 'true');
  assert.equal(app.elements.get('live-master-detail').classList.contains('has-live-selection'), true);
});

test('reselecting the active global Live tab is also a no-op for a clean editor', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'reselect-clean', date: '2026-08-20', title: 'Stored', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.editLive('reselect-clean', 'upcoming');
  const title = app.elements.get('edit-title');
  title.focus();

  await app.elements.get('global-tab-live').dispatch('click');

  assert.equal(app.getModalState().currentEditId, 'reselect-clean');
  assert.equal(app.elements.get('edit-title'), title);
  assert.equal(app.document.activeElement, title);
  const selectedTrigger = app.elements.get('live-upcoming-list').children.find(
    (trigger) => trigger.dataset.liveId === 'reselect-clean',
  );
  assert.equal(selectedTrigger.getAttribute('aria-current'), 'true');
});

test('Live internal task switching preserves dirty input without discard confirmation', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [{ id: 'internal-task', date: '2026-08-20', title: 'Before', venue: 'Venue', image: '' }], past: [] },
  });
  app.editLive('internal-task', 'upcoming');
  app.elements.get('edit-title').value = 'Still here';
  await app.elements.get('edit-title').dispatch('input');
  let confirmations = 0;
  app.setConfirm(() => { confirmations += 1; return false; });

  app.setLiveEditorTask('announcement');

  assert.equal(confirmations, 0);
  assert.equal(app.elements.get('edit-title').value, 'Still here');
  assert.equal(app.elements.get('live-editor-panel-announcement').hidden, false);
  assert.equal(app.getLiveEditorState().dirty, true);
});

test('API fallback is read-only while keeping Live navigation available', async () => {
  const fallbackData = {
    live: { upcoming: [{ id: 'fallback-live', date: '2026-08-20', title: 'Fallback', venue: 'Venue', image: '' }], past: [] },
  };
  const app = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://custom-admin.example.test', adminToken: 'test-token' },
    networkFetch: async (url) => {
      if (url === 'data/site-data.json') return jsonResponse(fallbackData);
      return jsonResponse({ error: 'offline' }, { ok: false, status: 503 });
    },
  });

  await app.loadData();
  app.renderModeBadge();
  app.editLive('fallback-live', 'upcoming');

  assert.equal(app.getLiveEditorState().readOnly, true);
  assert.match(app.elements.get('connectionBanner').textContent, /読み取り専用/);
  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-btn').disabled, true);
  assert.equal(app.elements.get('live-editor-delete-btn').disabled, true);
  assert.equal(app.elements.get('live-source-parse-btn').disabled, true);
  assert.equal(app.elements.get('manual-reservation-submit').disabled, true);
  assert.equal(app.elements.get('edit-date').disabled, true);
  app.setLiveEditorTask('announcement');
  assert.equal(app.elements.get('live-editor-panel-announcement').hidden, false, 'read-only navigation remains available');

  app.useAdminFetch(async () => { throw new Error('read-only mutation must not call API'); });
  app.setConfirm(() => true);
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(await app.handleLiveSourceParse(), false);
  assert.equal(await app.submitManualReservation(), false);
  assert.equal(await app.markTicketStatus('reservation-1', 'handled'), false);
  assert.equal(await app.deleteLiveFromWorkspace(), false);
  assert.equal(await app.saveData(), false);
  assert.equal(app.fetchCalls.length, 0);
  assert.equal(app.getSiteData().live.upcoming[0].id, 'fallback-live');
});

test('API fallback keeps every admin collection immutable while existing details remain viewable', async () => {
  const fallbackData = {
    site: {
      heroImage: 'assets/images/hero.jpg',
      links: { bandcamp: 'https://example.com/original', youtube: '', x: '', instagram: '', note: '' },
      footerText: 'Original footer',
    },
    contact: { introText: 'Original contact', formAction: 'https://example.com/contact' },
    ticket: { introText: '', noticeText: '', completeText: '', fields: {} },
    news: [{ id: 'news-readonly', date: '2026.08.10', title: 'News', description: '', image: '', link: '', linkText: '' }],
    live: { upcoming: [], past: [] },
    youtube: {
      channelUrl: 'https://youtube.com/@original',
      musicVideos: [{ id: 'youtube-readonly', title: 'Video', youtubeId: 'JaPin67uO7A' }],
      liveMovies: [],
      demos: [],
    },
    discography: {
      digital: [{ id: 'disco-readonly', title: 'Release', releaseDate: '2026.08.10', description: '', image: '', link: '' }],
      demo: [],
    },
    profile: {
      image: 'assets/images/profile.jpg',
      text: 'Original profile',
      links: [{ name: 'Original link', url: 'https://example.com/profile' }],
    },
  };
  const app = loadAdminApp();
  app.setSiteData(structuredClone(fallbackData));
  app.renderAll();
  app.setApiFallbackReadOnly(true);
  app.applyApiFallbackReadOnlyState();

  for (const id of [
    'site-link-bandcamp',
    'site-hero-image-select-btn',
    'news-add-btn',
    'youtube-channel-url',
    'youtube-add-musicVideos-btn',
    'discography-add-btn',
    'profile-text',
    'profile-image-select-btn',
    'profile-link-0-name',
    'profile-link-0-url',
    'profile-link-0-delete-btn',
    'profile-link-add-btn',
    'saveBtn',
  ]) {
    const control = app.elements.get(id);
    assert.ok(control, `${id} must be a stable mutation control`);
    assert.equal(control.disabled, true, `${id} must be disabled in fallback mode`);
    assert.equal(control.getAttribute('aria-disabled'), 'true', `${id} must expose its disabled state`);
  }
  assert.equal(app.elements.get('global-tab-site').disabled, false);
  assert.equal(app.elements.get('live-workspace-page-tab').disabled, false);
  assert.equal(app.elements.get('tickets-live-filter').disabled, false);

  const immutableSnapshot = JSON.stringify(app.getSiteData());
  const bandcamp = app.elements.get('site-link-bandcamp');
  bandcamp.value = 'https://example.com/mutated';
  assert.equal(bandcamp.onchange(), false);
  assert.equal(bandcamp.value, 'https://example.com/original');
  assert.equal(app.addNews(), false);
  assert.equal(app.addYouTubeVideo('musicVideos'), false);
  assert.equal(app.addDiscography(), false);
  assert.equal(app.addProfileLink(), false);
  const profileName = app.elements.get('profile-link-0-name');
  profileName.value = 'Mutated link';
  assert.equal(app.updateProfileLink(0, 'name', 'Mutated link'), false);
  assert.equal(profileName.value, 'Original link');
  assert.equal(app.deleteProfileLink(0), false);
  assert.equal(JSON.stringify(app.getSiteData()), immutableSnapshot);
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.match(adminReadme, /admin全体がread-only[\s\S]*既存のNews・YouTube・Disco・Profile[\s\S]*閲覧/);

  const modalCases = [
    ['News', (instance) => instance.editNews('news-readonly'), {
      'edit-date': '2026.08.10',
      'edit-title': 'News',
      'edit-description': '',
      'edit-image': '',
      'edit-link': '',
      'edit-linkText': '',
    }],
    ['YouTube', (instance) => instance.editYouTubeVideo('youtube-readonly', 'musicVideos'), {
      'edit-category': 'musicVideos',
      'edit-title': 'Video',
      'edit-youtube': 'JaPin67uO7A',
    }],
    ['Discography', (instance) => instance.editDiscography('disco-readonly', 'digital'), {
      'edit-category': 'digital',
      'edit-title': 'Release',
      'edit-releaseDate': '2026.08.10',
      'edit-description': '',
      'edit-image': '',
      'edit-link': '',
    }],
  ];
  for (const [name, open, canonicalFields] of modalCases) {
    const instance = loadAdminApp();
    instance.setSiteData(structuredClone(fallbackData));
    instance.setApiFallbackReadOnly(true);
    assert.equal(open(instance), true, `${name} detail remains viewable`);
    const before = JSON.stringify(instance.getSiteData());
    const modalHtml = instance.elements.get('modal-body').innerHTML;
    assert.equal(instance.elements.get('modal').classList.contains('active'), true);
    assert.equal(instance.elements.get('edit-title').disabled, true);
    const focusedBeforeSave = instance.document.activeElement;
    for (const id of Object.keys(canonicalFields)) {
      instance.elements.get(id).value = `MUTATED ${id}`;
    }
    assert.equal(await instance.saveModal(), false);
    assert.equal(instance.deleteItem(), false);
    assert.equal(JSON.stringify(instance.getSiteData()), before);
    assert.equal(instance.elements.get('modal-body').innerHTML, modalHtml);
    assert.equal(instance.elements.get('modal').classList.contains('active'), true);
    assert.equal(instance.document.activeElement, focusedBeforeSave, `${name} modal keeps focus`);
    for (const [id, value] of Object.entries(canonicalFields)) {
      assert.equal(instance.elements.get(id).value, value, `${name} restores ${id}`);
      assert.equal(instance.elements.get(id).disabled, true, `${name} keeps ${id} read-only`);
    }
    assert.equal(instance.fetchCalls.length, 0);
  }
});

test('API fallback blocks direct Live item and API save calls before mutation or PUT', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [{ id: 'direct-fallback', date: '2026-08-10', title: 'Stored', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.renderLive();
  app.editLive('direct-fallback', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '', 'edit-title': 'MUTATED', isPast: true });
  const dataBefore = JSON.stringify(app.getSiteData());
  const upcomingBefore = app.elements.get('live-upcoming-list').innerHTML;
  const pastBefore = app.elements.get('live-past-list').innerHTML;
  let apiCalls = 0;
  app.setAdminFetch(async () => {
    apiCalls += 1;
    return jsonResponse({});
  });
  app.setApiFallbackReadOnly(true);

  assert.equal(app.saveLiveItem(), false);
  assert.equal(await app.saveToApi(), false);
  assert.equal(JSON.stringify(app.getSiteData()), dataBefore);
  assert.equal(app.elements.get('live-upcoming-list').innerHTML, upcomingBefore);
  assert.equal(app.elements.get('live-past-list').innerHTML, pastBefore);
  assert.equal(app.getModalState().currentEditType, 'live-upcoming');
  assert.equal(apiCalls, 0);
});

test('beforeunload protects global changes and Live dirty or saving states', async () => {
  const clean = loadAdminApp();
  const cleanEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await clean.dispatchWindow('beforeunload', cleanEvent);
  assert.equal(cleanEvent.prevented, 0);

  const live = loadAdminApp();
  live.setApiMode(true);
  live.setSiteData({ live: { upcoming: [{ id: 'beforeunload-live', date: '2026-08-10', title: 'Before', venue: 'Venue', image: '' }], past: [] } });
  live.renderLive();
  live.editLive('beforeunload-live', 'upcoming');
  live.elements.get('edit-title').value = 'Dirty Live';
  await live.elements.get('edit-title').dispatch('input');
  const dirtyEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await live.dispatchWindow('beforeunload', dirtyEvent);
  assert.equal(dirtyEvent.prevented, 1);

  const closing = live.closeLiveEditor();
  await answerLiveDialog(live, 'discard');
  assert.equal(await closing, true);
  const discardedEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await live.dispatchWindow('beforeunload', discardedEvent);
  assert.equal(discardedEvent.prevented, 0);

  live.editLive('beforeunload-live', 'upcoming');
  const pendingSave = deferred();
  live.setSaveToApi(() => pendingSave.promise);
  const saving = live.saveLiveWorkspace();
  await flushAsync();
  const savingEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await live.dispatchWindow('beforeunload', savingEvent);
  assert.equal(savingEvent.prevented, 1);
  pendingSave.resolve(true);
  assert.equal(await saving, true);
  const savedEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await live.dispatchWindow('beforeunload', savedEvent);
  assert.equal(savedEvent.prevented, 0);
});

test('explicit Local Mode labels the header action as JSON export', () => {
  const app = loadAdminApp();
  app.renderModeBadge();

  assert.match(app.elements.get('modeBadge').textContent, /Local Mode/);
  assert.equal(app.elements.get('saveBtn').textContent, 'JSONを書き出す');
});

test('responsive Live workspace fixes overflow, focus, sticky actions, and action hierarchy deterministically', () => {
  assert.match(adminCss, /@media\s*\(min-width:\s*900px\)[\s\S]*grid-template-columns:\s*320px\s+minmax\(0,\s*1fr\)/);
  assert.match(adminCss, /\.live-master-detail\.has-live-selection\s+\.live-master-pane\s*\{[\s\S]*display:\s*none/);
  assert.match(adminCss, /\.live-editor-task-tabs\s*\{[\s\S]*position:\s*sticky/);
  assert.match(adminCss, /\.live-editor-footer\s*\{[\s\S]*position:\s*sticky/);
  assert.match(adminCss, /\.live-editor-task-tab\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(adminCss, /\.live-editor-task-tab:focus-visible/);
  assert.match(adminCss, /\.live-editor-body\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(adminCss, /@supports\s*\(padding-bottom:\s*env\(safe-area-inset-bottom\)\)[\s\S]*\.live-editor-footer/);
  assert.match(adminCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  assert.match(adminHtml, /class="btn btn-primary live-primary-action live-add-button"[^>]*onclick="addLive\(\)"/);
  assert.match(adminHtml, /href="style\.css\?v=20261120-46"/);
  assert.match(adminHtml, /src="app\.js\?v=20261120-46"/);

  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'hierarchy', date: '2026-08-20', venue: 'Venue', image: '' }], past: [] } });
  app.editLive('hierarchy', 'upcoming');
  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /id="live-editor-save-btn"[^>]*class="[^"]*btn-primary[^"]*live-primary-action|class="[^"]*btn-primary[^"]*live-primary-action[^>]*id="live-editor-save-btn"/);
  // Issue #46: Xで告知する is the Primary action of the announcement (one Primary per area; the copy buttons are Secondary).
  assert.match(editorHtml, /id="x-intent-btn"/);
  assert.doesNotMatch(editorHtml, /class="[^"]*btn-primary[^"]*"[^>]*id="x-post-copy-btn"/);
});

test('sticky Live controls have no scrolling mechanism in the complete ancestor chain', () => {
  assert.match(
    adminHtml,
    /<body>[\s\S]*id="app"[\s\S]*id="live-tab"[\s\S]*id="live-workspace"[\s\S]*id="live-workspace-page-panel"[\s\S]*id="live-page-primary"[\s\S]*id="live-master-detail"[\s\S]*id="live-editor-pane"[\s\S]*id="live-editor-body"/,
  );
  assert.match(adminJs, /class="live-editor-task-tabs"[\s\S]*class="live-editor-footer"/);

  const directRuleBodies = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...adminCss.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
      .map((match) => match[1]);
  };
  const stickyAncestorSelectors = [
    'body',
    '#app',
    '.tab-content',
    '.live-workspace',
    '.live-workspace-panel',
    '#live-page-primary',
    '.live-master-detail',
    '.live-editor-pane',
    '.live-editor-body',
  ];
  for (const selector of stickyAncestorSelectors) {
    const bodies = directRuleBodies(selector);
    assert.doesNotMatch(
      bodies.join('\n'),
      /overflow(?:-x|-y)?:\s*(?:hidden|auto|scroll)\s*;/,
      `${selector} must not create a scrolling mechanism for Live sticky controls`,
    );
  }
  assert.match(directRuleBodies('.live-workspace').join('\n'), /overflow:\s*visible\s*;/);
  assert.match(directRuleBodies('.live-editor-pane').join('\n'), /overflow:\s*clip\s*;/);
  assert.match(adminCss, /\.live-editor-task-tabs\s*\{[^}]*position:\s*sticky/s);
  assert.match(adminCss, /\.live-editor-footer\s*\{[^}]*position:\s*sticky/s);
});

test('sticky Live task tabs offset below the fixed global header and navigation chrome', () => {
  assert.match(adminCss, /--admin-header-sticky-height:\s*\d+px\s*;/);
  assert.match(adminCss, /--admin-tab-nav-sticky-height:\s*\d+px\s*;/);
  assert.match(
    adminCss,
    /--admin-global-chrome-sticky-offset:\s*calc\(\s*var\(--admin-header-sticky-height\)\s*\+\s*var\(--admin-tab-nav-sticky-height\)\s*\)\s*;/,
  );
  assert.match(adminCss, /\.header\s*\{[^}]*height:\s*var\(--admin-header-sticky-height\)\s*;[^}]*position:\s*sticky\s*;[^}]*top:\s*0\s*;/s);
  assert.match(adminCss, /\.tab-nav\s*\{[^}]*height:\s*var\(--admin-tab-nav-sticky-height\)\s*;[^}]*position:\s*sticky\s*;[^}]*top:\s*var\(--admin-header-sticky-height\)\s*;/s);
  assert.match(adminCss, /\.live-editor-task-tabs\s*\{[^}]*position:\s*sticky\s*;[^}]*top:\s*var\(--admin-global-chrome-sticky-offset\)\s*;/s);
});

test('essential mobile Live workspace list utility and back controls guarantee 44px targets', () => {
  assert.match(
    adminCss,
    /@media\s*\(max-width:\s*899px\)\s*\{\s*\.live-workspace-tab,\s*\.live-list-tab,\s*\.live-workspace-utility,\s*\.live-editor-back\s*\{[^}]*min-height:\s*44px\s*;/s,
  );
});

test('saved header action maintains white text contrast through hover and focus', () => {
  assert.match(
    adminCss,
    /\.save-btn\.saved\s*,\s*\.save-btn\.saved:hover\s*,\s*\.save-btn\.saved:focus-visible\s*\{[^}]*background:\s*var\(--gray-900\);[^}]*color:\s*var\(--white\);/s,
  );
});

test('sticky Live task tabs and footer have no clipping workspace ancestor', () => {
  const workspaceRule = adminCss.match(/\.live-workspace\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(workspaceRule, /overflow:\s*visible;/);
  assert.doesNotMatch(workspaceRule, /overflow(?:-x|-y)?:\s*(?:hidden|auto|scroll|clip);/);
  assert.match(adminCss, /\.live-editor-task-tabs\s*\{[^}]*position:\s*sticky;/s);
  assert.match(adminCss, /\.live-editor-footer\s*\{[^}]*position:\s*sticky;/s);
});

test('production Live lock gives every workspace button a disabled affordance', () => {
  assert.match(adminJs, /querySelectorAll\?\.\('button, input, textarea, select'\)/);
  assert.match(adminJs, /document\.querySelectorAll\('\[data-live-edit\]'\)/);
  const disabledRule = adminCss.match(/\.save-btn:disabled,([\s\S]*?)\{([^}]*)\}/);
  assert.ok(disabledRule, 'the shared non-.btn disabled rule must exist');
  for (const selector of [
    '.add-btn:disabled',
    '.tab-btn:disabled',
    '.live-workspace button:disabled',
    '.live-workspace button[aria-disabled="true"]',
  ]) {
    assert.match(disabledRule[1], new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(disabledRule[2], /cursor:\s*not-allowed;/);
  assert.match(disabledRule[2], /pointer-events:\s*none;/);
  assert.match(disabledRule[2], /transform:\s*none;/);
  assert.match(disabledRule[2], /box-shadow:\s*none;/);
});

test('admin build marker and operator docs match the merged Live UI assets', () => {
  assert.match(adminHtml, /window\.ADMIN_BUILD_ID\s*=\s*'2026-11-20T\d{4}Z';/);
  const styleVersion = adminHtml.match(/style\.css\?v=([\w-]+)/)?.[1];
  const scriptVersion = adminHtml.match(/app\.js\?v=([\w-]+)/)?.[1];
  assert.ok(styleVersion);
  assert.equal(styleVersion, '20261120-46');
  assert.equal(scriptVersion, '20261120-46');
  assert.equal(adminHtml.match(/music-data\.js\?v=([\w-]+)/)?.[1], scriptVersion);
  assert.match(adminReadme, /Live編集の`下書きを作る`/);
  assert.match(adminReadme, /10項目を一括置換/);
});

test('Live edit workspace saves a category move in place and routes Local Mode to JSON export', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'move-live', date: '2026-08-10', title: 'Before', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.setupLiveWorkspace();
  app.renderLive();
  app.editLive('move-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'After', isPast: true });
  await app.elements.get('edit-title').dispatch('input');
  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');

  const saved = await app.saveLiveWorkspace();

  assert.equal(saved, true);
  assert.equal(app.getSiteData().live.upcoming.length, 0);
  assert.equal(app.getSiteData().live.past[0].id, 'move-live');
  assert.equal(app.getModalState().currentEditType, 'live-past');
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  assert.match(app.elements.get('live-editor-body').innerHTML, /value="After"/);
  assert.equal(app.elements.get('live-editor-save-status').textContent, 'JSON書き出し待ち');
  assert.equal(app.elements.get('saveBtn').disabled, false);
  assert.match(app.elements.get('saveBtn').textContent, /JSONを書き出す/);
  const movedTrigger = app.elements.get('live-past-list').children.find((item) => item.dataset.liveId === 'move-live');
  assert.equal(movedTrigger?.getAttribute('aria-current'), 'true');
});

test('Live edit workspace API save uses the existing save route and deletion keeps existing collection semantics', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'save-live', date: '2026-08-10', title: 'Save', venue: 'A', image: '' },
        { id: 'delete-live', date: '2026-08-11', title: 'Delete', venue: 'B', image: '' },
      ],
      past: [],
    },
  });
  let scopedSaves = 0;
  app.setSaveToApi(async () => { scopedSaves += 1; });
  app.editLive('save-live', 'upcoming');
  setLiveForm(app.elements);
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(scopedSaves, 1);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');

  app.editLive('delete-live', 'upcoming');
  const deleting = app.deleteLiveFromWorkspace();
  await answerLiveDialog(app, 'delete');
  assert.equal(await deleting, true);
  assert.equal(app.getSiteData().live.upcoming.some((live) => live.id === 'delete-live'), false);
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(scopedSaves, 2, 'a delete is saved on the spot (R46-06), not left for the header 保存');
  assert.equal(app.getSaveCalls(), 0, 'the header save (saveData) is not used');
});

test('Live editor isolation guards dirty transition and prevents duplicate edit IDs from contaminating News save', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    news: [],
    live: {
      upcoming: [{ id: 'live-owner', date: '2026-08-10', title: 'LIVE TITLE', venue: 'LIVE VENUE', image: '' }],
      past: [],
    },
  });
  app.editLive('live-owner', 'upcoming');
  app.elements.get('edit-title').value = 'LIVE UNSAVED';
  await app.elements.get('edit-title').dispatch('input');

  assert.equal(app.addNews(), false);
  await answerLiveDialog(app, 'stay');
  await flushAsync();
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.equal(app.getModalState().currentEditId, 'live-owner');
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-title"/);

  assert.equal(app.addNews(), false, 'the modal opens after the discard is confirmed, not at once');
  await answerLiveDialog(app, 'discard');
  await flushAsync();
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(app.elements.get('modal').classList.contains('active'), true);
  assert.doesNotMatch(app.elements.get('modal-body').innerHTML, /LIVE UNSAVED/);
  app.elements.get('edit-date').value = '2026-08-20';
  app.elements.get('edit-title').value = 'NEWS ONLY';
  app.elements.get('edit-description').value = 'NEWS DESCRIPTION';
  app.elements.get('edit-image').value = '';
  app.elements.get('edit-link').value = 'https://example.com/news';
  app.elements.get('edit-linkText').value = 'read';

  await app.saveModal();

  assert.equal(app.getSiteData().news[0].title, 'NEWS ONLY');
  assert.equal(app.getSiteData().news[0].description, 'NEWS DESCRIPTION');
  assert.equal(app.getSiteData().live.upcoming[0].title, 'LIVE TITLE');
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(app.getModalState().currentEditId, null);
});

test('Live API save transaction deduplicates clicks and locks mutations, navigation, back, and delete while pending', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'pending-live', date: '2026-08-10', title: 'Before', venue: 'A', image: '' },
        { id: 'other-live', date: '2026-08-11', title: 'Other', venue: 'B', image: '' },
      ],
      past: [],
    },
  });
  app.renderLive();
  const cardsBeforePublish = [...app.elements.get('live-upcoming-list').children];
  app.editLive('pending-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'Pending save' });
  const pendingAi = deferred();
  app.useAdminFetch(() => pendingAi.promise);
  const aiOperation = app.elements.get('live-source-parse-btn').dispatch('click');
  await flushAsync();
  const pendingSave = deferred();
  let saveCalls = 0;
  app.setSaveToApi(() => {
    saveCalls += 1;
    return pendingSave.promise;
  });

  const firstSave = app.saveLiveWorkspace();
  await flushAsync();
  const secondSave = app.saveLiveWorkspace();

  assert.equal(saveCalls, 1);
  assert.equal(await secondSave, false);
  assert.equal(app.elements.get('edit-title').disabled, true);
  assert.equal(app.elements.get('live-editor-task-public').disabled, true);
  assert.equal(app.elements.get('live-editor-back').disabled, true);
  assert.equal(app.elements.get('live-editor-delete-btn').disabled, true);
  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-add-btn').disabled, true);
  assert.equal(app.elements.get('edit-title').getAttribute('aria-disabled'), 'true');
  assert.equal(app.elements.get('live-editor-back').getAttribute('aria-disabled'), 'true');
  assert.equal(app.elements.get('live-editor-pane').getAttribute('aria-busy'), 'true');
  const replacementCards = [...app.elements.get('live-upcoming-list').children];
  assert.equal(replacementCards.length, 2);
  assert.notEqual(replacementCards[0], cardsBeforePublish[0], 'publish render must replace the list fixture');
  assert.equal(replacementCards.every((card) => card.disabled), true);
  assert.equal(replacementCards.every((card) => card.getAttribute('aria-disabled') === 'true'), true);
  const replacementOtherCard = replacementCards.find((card) => card.dataset.liveId === 'other-live');
  await app.dispatchDocument('click', { target: replacementOtherCard, preventDefault() {} });
  assert.equal(app.getModalState().currentEditId, 'pending-live');
  app.setConfirm(() => true);
  assert.equal(app.editLive('other-live', 'upcoming'), false);
  assert.equal(app.getModalState().currentEditId, 'pending-live');
  assert.equal(app.closeLiveEditor(), false);
  assert.equal(app.setLiveWorkspaceView('reservations'), false);
  assert.equal(app.setLiveListView('past'), false);
  assert.equal(app.setTicketSettingsOpen(true), false);
  assert.equal(app.setLiveEditorTask('announcement'), false);
  assert.equal(await app.deleteLiveFromWorkspace(), false);

  pendingAi.resolve(jsonResponse({ draft: validLiveSourceIntakeDraft({ title: 'LATE AI' }) }));
  assert.equal(await aiOperation, false);
  assert.equal(app.elements.get('edit-title').value, 'Pending save');
  assert.equal(app.elements.get('live-source-parse-btn').disabled, true);

  pendingSave.resolve(true);
  assert.equal(await firstSave, true);
  assert.equal(app.getModalState().currentEditId, 'pending-live');
  assert.equal(app.elements.get('edit-title').disabled, false);
  assert.equal(app.elements.get('live-add-btn').disabled, false);
  assert.equal(replacementCards.every((card) => !card.disabled), true);
  assert.equal(replacementCards.every((card) => card.getAttribute('aria-disabled') === 'false'), true);
  assert.notEqual(app.elements.get('edit-title').getAttribute('aria-disabled'), 'true');
  assert.equal(app.elements.get('live-editor-back').getAttribute('aria-disabled'), 'false');
  assert.equal(app.elements.get('live-editor-pane').getAttribute('aria-busy'), 'false');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
});

test('Live API save transaction rolls back failure, preserves form values, and cannot leak failed data through later header save', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    news: [],
    live: {
      upcoming: [{ id: 'rollback-live', date: '2026-08-10', title: 'Stored title', venue: 'Stored venue', image: '' }],
      past: [],
    },
  });
  app.editLive('rollback-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'FAILED TITLE', 'edit-venue': 'FAILED VENUE', isPast: true });
  const failedSave = deferred();
  app.setSaveToApi(() => failedSave.promise);

  const save = app.saveLiveWorkspace();
  await flushAsync();
  assert.equal(app.getSiteData().live.upcoming.length, 0, 'candidate mutation stays isolated to the pending transaction');
  failedSave.reject(new Error('API保存に失敗しました'));
  assert.equal(await save, false);

  assert.equal(app.getSiteData().live.upcoming[0].title, 'Stored title');
  assert.equal(app.getSiteData().live.upcoming[0].venue, 'Stored venue');
  assert.equal(app.getSiteData().live.past.length, 0);
  assert.equal(app.elements.get('edit-title').value, 'FAILED TITLE');
  assert.equal(app.elements.get('edit-venue').value, 'FAILED VENUE');
  assert.equal(app.elements.get('edit-isPast').checked, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
  assert.equal(app.elements.get('live-editor-save-error').textContent, 'API保存に失敗しました', 'the reason is shown');
  assert.equal(app.elements.get('saveBtn').disabled, true);

  assert.equal(app.addNews(), false, 'the failed Live is still unsaved, so the discard is asked first');
  await answerLiveDialog(app, 'discard');
  await flushAsync();
  assert.equal(app.elements.get('modal').classList.contains('active'), true);
  let persistedData = null;
  app.setSaveFunction(async () => {
    persistedData = structuredClone(app.getSiteData());
    return true;
  });
  assert.equal(await app.invokeSaveData({ silent: true }), true);
  assert.equal(persistedData.live.upcoming[0].title, 'Stored title');
  assert.equal(persistedData.live.past.length, 0);
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
});

test('Live API publish blocks global tab navigation and marks every global tab disabled while pending', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [{ id: 'nav-pending', date: '2026-08-10', title: 'Before', venue: 'A', image: '' }], past: [] } });
  app.setupTabs();
  app.editLive('nav-pending', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'Publishing' });
  const pending = deferred();
  app.setSaveToApi(() => pending.promise);

  const save = app.saveLiveWorkspace();
  await flushAsync();
  const tabs = ['site', 'news', 'live'].map((name) => app.elements.get(`global-tab-${name}`));
  assert.equal(tabs.every((tab) => tab.disabled), true);
  assert.equal(tabs.every((tab) => tab.getAttribute('aria-disabled') === 'true'), true);

  await app.elements.get('global-tab-site').dispatch('click');
  assert.equal(app.elements.get('global-tab-live').classList.contains('active'), true);
  assert.equal(app.elements.get('global-tab-site').classList.contains('active'), false);
  assert.equal(app.elements.get('live-tab').classList.contains('active'), true);
  assert.equal(app.elements.get('site-tab').classList.contains('active'), false);

  pending.resolve(true);
  assert.equal(await save, true);
});

test('global tabs re-enable and navigate normally after Live API publish succeeds', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [{ id: 'nav-success', date: '2026-08-10', title: 'Before', venue: 'A', image: '' }], past: [] } });
  app.setupTabs();
  app.editLive('nav-success', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'Published' });
  const pending = deferred();
  app.setSaveToApi(() => pending.promise);

  const save = app.saveLiveWorkspace();
  await flushAsync();
  pending.resolve(true);
  assert.equal(await save, true);

  const tabs = ['site', 'news', 'live'].map((name) => app.elements.get(`global-tab-${name}`));
  assert.equal(tabs.every((tab) => !tab.disabled), true);
  assert.equal(tabs.every((tab) => tab.getAttribute('aria-disabled') === 'false'), true);
  await app.elements.get('global-tab-site').dispatch('click');
  assert.equal(app.elements.get('global-tab-site').classList.contains('active'), true);
  assert.equal(app.elements.get('site-tab').classList.contains('active'), true);
  assert.equal(app.elements.get('live-tab').classList.contains('active'), false);
});

test('global tabs re-enable after Live API publish rollback while the failed Live form stays dirty', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [{ id: 'nav-failure', date: '2026-08-10', title: 'Stored', venue: 'A', image: '' }], past: [] } });
  app.setupTabs();
  app.editLive('nav-failure', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'FAILED VALUE' });
  const pending = deferred();
  app.setSaveToApi(() => pending.promise);

  const save = app.saveLiveWorkspace();
  await flushAsync();
  pending.reject(new Error('API保存に失敗しました'));
  assert.equal(await save, false);

  const tabs = ['site', 'news', 'live'].map((name) => app.elements.get(`global-tab-${name}`));
  assert.equal(tabs.every((tab) => !tab.disabled), true);
  assert.equal(tabs.every((tab) => tab.getAttribute('aria-disabled') === 'false'), true);
  assert.equal(app.elements.get('edit-title').value, 'FAILED VALUE');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
  assert.equal(app.elements.get('saveBtn').disabled, true);
  const leaving = app.elements.get('global-tab-news').dispatch('click');
  await answerLiveDialog(app, 'discard');
  await leaving;
  assert.equal(app.elements.get('global-tab-news').classList.contains('active'), true);
  assert.equal(app.elements.get('news-tab').classList.contains('active'), true);
});

test('shared LiveOperations script is loaded before the admin application', () => {
  const sharedIndex = adminHtml.indexOf('../assets/js/live-operations.js');
  const appIndex = adminHtml.indexOf('app.js');
  assert.ok(sharedIndex >= 0);
  assert.ok(sharedIndex < appIndex);
  assert.match(adminHtml, /href="style\.css\?v=20261120-46"/);
});

for (const provider of [undefined, 'openai', 'claude']) {
  const successMessage = `${provider === 'openai' ? 'OpenAI' : provider === 'claude' ? 'Claude' : 'AI'}で整理しました。内容を確認してから更新してください。`;
  const sourceResponse = (payload, options) => jsonResponse(
    provider === undefined || !Object.hasOwn(payload, 'draft') ? payload : { ...payload, provider }, options,
  );
test(`AIで整理 source intake posts the exact source once, replaces all ten fields including empty strings, and never parses or saves / ${provider ?? 'legacy'}`, async () => {
  let parserCalls = 0;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      parseLiveSourceText() {
        parserCalls += 1;
        throw new Error('legacy parser must not run');
      },
    },
  });
  const initial = {
    live: { upcoming: [{ id: 'stored', untouched: true }], past: [] },
  };
  app.setSiteData(structuredClone(initial));
  app.setSaveSpy();
  app.addLive();
  app.setApiMode(true);
  const sourceText = '  2026/8/20\nAIで整理する元情報  \n';
  setLiveForm(app.elements, {
    'edit-sourceText': sourceText,
    'edit-date': '2026-08-19',
    'edit-title': 'manual title',
    'edit-venue': 'manual venue stays',
    'edit-openTime': '17:30',
    'edit-startTime': '18:00',
    'edit-ticket': 'manual ticket',
    'edit-notes': 'manual notes',
    'edit-performers': 'manual performer',
    'edit-ticketUrl': 'https://old.example/ticket',
    'edit-link': 'https://old.example/detail',
  });
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const expectedDraft = {
    date: '2026-08-20',
    title: 'AI replacement',
    venue: '',
    openTime: '',
    startTime: '19:00',
    ticket: '',
    notes: 'AI notes',
    performers: '',
    ticketUrl: '',
    link: 'https://example.com/detail/2',
  };
  app.useAdminFetch(async () => sourceResponse({
    draft: {
      date: ' 2026-08-20 ',
      title: ' AI replacement ',
      venue: '   ',
      openTime: '',
      startTime: ' 19:00 ',
      ticket: '   ',
      notes: ' AI notes ',
      performers: '',
      ticketUrl: '   ',
      link: ' https://example.com/detail/2 ',
    },
  }));

  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /id="live-source-parse-btn"[^>]*>下書きを作る<\/button>/);
  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.fetchCalls.length, 1);
  assert.equal(app.fetchCalls[0].path, '/api/admin/live-source-intake');
  assert.equal(app.fetchCalls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(app.fetchCalls[0].options.body), { sourceText });
  assert.deepEqual({ ...app.fetchCalls[0].policy }, { allowBaseFallback: false });
  assert.equal(parserCalls, 0);
  assert.deepEqual(
    Object.fromEntries(Object.entries(expectedDraft).map(([key, value]) => [key, app.elements.get(`edit-${key}`).value])),
    expectedDraft,
  );
  assert.equal(app.elements.get('edit-sourceText').value, sourceText);
  assert.notEqual(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.match(app.elements.get('x-post-preview').value, /AI replacement/);
  assert.doesNotMatch(app.elements.get('x-post-preview').value, /manual venue stays|manual ticket|manual performer/);
  assert.equal(app.elements.get('live-source-warnings').textContent, successMessage);
  assert.deepEqual(app.getSiteData(), initial);
  assert.equal(app.getSaveCalls(), 0);
  assert.deepEqual(app.openedUrls, []);
});

test(`AIで整理 source intake marks an applied AI draft dirty and routes saving to the editor / ${provider ?? 'legacy'}`, async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'ai-dirty-live', date: '2026-08-19', title: 'Before', venue: 'Before venue', image: '' }],
      past: [],
    },
  });
  app.editLive('ai-dirty-live', 'upcoming');
  app.setApiMode(true);
  app.elements.get('edit-sourceText').value = 'AI draft source';
  app.useAdminFetch(async () => sourceResponse({ draft: validLiveSourceIntakeDraft() }));
  assert.equal(app.elements.get('saveBtn').disabled, false);

  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');
});

test(`AIで整理 source intake disables while pending, blocks duplicate submission, and always restores the button / ${provider ?? 'legacy'}`, async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'pending intake' });
  const response = deferred();
  app.useAdminFetch(() => response.promise);
  const button = app.elements.get('live-source-parse-btn');

  const first = button.dispatch('click');
  await flushAsync();
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, '下書きを作っています…');

  const second = button.dispatch('click');
  await flushAsync();
  assert.equal(app.fetchCalls.length, 1);

  response.resolve(sourceResponse({ draft: validLiveSourceIntakeDraft() }));
  await Promise.all([first, second]);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '下書きを作る');
});

test(`AIで整理 source intake discards a stale response when source text changes while pending / ${provider ?? 'legacy'}`, async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source at request start' });
  app.setSaveSpy();
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const response = deferred();
  app.useAdminFetch(() => response.promise);

  const pending = app.handleLiveSourceParse();
  await flushAsync();
  app.elements.get('edit-sourceText').value = 'latest human source edit';
  const latestSnapshot = snapshotLiveSourceIntake(app.elements);
  response.resolve(sourceResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await pending;

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, latestSnapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.match(app.elements.get('live-source-warnings').textContent, /入力が変更されたため反映しませんでした/);
  assert.match(app.elements.get('live-source-warnings').textContent, /もう一度/);
  assert.equal(app.getSaveCalls(), 0);
});

test(`AIで整理 source intake discards every AI field when one destination field changes while pending / ${provider ?? 'legacy'}`, async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'same source throughout request' });
  app.setSaveSpy();
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const response = deferred();
  app.useAdminFetch(() => response.promise);

  const pending = app.handleLiveSourceParse();
  await flushAsync();
  app.elements.get('edit-title').value = 'latest human title edit';
  const latestSnapshot = snapshotLiveSourceIntake(app.elements);
  response.resolve(sourceResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await pending;

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, latestSnapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.match(app.elements.get('live-source-warnings').textContent, /入力が変更されたため反映しませんでした/);
  assert.match(app.elements.get('live-source-warnings').textContent, /もう一度/);
  assert.equal(app.getSaveCalls(), 0);
});

test(`AIで整理 source intake lets a replacement modal run while the stale request resolves in reverse order / ${provider ?? 'legacy'}`, async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.setApiMode(true);
  app.setSaveSpy();
  const responseA = deferred();
  const responseB = deferred();
  const payloadB = deferred();
  let requestCount = 0;
  app.useAdminFetch(() => {
    requestCount += 1;
    if (requestCount === 1) return responseA.promise;
    if (requestCount === 2) return responseB.promise;
    throw new Error('duplicate request must not be sent');
  });

  app.addLive();
  setLiveForm(app.elements, { 'edit-sourceText': 'source A' });
  const buttonA = app.elements.get('live-source-parse-btn');
  const pendingA = buttonA.dispatch('click');
  await flushAsync();
  assert.equal(buttonA.disabled, true);

  app.setConfirm(() => true);
  app.closeLiveEditor();
  app.addLive();
  setLiveForm(app.elements, {
    'edit-sourceText': 'source B',
    'edit-date': '2026-09-08',
    'edit-title': 'B title before',
    'edit-venue': 'B venue before',
    'edit-openTime': '17:00',
    'edit-startTime': '18:00',
    'edit-ticket': 'B ticket before',
    'edit-notes': 'B notes before',
    'edit-performers': 'B performer before',
    'edit-ticketUrl': 'https://b.example/ticket-before',
    'edit-link': 'https://b.example/detail-before',
  });
  app.elements.get('x-post-preview').value = 'B POST BEFORE';
  const buttonB = app.elements.get('live-source-parse-btn');
  assert.equal(buttonB.disabled, false);
  const pendingB = buttonB.dispatch('click');
  await flushAsync();
  const bBusyBeforeAResolved = buttonB.disabled && buttonB.textContent === '下書きを作っています…';

  responseB.resolve({ ok: true, status: 200, json: () => payloadB.promise });
  await flushAsync();
  responseA.resolve(sourceResponse({ draft: validLiveSourceIntakeDraft({ title: 'STALE A' }) }));
  const resultA = await pendingA;
  const bBusyAfterAResolved = buttonB.disabled && buttonB.textContent === '下書きを作っています…';
  const duplicateB = buttonB.dispatch('click');
  await flushAsync();
  const requestCountWhileBBusy = app.fetchCalls.length;

  payloadB.resolve({
    ...(provider === undefined ? {} : { provider }),
    draft: validLiveSourceIntakeDraft({
      date: '2026-09-09',
      title: 'CURRENT B',
      venue: 'B venue',
      openTime: '18:30',
      startTime: '19:00',
      ticket: 'B ticket',
      notes: 'B notes',
      performers: 'B performer',
      ticketUrl: 'https://b.example/ticket',
      link: 'https://b.example/detail',
    }),
  });
  const [resultB, duplicateResult] = await Promise.all([pendingB, duplicateB]);

  assert.equal(resultA, false);
  assert.equal(resultB, true);
  assert.equal(duplicateResult, false);
  assert.equal(bBusyBeforeAResolved, true);
  assert.equal(bBusyAfterAResolved, true);
  assert.equal(requestCountWhileBBusy, 2);
  assert.equal(app.fetchCalls.length, 2);
  assert.deepEqual(app.fetchCalls.map((call) => JSON.parse(call.options.body).sourceText), ['source A', 'source B']);
  assert.equal(buttonB.disabled, false);
  assert.equal(buttonB.textContent, '下書きを作る');
  assert.equal(app.elements.get('edit-sourceText').value, 'source B');
  assert.equal(app.elements.get('edit-date').value, '2026-09-09');
  assert.equal(app.elements.get('edit-title').value, 'CURRENT B');
  assert.equal(app.elements.get('edit-venue').value, 'B venue');
  assert.equal(app.elements.get('edit-openTime').value, '18:30');
  assert.equal(app.elements.get('edit-startTime').value, '19:00');
  assert.equal(app.elements.get('edit-ticket').value, 'B ticket');
  assert.equal(app.elements.get('edit-notes').value, 'B notes');
  assert.equal(app.elements.get('edit-performers').value, 'B performer');
  assert.equal(app.elements.get('edit-ticketUrl').value, 'https://b.example/ticket');
  assert.equal(app.elements.get('edit-link').value, 'https://b.example/detail');
  assert.doesNotMatch(app.elements.get('x-post-preview').value, /STALE A/);
  assert.match(app.elements.get('x-post-preview').value, /CURRENT B/);
  assert.equal(app.elements.get('live-source-warnings').textContent, successMessage);
  assert.equal(app.getSaveCalls(), 0);
});

test(`AIで整理 source intake keeps every field and preview unchanged for HTTP, network, JSON, or schema failure / ${provider ?? 'legacy'}`, async (t) => {
  const failureCases = [
    ['HTTP', async () => ({
      ok: false,
      status: 502,
      async json() { return { error: '<img src=x onerror=alert(1)> provider-secret' }; },
    })],
    ['network', async () => { throw new Error('network provider-secret'); }],
    ['JSON', async () => ({ ok: true, status: 200, async json() { throw new SyntaxError('provider-secret'); } })],
    ['missing draft key', async () => sourceResponse({
      draft: {
        date: '2026-08-20',
        title: 'partial',
        venue: 'venue',
        openTime: '',
        startTime: '',
        ticket: '',
        notes: '',
        performers: '',
        ticketUrl: '',
      },
    })],
    ['extra draft key', async () => sourceResponse({
      draft: { ...validLiveSourceIntakeDraft(), confidence: 'high' },
    })],
    ['non-string draft value', async () => sourceResponse({
      draft: validLiveSourceIntakeDraft({ venue: null }),
    })],
  ];

  for (const [name, responder] of failureCases) {
    await t.test(name, async () => {
      const app = loadAdminApp();
      app.setSiteData({ live: { upcoming: [], past: [] } });
      app.addLive();
      app.setApiMode(true);
      setLiveForm(app.elements, { 'edit-sourceText': `source stays: ${name}` });
      app.setSaveSpy();
      app.elements.get('x-post-preview').value = 'POST BEFORE';
      const snapshot = snapshotLiveSourceIntake(app.elements);
      app.useAdminFetch(responder);

      await app.handleLiveSourceParse();

      assertLiveSourceIntakeUnchanged(app.elements, snapshot);
      assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
      assert.equal(app.elements.get('live-source-parse-btn').disabled, false);
      assert.equal(app.elements.get('live-source-parse-btn').textContent, '下書きを作る');
      assert.equal(app.elements.get('live-source-warnings').textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
      assert.doesNotMatch(app.elements.get('live-source-warnings').textContent, /provider-secret|<img/);
      assert.equal(app.getSaveCalls(), 0);
    });
  }
});

test(`AIで整理 source intake never falls back from a custom API base to canonical production / ${provider ?? 'legacy'}`, async (t) => {
  const customBase = 'https://custom-ai-dev.example.test';
  const failureCases = [
    ['502', async () => sourceResponse({ error: 'provider failed' }, { ok: false, status: 502 })],
    ['504', async () => sourceResponse({ error: 'provider timeout' }, { ok: false, status: 504 })],
    ['network', async () => { throw new Error('custom dev network failed'); }],
  ];

  for (const [name, networkFetch] of failureCases) {
    await t.test(name, async () => {
      const app = loadAdminApp({
        adminConfig: { apiBaseUrl: customBase, adminToken: 'test-admin-token' },
        networkFetch,
      });
      app.setSiteData({ live: { upcoming: [], past: [] } });
      app.addLive();
      setLiveForm(app.elements, { 'edit-sourceText': `private source ${name}` });
      app.setSaveSpy();
      app.elements.get('x-post-preview').value = 'POST BEFORE';
      const snapshot = snapshotLiveSourceIntake(app.elements);

      const result = await app.handleLiveSourceParse();

      assert.equal(result, false);
      assert.equal(app.networkFetchCalls.length, 1);
      assert.equal(app.networkFetchCalls[0].url, `${customBase}/api/admin/live-source-intake`);
      assert.equal(app.networkFetchCalls.some((call) => call.url.startsWith('https://1212hp.itsukimatsumoto.workers.dev')), false);
      assertLiveSourceIntakeUnchanged(app.elements, snapshot);
      assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
      assert.equal(app.elements.get('live-source-warnings').textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
      assert.equal(app.getSaveCalls(), 0);
    });
  }
});

test(`AIで整理 source intake fails atomically when one of the ten destination fields is missing / ${provider ?? 'legacy'}`, async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source stays when a destination is missing' });
  app.setSaveSpy();
  app.elements.delete('edit-link');
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  app.useAdminFetch(async () => sourceResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await app.handleLiveSourceParse();

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.equal(app.elements.get('live-source-warnings').textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
  assert.equal(app.getSaveCalls(), 0);
});

test(`AIで整理 source intake rolls back all fields and the unified preview when X preview generation fails / ${provider ?? 'legacy'}`, async () => {
  let failPreview = false;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      buildXAnnouncementText(...args) {
        if (failPreview) throw new Error('preview generation failed');
        return LiveOperations.buildXAnnouncementText(...args);
      },
    },
  });
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source stays when preview fails' });
  app.setSaveSpy();
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  failPreview = true;
  app.useAdminFetch(async () => sourceResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await app.handleLiveSourceParse();

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.equal(app.elements.get('live-source-warnings').textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
  assert.equal(app.getSaveCalls(), 0);
});

test(`AIで整理 source intake stays local-only in Local Mode without calling API, parser, preview, or save / ${provider ?? 'legacy'}`, async () => {
  let parserCalls = 0;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      parseLiveSourceText() { parserCalls += 1; return { draft: {}, warnings: [] }; },
    },
  });
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  setLiveForm(app.elements, { 'edit-sourceText': 'local source stays' });
  app.setSaveSpy();
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  app.useAdminFetch(async () => { throw new Error('API must not be called'); });

  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.fetchCalls.length, 0);
  assert.equal(parserCalls, 0);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.match(app.elements.get('live-source-warnings').textContent, /API Modeで利用できます/);
  assert.equal(app.getSaveCalls(), 0);
});
}

test('AIで整理 source intake rejects unknown provider values and extra top-level keys without applying or leaking details', async (t) => {
  const invalidPayloads = [
    ...['unknown', '', null, 5, {}, ['claude'], '<img src=x onerror=alert(1)>', 'toString', 'constructor', '__proto__'].map((provider) => ({ draft: validLiveSourceIntakeDraft(), provider })),
    { draft: validLiveSourceIntakeDraft(), provider: 'claude', request_id: 'private_request_id' },
    { draft: validLiveSourceIntakeDraft(), extra: 'private_prompt' },
    { provider: 'openai' },
    null,
    [],
  ];
  for (const [index, payload] of invalidPayloads.entries()) await t.test(`invalid payload ${index}`, async () => {
    const app = loadAdminApp();
    app.setSiteData({ live: { upcoming: [], past: [] } });
    app.addLive();
    app.setApiMode(true);
    app.setSaveSpy();
    setLiveForm(app.elements, { 'edit-sourceText': 'private source stays' });
    app.elements.get('x-post-preview').value = 'POST BEFORE';
    const before = snapshotLiveSourceIntake(app.elements);
    const status = app.elements.get('live-source-warnings');
    Object.defineProperty(status, 'innerHTML', { set() { assert.fail('status must use textContent'); } });
    app.useAdminFetch(async () => jsonResponse(payload));
    assert.equal(await app.handleLiveSourceParse(), false);
    assertLiveSourceIntakeUnchanged(app.elements, before);
    assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
    assert.equal(status.textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
    assert.equal(app.getSaveCalls(), 0);
    assert.deepEqual(app.openedUrls, []);
  });
});

for (const provider of ['openai', 'claude']) {
  test(`AIで整理 source intake cannot apply an older provider result or start another intake during save / ${provider}`, async () => {
    const app = loadAdminApp();
    app.setSiteData({ live: { upcoming: [], past: [] } });
    app.addLive();
    app.setApiMode(true);
    setLiveForm(app.elements, { 'edit-sourceText': 'source before publish' });
    const intakeResponse = deferred();
    const saveResponse = deferred();
    app.useAdminFetch((path) => path === '/api/admin/live-source-intake' ? intakeResponse.promise : saveResponse.promise);
    const intake = app.handleLiveSourceParse();
    await flushAsync();
    const saving = app.saveLiveWorkspace();
    await flushAsync();
    const before = snapshotLiveSourceIntake(app.elements);
    const preview = app.elements.get('x-post-preview').value;
    assert.equal(await app.handleLiveSourceParse(), false);
    intakeResponse.resolve(jsonResponse({ draft: validLiveSourceIntakeDraft(), provider }));
    assert.equal(await intake, false);
    assertLiveSourceIntakeUnchanged(app.elements, before);
    assert.equal(app.elements.get('x-post-preview').value, preview);
    assert.doesNotMatch(app.elements.get('live-source-warnings').textContent, /OpenAI|Claude|整理しました/);
    assert.equal(app.fetchCalls.filter((call) => call.path === '/api/admin/live-source-intake').length, 1);
    assert.equal(app.elements.get('live-source-parse-btn').disabled, true);
    saveResponse.resolve(jsonResponse({ ok: true }));
    assert.equal(await saving, true);
    assert.deepEqual(app.openedUrls, []);
  });

  test(`AIで整理 source intake clears previous provider status while pending, on failure and editor replacement / ${provider}`, async () => {
    const app = loadAdminApp();
    app.setSiteData({ live: { upcoming: [], past: [] } });
    app.addLive();
    app.setApiMode(true);
    setLiveForm(app.elements, { 'edit-sourceText': 'source stays' });
    const status = app.elements.get('live-source-warnings');
    Object.defineProperty(status, 'innerHTML', { set() { assert.fail('status must use textContent'); } });
    app.useAdminFetch(async () => jsonResponse({ draft: validLiveSourceIntakeDraft(), provider }));
    assert.equal(await app.handleLiveSourceParse(), true);
    assert.equal(status.textContent, `${provider === 'openai' ? 'OpenAI' : 'Claude'}で整理しました。内容を確認してから更新してください。`);
    const before = snapshotLiveSourceIntake(app.elements);
    const preview = app.elements.get('x-post-preview').value;
    const response = deferred();
    app.useAdminFetch(() => response.promise);
    const pending = app.handleLiveSourceParse();
    await flushAsync();
    assert.equal(status.textContent, '下書きを作っています…');
    response.resolve(jsonResponse({ error: 'private provider detail request_id prompt' }, { ok: false, status: 504 }));
    assert.equal(await pending, false);
    assertLiveSourceIntakeUnchanged(app.elements, before);
    assert.equal(app.elements.get('x-post-preview').value, preview);
    assert.equal(status.textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
    app.setConfirm(() => true);
    app.closeLiveEditor();
    app.addLive();
    assert.doesNotMatch(app.elements.get('live-source-warnings').textContent, /OpenAI|Claude|整理しました/);
  });
}

test('AIで整理 source intake uses the existing small status markup for desktop and mobile', () => {
  assert.match(adminJs, /id="live-source-warnings" class="parse-warnings" aria-live="polite"/);
  assert.match(adminCss, /\.parse-warnings\s*\{[^}]*font-size:\s*0\.85em/s);
});

test('Live editor exposes new fields and conservatively infers only a missing legacy ticketUrl', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'legacy', date: '', title: '', venue: '', description: '', image: '', link: 'https://tiget.net/events/legacy' },
        { id: 'explicit-empty', date: '', title: '', venue: '', description: '', image: '', link: 'https://tiget.net/events/ignored', ticketUrl: '' },
      ],
      past: [],
    },
  });

  app.editLive('legacy', 'upcoming');
  const legacyHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(legacyHtml, /id="edit-sourceText"/);
  assert.match(legacyHtml, /id="live-source-parse-btn"/);
  assert.match(legacyHtml, /id="edit-ticketUrl"[^>]*value="https:\/\/tiget\.net\/events\/legacy"/);
  assert.match(legacyHtml, /id="edit-reservationClosed"/);
  assert.match(legacyHtml, /id="edit-xComment"/);
  assert.match(legacyHtml, /<label for="edit-link">リンク<\/label>/);

  app.editLive('explicit-empty', 'upcoming');
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-ticketUrl"[^>]*value=""/);

  app.addLive();
  const newHtml = app.elements.get('live-editor-body').innerHTML;
  assert.doesNotMatch(newHtml, /id="edit-reservationClosed"[^>]*checked/);
});

test('structured Live editor normalizes legacy date and saves independent detail fields', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{
        id: 'structured-live',
        date: '2026.9.28(日)',
        title: 'Legacy title',
        venue: 'Legacy venue',
        description: '旧詳細を保持する',
        image: '',
        link: '',
      }],
      past: [],
    },
  });

  app.editLive('structured-live', 'upcoming');
  const html = app.elements.get('live-editor-body').innerHTML;
  assert.match(html, /type="date"[^>]*id="edit-date"[^>]*value="2026-09-28"/);
  assert.match(html, /type="time"[^>]*id="edit-openTime"/);
  assert.match(html, /type="time"[^>]*id="edit-startTime"/);
  assert.match(html, /id="edit-ticket"/);
  assert.match(html, /id="edit-notes"/);
  assert.match(html, /id="edit-performers"/);
  assert.match(html, /<label for="edit-description">説明<\/label>/, 'the description is always shown inside 予約先・リンクなど (F46-21)');
  assert.match(html, /旧詳細を保持する/);

  app.elements.get('edit-date').value = '2026-09-28';
  app.elements.get('edit-openTime').value = '18:30';
  app.elements.get('edit-startTime').value = '19:00';
  app.elements.get('edit-ticket').value = '¥2,500 + 1D';
  app.elements.get('edit-notes').value = '再入場不可';
  app.elements.get('edit-performers').value = 'A\nB / C';
  app.saveLiveItem();

  const saved = app.getSiteData().live.upcoming[0];
  assert.equal(saved.date, '2026-09-28');
  assert.equal(saved.openTime, '18:30');
  assert.equal(saved.startTime, '19:00');
  assert.equal(saved.ticket, '¥2,500 + 1D');
  assert.equal(saved.notes, '再入場不可');
  assert.equal(saved.performers, 'A / B / C');
  assert.equal(saved.description, '旧詳細を保持する');
  assert.match(app.elements.get('live-upcoming-list').innerHTML, /2026\.09\.28\(Mon\)/);
});

test('unparsed legacy Live date is preserved until a valid replacement is entered', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{
        id: 'unparsed-date',
        date: 'date TBA',
        title: 'Unparsed date Live',
        venue: 'Old venue',
        description: '',
        image: '',
        link: '',
      }],
      past: [],
    },
  });

  app.editLive('unparsed-date', 'upcoming');
  const html = app.elements.get('live-editor-body').innerHTML;
  assert.match(html, /id="edit-date"[^>]*value=""[^>]*data-original-unparsed-date="date TBA"/);
  assert.match(html, /現在の保存値: <code>date TBA<\/code>/);
  assert.match(app.elements.get('x-post-preview').value, /^date TBA/m);
  app.elements.get('edit-venue').value = 'Changed venue';
  app.saveLiveItem();
  assert.equal(app.getSiteData().live.upcoming[0].date, 'date TBA');
  assert.equal(app.getSiteData().live.upcoming[0].venue, 'Changed venue');

  app.editLive('unparsed-date', 'upcoming');
  app.elements.get('edit-date').value = '2026-09-28';
  app.saveLiveItem();
  assert.equal(app.getSiteData().live.upcoming[0].date, '2026-09-28');
});

test('saving a Live merges new fields into the original object without dropping unknown properties', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{
        id: 'live-merge',
        date: 'old',
        title: 'old',
        venue: 'old',
        description: 'old',
        image: 'old.jpg',
        link: 'https://example.com/detail',
        unknownFlag: 'keep-me',
        nested: { preserved: true },
      }],
      past: [],
    },
  });
  app.editLive('live-merge', 'upcoming');
  setLiveForm(app.elements, {
    'edit-sourceText': 'original source',
    'edit-ticketUrl': '',
    'edit-xComment': 'owner voice',
    reservationClosed: true,
  });

  app.saveLiveItem();

  const saved = app.getSiteData().live.upcoming[0];
  assert.equal(saved.unknownFlag, 'keep-me');
  assert.deepEqual(saved.nested, { preserved: true });
  assert.equal(saved.sourceText, 'original source');
  assert.equal(saved.ticketUrl, '');
  assert.equal(saved.reservationClosed, true);
  assert.equal(saved.xComment, 'owner voice');
  assert.equal(saved.link, 'https://instagram.com/night-shift');
});

test('unified X announcement preview drives Intent and copy without save', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'live-x' }], past: [] } });
  app.editLive('live-x', 'upcoming');
  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.equal((editorHtml.match(/id="x-post-preview"/g) || []).length, 1);
  assert.match(editorHtml, /<label[^>]*for="x-post-preview"[^>]*>投稿の内容<\/label>/);
  assert.doesNotMatch(editorHtml, /x-parent-preview|x-reply-preview|親投稿プレビュー|返信用 詳細プレビュー/);
  assert.equal(typeof app.updateXPreviewInModal, 'function');
  assert.equal(typeof app.copyXAnnouncementFromModal, 'function');

  setLiveForm(app.elements);
  app.setSaveSpy();

  app.updateXPreviewInModal();
  const announcement = app.elements.get('x-post-preview').value;
  assert.equal(announcement, LiveOperations.buildXAnnouncementText({
    id: 'live-x',
    date: '2026-08-10',
    title: 'Night Shift',
    venue: '柴崎mod',
    openTime: '18:30',
    startTime: '19:00',
    ticket: '¥2,500 + 1D',
    notes: '再入場不可',
    performers: '松本一樹 / another band',
    description: '',
    link: 'https://instagram.com/night-shift',
    sourceText: 'raw booking copy',
    ticketUrl: '',
    reservationClosed: false,
    xComment: 'ぜひ来てください',
  }, 'ぜひ来てください', 'https://1212hp.itsukimatsumoto.workers.dev/og/live/live-x'));
  assert.match(announcement, /^2026\.8\.10\(月\) 柴崎mod/m);
  assert.match(announcement, /OPEN \/ 18:30 START \/ 19:00/);
  assert.match(announcement, /-act-\n松本一樹\nanother band/);

  const intent = new URL(app.buildXIntentUrlFromModal());
  assert.equal(intent.hostname, 'twitter.com');
  assert.equal(intent.searchParams.get('text'), announcement);
  await app.copyXAnnouncementFromModal();
  assert.deepEqual(app.clipboardWrites, [announcement]);
  assert.equal(app.getSaveCalls(), 0);
});

test('Issue #29 live OGP share URL replaces canonical detail across preview, Intent, and link copy', async () => {
  const liveId = 'live copy/東京?';
  const shareUrl = `https://1212hp.itsukimatsumoto.workers.dev/og/live/${encodeURIComponent(liveId)}`;
  const canonicalUrl = `https://1212hp.com/live/detail/?liveId=${encodeURIComponent(liveId)}`;
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: liveId }], past: [] } });
  app.editLive(liveId, 'upcoming');
  setLiveForm(app.elements);
  app.setSaveSpy();

  app.updateXPreviewInModal();
  const firstPreview = app.elements.get('x-post-preview').value;
  assert.equal(firstPreview.endsWith(shareUrl), true);
  app.updateXPreviewInModal();
  const secondPreview = app.elements.get('x-post-preview').value;
  assert.equal(secondPreview, firstPreview);
  assert.equal(firstPreview.includes(canonicalUrl), false);
  assert.equal(new URL(shareUrl).search, '');

  const intent = new URL(app.buildXIntentUrlFromModal());
  const intentText = intent.searchParams.get('text');
  assert.equal(intentText, firstPreview);
  assert.equal(intentText.endsWith(shareUrl), true);

  assert.equal(await app.copyLiveLinkFromModal(), true);
  assert.deepEqual(app.clipboardWrites, [shareUrl]);
  assert.equal(app.getSaveCalls(), 0);
});

test('Issue #20 live link actions copy only the saved stable share URL and keep X actions save-free', async () => {
  const liveId = 'live copy/東京?';
  const shareUrl = `https://1212hp.itsukimatsumoto.workers.dev/og/live/${encodeURIComponent(liveId)}`;
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: liveId }], past: [] } });
  app.editLive(liveId, 'upcoming');

  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  const actionRow = editorHtml.match(/<div class="live-announcement-actions">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(actionRow, /id="x-intent-btn"/);
  assert.match(actionRow, /id="x-post-copy-btn"/);
  assert.match(actionRow, /id="x-link-copy-btn"/);
  assert.equal(typeof app.copyLiveLinkFromModal, 'function');

  setLiveForm(app.elements);
  app.setSaveSpy();
  assert.equal(await app.elements.get('x-link-copy-btn').dispatch('click'), true);
  assert.deepEqual(app.clipboardWrites, [shareUrl]);
  assert.equal(app.elements.get('live-copy-status').textContent, 'コピーしました。', 'the result is told next to the buttons (§10.2)');

  await app.elements.get('x-intent-btn').dispatch('click');
  const intent = new URL(app.openedUrls[0]);
  assert.match(intent.searchParams.get('text'), new RegExp(`${shareUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  assert.equal(app.getSaveCalls(), 0);
});

test('Issue #20 live link actions keep unsaved link copy disabled without clipboard, fallback, or save', async () => {
  const app = loadAdminApp({
    clipboardWrite: async () => { throw new Error('clipboard must not run'); },
    execCommandResult: true,
  });
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setSaveSpy();

  const linkCopyButton = app.elements.get('x-link-copy-btn');
  assert.ok(linkCopyButton);
  assert.equal(linkCopyButton.disabled, true);
  assert.equal(await app.copyLiveLinkFromModal(), false);
  assert.deepEqual(app.clipboardWrites, []);
  assert.deepEqual(app.execCommandCalls, []);
  assert.equal(app.getSaveCalls(), 0);
});

test('Issue #20 live link actions use the existing clipboard fallback and report both outcomes', async () => {
  const shareUrl = 'https://1212hp.itsukimatsumoto.workers.dev/og/live/fallback-live';
  const fallbackSuccess = loadAdminApp({
    clipboardWrite: async () => { throw new Error('permission denied'); },
    execCommandResult: true,
  });
  fallbackSuccess.setSiteData({ live: { upcoming: [{ id: 'fallback-live' }], past: [] } });
  fallbackSuccess.editLive('fallback-live', 'upcoming');
  fallbackSuccess.setSaveSpy();

  assert.equal(await fallbackSuccess.copyLiveLinkFromModal(), true);
  assert.deepEqual(fallbackSuccess.clipboardWrites, [shareUrl]);
  assert.deepEqual(fallbackSuccess.execCommandCalls, ['copy']);
  assert.equal(fallbackSuccess.createdTextareas[0]?.value, shareUrl);
  assert.equal(fallbackSuccess.elements.get('live-copy-status').textContent, 'コピーしました。');
  assert.equal(fallbackSuccess.getSaveCalls(), 0);

  const fallbackFailure = loadAdminApp({
    clipboardWrite: async () => { throw new Error('permission denied'); },
    execCommandResult: false,
  });
  fallbackFailure.setSiteData({ live: { upcoming: [{ id: 'fallback-live' }], past: [] } });
  fallbackFailure.editLive('fallback-live', 'upcoming');
  fallbackFailure.setSaveSpy();

  assert.equal(await fallbackFailure.copyLiveLinkFromModal(), false);
  assert.deepEqual(fallbackFailure.clipboardWrites, [shareUrl]);
  assert.deepEqual(fallbackFailure.execCommandCalls, ['copy']);
  assert.equal(fallbackFailure.elements.get('live-copy-status').textContent, 'コピーできませんでした');
  assert.equal(fallbackFailure.getSaveCalls(), 0);
});

test('Issue #20 live link actions use an isolated compact row that wraps without narrow overflow', () => {
  const actionRowRule = adminCss.match(/\.live-announcement-actions\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(actionRowRule, /display:\s*flex/);
  assert.match(actionRowRule, /flex-wrap:\s*wrap/);
  assert.match(actionRowRule, /max-width:\s*100%/);

  const actionButtonRule = adminCss.match(/\.live-announcement-actions\s+\.btn\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(actionButtonRule, /min-width:\s*0/);
  assert.match(actionButtonRule, /max-width:\s*100%/);
  assert.match(actionButtonRule, /overflow-wrap:\s*anywhere/);
});

test('new Live requires an explicit save before X Intent or reservation operations', () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  const html = app.elements.get('live-editor-body').innerHTML;
  assert.match(html, /保存すると使えます。/);
  assert.match(html, /id="x-intent-btn"[^>]*disabled/);
  assert.match(html, /id="manual-reservation-submit"[^>]*disabled/);
  assert.equal(app.buildXIntentUrlFromModal(), '');
});

test('saved Live ledger shows Local Mode gate and API mode fetches one Live with active record and seat totals', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'ledger-live', date: '', venue: '' }], past: [] } });
  app.editLive('ledger-live', 'upcoming');
  assert.match(app.elements.get('live-reservation-ledger').innerHTML, /API接続が必要です/);

  app.setApiMode(true);
  app.useAdminFetch(async () => ({
    ok: true,
    json: async () => ({
      reservations: [
        { id: 'web-1', liveId: 'ledger-live', name: 'A', quantity: 2, status: 'pending', source: 'web', email: 'a@example.com' },
        { id: 'manual-1', liveId: 'ledger-live', name: 'B', quantity: 3, status: 'handled', source: 'manual', contact: '@b', internalNote: 'door' },
        { id: 'cancelled', liveId: 'ledger-live', name: 'C', quantity: 8, status: 'cancelled', source: 'web' },
      ],
    }),
  }));

  await app.loadLiveReservations('ledger-live');

  assert.match(app.fetchCalls.at(-1).path, /^\/api\/admin\/ticket-reservations\?liveId=ledger-live/);
  const html = app.elements.get('live-reservation-ledger').innerHTML;
  assert.match(html, /<strong>5<\/strong>枚/);
  assert.match(html, />2件</);
  assert.doesNotMatch(html, /2[^<]*2件|5[^<]*5枚/);
  // Issue #46: the contact, the internal note and the source are on the one-reservation screen, not in the list row.
  assert.match(html, /status-badge is-pending/);
  app.handleReservationViewAction({ target: { dataset: { reservationOpen: 'manual-1', reservationScope: 'live' }, closest() { return this; } }, preventDefault() {} });
  const detail = app.elements.get('live-reservation-detail').innerHTML;
  assert.match(detail, /手動/);
  assert.match(detail, /@b/);
  assert.match(detail, /door/);
  app.handleReservationViewAction({ target: { dataset: { reservationOpen: 'web-1', reservationScope: 'live' }, closest() { return this; } }, preventDefault() {} });
  assert.match(app.elements.get('live-reservation-detail').innerHTML, /Web/);
});

test('manual hold posts the exact client-controlled payload, clears inputs, and refreshes both ledgers', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'manual-live', date: '', venue: '' }], past: [] } });
  app.editLive('manual-live', 'upcoming');
  app.setApiMode(true);
  setLiveForm(app.elements);
  ['manual-reservation-name', 'manual-reservation-quantity', 'manual-reservation-contact', 'manual-reservation-note']
    .forEach((id) => app.elements.set(id, app.elements.get(id) || createElement(id)));
  app.elements.get('manual-reservation-name').value = 'Door Guest';
  app.elements.get('manual-reservation-quantity').value = '3';
  app.elements.get('manual-reservation-contact').value = '090-0000-0000';
  app.elements.get('manual-reservation-note').value = 'paid';
  app.useAdminFetch(async (path, options) => ({
    ok: true,
    json: async () => path === '/api/admin/ticket-reservations' && options.method === 'POST'
      ? { reservation: { id: 'created' } }
      : { reservations: [] },
  }));

  await app.submitManualReservation();

  const post = app.fetchCalls.find((call) => call.path === '/api/admin/ticket-reservations' && call.options.method === 'POST');
  assert.deepEqual(JSON.parse(post.options.body), {
    liveId: 'manual-live',
    name: 'Door Guest',
    quantity: 3,
    contact: '090-0000-0000',
    internalNote: 'paid',
  });
  assert.equal(app.elements.get('manual-reservation-name').value, '');
  assert.equal(app.elements.get('manual-reservation-quantity').value, '1');
  assert.equal(app.elements.get('manual-reservation-contact').value, '');
  assert.equal(app.elements.get('manual-reservation-note').value, '');
  assert.ok(app.fetchCalls.some((call) => call.path.startsWith('/api/admin/ticket-reservations?liveId=manual-live')));
  assert.ok(app.fetchCalls.some((call) => call.path.includes('limit=200') && !call.path.includes('liveId=manual-live')));
});

test('active totals exclude cancelled reservations and cross-Live rows expose source/contact/note', () => {
  const app = loadAdminApp();
  const totals = app.calculateActiveReservationTotals([
    { status: 'pending', quantity: 2 },
    { status: 'handled', quantity: 3 },
    { status: 'cancelled', quantity: 9 },
  ]);
  assert.deepEqual({ records: totals.records, seats: totals.seats }, { records: 2, seats: 5 });

  const manual = app.renderReservationDetail({
    id: 'manual', liveId: 'live', name: '<Guest>', quantity: 2, status: 'handled',
    source: 'manual', contact: '<contact>', internalNote: '<note>',
  });
  assert.match(manual, /手動/);
  assert.match(manual, /&lt;contact&gt;/);
  assert.match(manual, /&lt;note&gt;/);
  assert.doesNotMatch(manual, /<contact>|<note>/);
});

test('CSV export uses authenticated adminFetch, downloads a Blob, and always cleans temporary resources', async () => {
  const csvBlob = new Blob(['id,name\n1,A'], { type: 'text/csv' });
  const app = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://admin.example.test', adminToken: 'secret-token' },
    networkFetch: async () => ({
      ok: true,
      status: 200,
      async blob() { return csvBlob; },
    }),
  });
  app.elements.get('tickets-live-filter').value = 'live/a';
  app.elements.get('tickets-status-filter').value = 'handled';

  await app.downloadTicketsCsv();

  assert.equal(app.networkFetchCalls.length, 1);
  assert.match(app.networkFetchCalls[0].url, /^https:\/\/admin\.example\.test\/api\/admin\/ticket-reservations\.csv\?/);
  assert.equal(app.networkFetchCalls[0].options.headers.get('Authorization'), 'Bearer secret-token');
  assert.equal(app.objectUrls.length, 1);
  assert.equal(app.objectUrls[0].blob, csvBlob);
  assert.equal(app.createdAnchors.length, 1);
  assert.equal(app.createdAnchors[0].href, app.objectUrls[0].url);
  assert.equal(app.createdAnchors[0].download, 'ticket_reservations.csv');
  assert.equal(app.createdAnchors[0].clicked, true);
  assert.deepEqual(app.revokedObjectUrls, [app.objectUrls[0].url]);
  assert.equal(app.document.body.children.length, 0);
});

test('CSV export surfaces non-OK errors and cleans an appended anchor even when click fails', async () => {
  const failed = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://admin.example.test', adminToken: 'secret-token' },
    networkFetch: async () => ({
      ok: false,
      status: 400,
      async json() { return { error: 'CSV生成に失敗しました' }; },
    }),
  });
  await failed.downloadTicketsCsv();
  assert.match(failed.elements.get('toast').textContent, /CSV生成に失敗しました/);
  assert.equal(failed.objectUrls.length, 0);
  assert.equal(failed.document.body.children.length, 0);

  const csvBlob = new Blob(['id'], { type: 'text/csv' });
  const clickFailure = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://admin.example.test', adminToken: 'secret-token' },
    networkFetch: async () => ({ ok: true, status: 200, async blob() { return csvBlob; } }),
  });
  clickFailure.setAnchorClickError(new Error('download click failed'));
  await clickFailure.downloadTicketsCsv();
  assert.match(clickFailure.elements.get('toast').textContent, /download click failed/);
  assert.equal(clickFailure.document.body.children.length, 0);
  assert.deepEqual(clickFailure.revokedObjectUrls, [clickFailure.objectUrls[0].url]);
});

test('reversed reservation responses cannot cross modal ownership or overwrite a newer same-Live request', async () => {
  const crossModal = loadAdminApp();
  crossModal.setApiMode(true);
  crossModal.setSiteData({
    live: {
      upcoming: [
        { id: 'live-a', date: '', title: '', venue: '', description: '', image: '', link: '' },
        { id: 'live-b', date: '', title: '', venue: '', description: '', image: '', link: '' },
      ],
      past: [],
    },
  });
  const responseA = deferred();
  const responseB = deferred();
  crossModal.useAdminFetch((path) => path.includes('liveId=live-a') ? responseA.promise : responseB.promise);

  crossModal.editLive('live-a', 'upcoming');
  const targetA = crossModal.elements.get('live-reservation-ledger');
  crossModal.editLive('live-b', 'upcoming');
  const targetB = crossModal.elements.get('live-reservation-ledger');
  assert.notEqual(targetA, targetB);
  assert.match(targetB.innerHTML, /読み込み中/);

  responseA.resolve(jsonResponse({ reservations: [{ id: 'a-old', name: 'OLD A', quantity: 1, status: 'pending' }] }));
  await flushAsync();
  assert.match(targetB.innerHTML, /読み込み中/);
  assert.doesNotMatch(targetB.innerHTML, /OLD A/);

  responseB.resolve(jsonResponse({ reservations: [{ id: 'b-new', name: 'LIVE B', quantity: 1, status: 'pending' }] }));
  await flushAsync();
  assert.match(targetB.innerHTML, /LIVE B/);

  const sameLive = loadAdminApp();
  sameLive.setApiMode(true);
  sameLive.setSiteData({ live: { upcoming: [{ id: 'same', date: '', venue: '' }], past: [] } });
  const older = deferred();
  const newer = deferred();
  let requestCount = 0;
  sameLive.useAdminFetch(() => (++requestCount === 1 ? older.promise : newer.promise));
  sameLive.editLive('same', 'upcoming');
  const newerLoad = sameLive.loadLiveReservations('same');
  newer.resolve(jsonResponse({ reservations: [{ id: 'new', name: 'NEWER', quantity: 1, status: 'pending' }] }));
  await newerLoad;
  older.resolve(jsonResponse({ reservations: [{ id: 'old', name: 'OLDER', quantity: 1, status: 'pending' }] }));
  await flushAsync();
  const sameTarget = sameLive.elements.get('live-reservation-ledger');
  assert.match(sameTarget.innerHTML, /NEWER/);
  assert.doesNotMatch(sameTarget.innerHTML, /OLDER/);

  const staleError = loadAdminApp();
  staleError.setApiMode(true);
  staleError.setSiteData({ live: { upcoming: [{ id: 'same-error', date: '', venue: '' }], past: [] } });
  const olderError = deferred();
  const newerSuccess = deferred();
  let errorRequestCount = 0;
  staleError.useAdminFetch(() => (++errorRequestCount === 1 ? olderError.promise : newerSuccess.promise));
  staleError.editLive('same-error', 'upcoming');
  const latestLoad = staleError.loadLiveReservations('same-error');
  newerSuccess.resolve(jsonResponse({ reservations: [{ id: 'fresh', name: 'FRESH', quantity: 1, status: 'pending' }] }));
  await latestLoad;
  olderError.reject(new Error('OLDER ERROR'));
  await flushAsync();
  const errorTarget = staleError.elements.get('live-reservation-ledger');
  assert.match(errorTarget.innerHTML, /FRESH/);
  assert.doesNotMatch(errorTarget.innerHTML, /OLDER ERROR|取得失敗/);
});

test('reservation loading for a non-current Live cannot mutate the current modal', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [{ id: 'live-b', date: '', venue: '' }], past: [] } });
  app.useAdminFetch(async () => jsonResponse({ reservations: [] }));
  app.editLive('live-b', 'upcoming');
  await flushAsync();
  const target = app.elements.get('live-reservation-ledger');
  target.innerHTML = '<p>LIVE B CURRENT</p>';
  const callCount = app.fetchCalls.length;

  await app.loadLiveReservations('live-a');

  assert.equal(target.innerHTML, '<p>LIVE B CURRENT</p>');
  assert.equal(app.fetchCalls.length, callCount);
});

test('cross-Live ledger ignores reversed stale success and error responses for older filter snapshots', async () => {
  const successApp = loadAdminApp();
  successApp.setApiMode(true);
  const olderSuccess = deferred();
  const latestSuccess = deferred();
  let successRequestCount = 0;
  successApp.useAdminFetch(() => (++successRequestCount === 1 ? olderSuccess.promise : latestSuccess.promise));
  const successLiveFilter = successApp.elements.get('tickets-live-filter');
  const successStatusFilter = successApp.elements.get('tickets-status-filter');
  successLiveFilter.value = 'live-a';
  successStatusFilter.value = 'pending';
  const olderSuccessLoad = successApp.loadTickets();
  assert.match(successApp.elements.get('tickets-list').innerHTML, /読み込み中/);

  successLiveFilter.value = 'live-b';
  successStatusFilter.value = 'handled';
  const latestSuccessLoad = successApp.loadTickets();
  latestSuccess.resolve(jsonResponse({
    reservations: [{ id: 'b-latest', liveId: 'live-b', name: 'LATEST B', quantity: 1, status: 'handled' }],
  }));
  await latestSuccessLoad;
  const successTarget = successApp.elements.get('tickets-list');
  assert.match(successTarget.innerHTML, /LATEST B/);
  assert.doesNotMatch(successTarget.innerHTML, /読み込み中/);

  olderSuccess.resolve(jsonResponse({
    reservations: [{ id: 'a-stale', liveId: 'live-a', name: 'STALE A', quantity: 1, status: 'pending' }],
  }));
  await olderSuccessLoad;
  assert.match(successTarget.innerHTML, /LATEST B/);
  assert.doesNotMatch(successTarget.innerHTML, /STALE A|読み込み中/);

  const errorApp = loadAdminApp();
  errorApp.setApiMode(true);
  const olderError = deferred();
  const latestResponse = deferred();
  let errorRequestCount = 0;
  errorApp.useAdminFetch(() => (++errorRequestCount === 1 ? olderError.promise : latestResponse.promise));
  const errorLiveFilter = errorApp.elements.get('tickets-live-filter');
  const errorStatusFilter = errorApp.elements.get('tickets-status-filter');
  errorLiveFilter.value = 'live-a';
  errorStatusFilter.value = 'pending';
  const olderErrorLoad = errorApp.loadTickets();
  errorLiveFilter.value = 'live-b';
  errorStatusFilter.value = 'handled';
  const latestResponseLoad = errorApp.loadTickets();
  latestResponse.resolve(jsonResponse({
    reservations: [{ id: 'b-fresh', liveId: 'live-b', name: 'FRESH B', quantity: 1, status: 'handled' }],
  }));
  await latestResponseLoad;
  olderError.reject(new Error('STALE A ERROR'));
  await olderErrorLoad;
  const errorTarget = errorApp.elements.get('tickets-list');
  assert.match(errorTarget.innerHTML, /FRESH B/);
  assert.doesNotMatch(errorTarget.innerHTML, /STALE A ERROR|取得失敗|読み込み中/);
});

test('cross-Live ledger response cannot mutate a disconnected replacement target', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  const response = deferred();
  app.useAdminFetch(() => response.promise);
  app.elements.get('tickets-live-filter').value = 'live-a';
  app.elements.get('tickets-status-filter').value = 'pending';
  const pendingLoad = app.loadTickets();
  const oldTarget = app.elements.get('tickets-list');
  const replacementTarget = createElement('tickets-list', app.document);
  replacementTarget.innerHTML = '<p>CURRENT REPLACEMENT</p>';
  oldTarget.isConnected = false;
  app.elements.set('tickets-list', replacementTarget);

  response.resolve(jsonResponse({
    reservations: [{ id: 'a-stale', liveId: 'live-a', name: 'STALE A', quantity: 1, status: 'pending' }],
  }));
  await pendingLoad;

  assert.equal(replacementTarget.innerHTML, '<p>CURRENT REPLACEMENT</p>');
  assert.doesNotMatch(replacementTarget.innerHTML, /STALE A|読み込み中/);
  assert.match(oldTarget.innerHTML, /読み込み中/);
  assert.doesNotMatch(oldTarget.innerHTML, /STALE A/);
});

test('cross-Live ledger response requires both current filters to match its snapshot', async () => {
  for (const changedFilter of ['live', 'status']) {
    const app = loadAdminApp();
    app.setApiMode(true);
    const response = deferred();
    app.useAdminFetch(() => response.promise);
    const liveFilter = app.elements.get('tickets-live-filter');
    const statusFilter = app.elements.get('tickets-status-filter');
    liveFilter.value = 'live-a';
    statusFilter.value = 'pending';
    const pendingLoad = app.loadTickets();
    const target = app.elements.get('tickets-list');
    if (changedFilter === 'live') liveFilter.value = 'live-b';
    if (changedFilter === 'status') statusFilter.value = 'handled';

    response.resolve(jsonResponse({
      reservations: [{ id: `${changedFilter}-stale`, liveId: 'live-a', name: 'STALE FILTER', quantity: 1, status: 'pending' }],
    }));
    await pendingLoad;

    assert.match(target.innerHTML, /読み込み中/);
    assert.doesNotMatch(target.innerHTML, /STALE FILTER/);
  }
});

test('cross-Live filters refresh without reloading when the effective selection remains valid', () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.useAdminFetch(async () => jsonResponse({ reservations: [] }));
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'move-me', date: 'OLD', title: '', venue: 'Old venue', description: '', image: '', link: '' },
        { id: 'keep-selected', date: 'KEEP', title: '', venue: 'Keep venue', description: '', image: '', link: '' },
        { id: 'delete-me', date: 'DELETE', title: '', venue: 'Delete venue', description: '', image: '', link: '' },
      ],
      past: [],
    },
  });
  app.renderTicketsUi();
  const filter = app.elements.get('tickets-live-filter');
  filter.value = 'keep-selected';

  app.editLive('move-me', 'upcoming');
  app.fetchCalls.length = 0;
  setLiveForm(app.elements, { 'edit-date': '2026-09-30', 'edit-venue': 'Moved venue', isPast: true });
  app.saveLiveItem();
  assert.match(filter.innerHTML, /2026\.09\.30\(Wed\) Moved venue/);
  assert.equal(filter.value, 'keep-selected');

  assert.equal(app.fetchCalls.length, 0);
});

test('deleting the selected Live falls back to all Lives and reloads the guarded ledger once', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'delete-me', date: 'DELETE', title: '', venue: 'Delete venue', description: '', image: '', link: '' },
        { id: 'keep-me', date: 'KEEP', title: '', venue: 'Keep venue', description: '', image: '', link: '' },
      ],
      past: [],
    },
  });
  app.useAdminFetch(async () => jsonResponse({
    reservations: [{ id: 'all-lives', liveId: 'keep-me', name: 'ALL LIVE RESULT', quantity: 1, status: 'pending' }],
  }));
  app.renderTicketsUi();
  const filter = app.elements.get('tickets-live-filter');
  filter.value = 'delete-me';

  app.editLive('delete-me', 'upcoming');
  await flushAsync();
  app.fetchCalls.length = 0;
  const deleting = app.deleteItem();
  await answerLiveDialog(app, 'delete');
  await deleting;
  await flushAsync();

  assert.doesNotMatch(filter.innerHTML, /DELETE Delete venue/);
  assert.equal(filter.value, '');
  const allLivesReads = app.fetchCalls.filter((call) => call.path.startsWith('/api/admin/ticket-reservations?') && !call.path.includes('liveId='));
  assert.equal(allLivesReads.length, 1, 'the all-Lives ledger is reloaded once');
  assert.match(app.elements.get('tickets-list').innerHTML, /ALL LIVE RESULT/);
});

test('reservation status actions use escaped data attributes and delegated event handling', async () => {
  const app = loadAdminApp();
  const dangerousId = `quote"');alert(1);//`;
  const row = app.renderReservationDetail({ id: dangerousId, name: 'Guest', status: 'pending', quantity: 1 });
  assert.doesNotMatch(row, /onclick=/);
  assert.match(row, /data-reservation-id="quote&quot;&#039;\);alert\(1\);\/\/"/);
  assert.match(row, /data-reservation-status="handled"/);
  assert.equal(typeof app.handleTicketStatusAction, 'function');

  app.setApiMode(true);
  app.useAdminFetch(async (path) => jsonResponse(path.includes('/status') ? {} : { reservations: [] }));
  const button = {
    dataset: { reservationId: dangerousId, reservationStatus: 'handled' },
    closest(selector) {
      assert.equal(selector, '[data-reservation-status]');
      return this;
    },
  };
  await app.handleTicketStatusAction({ target: button, preventDefault() {} });
  assert.ok(app.fetchCalls.some((call) => call.path === `/api/admin/ticket-reservations/${encodeURIComponent(dangerousId)}/status`));
});

test('generic edit modal remains an accessible dialog with Escape close, initial focus, and focus restoration', async () => {
  assert.match(adminHtml, /id="modal"[^>]*role="dialog"/);
  assert.match(adminHtml, /id="modal"[^>]*aria-modal="true"/);
  assert.match(adminHtml, /id="modal"[^>]*aria-labelledby="modal-title"/);
  assert.match(adminHtml, /class="modal-close"[^>]*aria-label="閉じる"/);

  const app = loadAdminApp();
  app.setSiteData({
    news: [{ id: 'focus-news', date: '2026.08.10', title: 'Focus News', description: '', image: '', link: '', linkText: '' }],
  });
  const trigger = createElement('news-edit-trigger', app.document, 'button');
  trigger.focus();
  app.editNews('focus-news');
  assert.equal(app.document.activeElement?.id, 'edit-date');
  assert.equal(app.elements.get('modal').classList.contains('active'), true);

  await app.dispatchDocument('keydown', { key: 'Escape' });
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.equal(app.getModalState().currentEditId, null);
  assert.equal(app.getModalState().currentEditType, null);
  assert.equal(app.getModalState().isNewItem, false);
  assert.equal(app.document.activeElement, trigger);
  assert.equal(trigger.focusCount, 2);
});

test('saving a rendered Live keeps its editor and selected replacement trigger after a category move', async () => {
  const app = loadAdminApp();
  const liveId = `focus-live-\"'\\danger`;
  app.setSiteData({
    live: {
      upcoming: [{ id: liveId, date: '2026.08.10', title: 'Moving Live', venue: 'Venue', description: '', image: '', link: '' }],
      past: [{ id: 'wrong-live', date: '2026.07.01', title: 'Wrong Live', venue: 'Elsewhere', description: '', image: '', link: '' }],
    },
  });
  app.setupLiveWorkspace();
  app.renderLive();
  const originalTrigger = app.elements.get('live-upcoming-list').children[0];
  originalTrigger.focus();

  await app.dispatchDocument('click', { target: originalTrigger, preventDefault() {} });
  assert.equal(app.document.activeElement?.id, 'edit-date');
  setLiveForm(app.elements, { isPast: true });
  await app.saveModal();

  const pastTriggers = app.elements.get('live-past-list').children;
  const replacementTrigger = pastTriggers.find((trigger) => trigger.dataset.liveId === liveId);
  const wrongTrigger = pastTriggers.find((trigger) => trigger.dataset.liveId === 'wrong-live');
  assert.equal(originalTrigger.isConnected, false, 'renderLive must replace the original trigger');
  assert.ok(replacementTrigger, 'the moved Live must have a newly rendered trigger');
  assert.notEqual(replacementTrigger, originalTrigger);
  assert.equal(app.elements.get('live-list-upcoming-panel').hidden, true);
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  assert.equal(app.elements.get('live-list-past-tab').getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-sourceText"/);
  assert.equal(app.document.activeElement?.id, 'edit-date');
  assert.equal(replacementTrigger.getAttribute('aria-current'), 'true');
  assert.equal(replacementTrigger.classList.contains('is-selected'), true);
  assert.equal(wrongTrigger.focusCount, 0, 'focus must not jump to a different Live');
});

test('saving a new past Live activates its visible destination category', () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.setupLiveWorkspace();
  app.addLive();
  setLiveForm(app.elements, { isPast: true });

  app.saveLiveItem();

  assert.equal(app.elements.get('live-list-upcoming-panel').hidden, true);
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  assert.equal(app.elements.get('live-list-past-tab').getAttribute('aria-selected'), 'true');
});

test('admin site-data save rejects cross-collection and same-collection duplicate Live IDs in API and Local modes', async (t) => {
  const duplicateCases = [
    ['cross-collection', {
      upcoming: [{ id: 'duplicate-live', date: '2099.08.01', venue: 'Upcoming Hall' }],
      past: [{ id: 'duplicate-live', date: '2000.08.01', venue: 'Past Hall' }],
    }],
    ['same-collection', {
      upcoming: [
        { id: 'duplicate-live', date: '2099.08.01', venue: 'First Hall' },
        { id: 'duplicate-live', date: '2099.08.02', venue: 'Second Hall' },
      ],
      past: [],
    }],
  ];

  for (const [duplicateKind, live] of duplicateCases) {
    for (const apiMode of [true, false]) {
      await t.test(`${duplicateKind} / ${apiMode ? 'API' : 'Local'}`, async () => {
        const app = loadAdminApp();
        app.setApiMode(apiMode);
        app.setSiteData({ live });
        app.useAdminFetch(async () => jsonResponse({ ok: true }));

        const saved = await app.saveData();

        assert.equal(saved, false);
        assert.equal(app.fetchCalls.length, 0, 'invalid data must not reach the admin API');
        assert.equal(app.createdAnchors.length, 0, 'invalid data must not be downloaded in Local mode');
        assert.match(app.elements.get('toast').textContent, /Live ID.*重複.*duplicate-live/);
      });
    }
  }
});

test('Ticket settings remove legacy copy and keep completion, field editing and contact in saved data', async () => {
  assert.doesNotMatch(adminHtml, /id="ticket-(?:intro|notice)-text"/);
  const app = loadAdminApp();
  const data = app.normalizeSiteData({ ticket: { introText: '旧案内', noticeText: '旧注意', completeText: '保存済みの完了文' }, contact: { introText: 'contact保持', formAction: 'https://example.com/contact' } });
  assert.equal('introText' in data.ticket, false);
  assert.equal('noticeText' in data.ticket, false);
  assert.equal(data.ticket.completeText, '保存済みの完了文');
  assert.equal(app.normalizeSiteData({}).ticket.completeText, '予約しました。');
  app.setSiteData(data);
  app.renderTicketSettings();
  const completion = app.elements.get('ticket-complete-text');
  assert.equal(completion.value, '保存済みの完了文');
  completion.value = '編集した完了文';
  completion.onchange();
  const quantity = app.elements.get('ticket-field-quantity');
  quantity.checked = false;
  quantity.onchange();
  const message = app.elements.get('ticket-field-label-message');
  message.value = '備考編集';
  message.onchange();
  assert.equal(app.getSiteData().ticket.completeText, '保存済みの完了文', 'edits stay in a draft until the settings are saved (R46-15)');
  assert.equal(app.getSiteData().ticket.fields.showQuantity, true);
  let saved;
  app.setApiMode(true);
  app.setAdminFetch(async (_path, options) => { saved = JSON.parse(options.body); return jsonResponse({ ok: true }); });
  assert.equal(await app.saveTicketSettings(), true);
  assert.ok(saved);
  assert.equal('introText' in saved.ticket, false);
  assert.equal('noticeText' in saved.ticket, false);
  assert.equal(saved.ticket.completeText, '編集した完了文');
  assert.equal(saved.ticket.fields.showQuantity, false);
  assert.equal(saved.ticket.fields.labelMessage, '備考編集');
  assert.equal(saved.contact.introText, 'contact保持');
  assert.equal(saved.contact.formAction, 'https://example.com/contact');
});

function musicFixture() {
  return {site:{featuredReleaseId:'r',heroImage:'assets/images/synthetic.jpg'},discography:{digital:[{id:'r',title:'Synthetic "<& title',releaseDate:'2025.05.05',description:'Synthetic track list',image:'assets/images/synthetic-release.jpg',link:'https://example.test/release',releaseType:'Single',playbackVideoId:'v'}],demo:[{id:'s',title:'Synthetic demo',releaseDate:'2024.01.01'}]},youtube:{musicVideos:[{id:'v',title:'Synthetic "<& video',youtubeId:'abcdefghijk'}],liveMovies:[{id:'w',title:'Synthetic live',youtubeId:'abcdefghijk'}],demos:[{id:'x',title:'Synthetic demo',youtubeId:'abcdefghijk'}]}};
}
async function musicApp({data=musicFixture(),api=false,putResponse}={}) {
  const app=loadAdminApp({networkFetch:async()=>({ok:true,json:async()=>structuredClone(data)})});
  let saved=structuredClone(data);
  app.setApiMode(api);
  app.useAdminFetch(async(path,options)=> {
    if(options.method==='PUT') {
      if(putResponse)return putResponse;
      saved=JSON.parse(options.body); return {ok:true,json:async()=>({ok:true,data:saved})};
    }
    return {ok:true,json:async()=>path==='/api/admin/site-data'?{data:structuredClone(saved)}:{tickets:[]}};
  });
  await app.loadData(); app.renderAll(); return app;
}
function musicEdit(app,id='r',category='digital',values={}) {
  assert.equal(app.editDiscography(id,category),true);
  for(const [key,value] of Object.entries(values)) app.elements.get('edit-'+key).value=value;
}
test('music data fields Site and modal labels, choices, escaping and Local JSON roundtrip',async()=>{
  const app=await musicApp();
  assert.match(adminHtml,/<h3>Home<\/h3>/);assert.match(adminHtml,/顔にする作品/);assert.match(adminHtml,/共有時の画像/);
  assert.ok(adminHtml.indexOf('music-data.js?v=20261120-46')<adminHtml.indexOf('app.js?v=20261120-46'));
  const select=app.elements.get('site-featured-release-id');assert.match(select.innerHTML,/自動（最新のリリース）/);assert.match(select.innerHTML,/Digital Release/);assert.match(select.innerHTML,/宅録Demo/);assert.match(select.innerHTML,/&quot;&lt;&amp;/);
  select.value='s';select.onchange(); assert.equal(app.getSiteData().site.featuredReleaseId,'s');
  musicEdit(app,'r','digital',{releaseType:'2nd Single',playbackVideoId:'w'});
  assert.match(app.elements.get('modal-body').innerHTML,/種別/);assert.match(app.elements.get('modal-body').innerHTML,/placeholder="2nd Single"/);
  const videos=app.elements.get('edit-playbackVideoId'); assert.deepEqual(videos.optionValues,['','v','w','x']);assert.match(videos.innerHTML,/&quot;&lt;&amp;/);
  assert.equal(await app.saveModal(),true);assert.equal(app.getSiteData().discography.digital[0].title,'Synthetic "<& title');assert.equal(app.getSiteData().discography.digital[0].description,'Synthetic track list');assert.equal(app.getSiteData().discography.digital[0].link,'https://example.test/release');
  assert.equal(await app.saveData(),true);const exported=JSON.parse(await app.objectUrls.at(-1).blob.text());assert.equal(exported.site.featuredReleaseId,'s');assert.equal(exported.discography.digital[0].playbackVideoId,'w');assert.equal(exported.discography.digital[0].releaseType,'2nd Single');assert.equal('data' in exported,false);
  const reload=await musicApp({data:exported});musicEdit(reload);assert.equal(reload.elements.get('edit-playbackVideoId').value,'w');assert.equal(reload.elements.get('edit-releaseType').value,'2nd Single');
  reload.elements.get('edit-playbackVideoId').value='';reload.elements.get('edit-releaseType').value='';assert.equal(await reload.saveModal(),true);
  const featured=reload.elements.get('site-featured-release-id');featured.value='';featured.onchange();assert.equal(reload.getSiteData().site.featuredReleaseId,'');
});
test('music data fields invalid date preserves modal, arrays, focus, draft, changes and fetch',async()=>{
  const app=await musicApp({api:true});musicEdit(app,'r','digital',{releaseDate:'2025.05.05\n'});
  const before=JSON.stringify(app.getSiteData());const calls=app.fetchCalls.length;
  assert.equal(app.saveDiscographyItem(),false);assert.equal(await app.saveModal(),false);assert.equal(JSON.stringify(app.getSiteData()),before);assert.equal(app.getHasChanges(),false);assert.equal(app.fetchCalls.length,calls);
  assert.equal(app.elements.get('modal').classList.contains('active'),true);const date=app.elements.get('edit-releaseDate');assert.equal(date.value,'2025.05.05\n');assert.equal(date.getAttribute('aria-invalid'),'true');assert.equal(date.getAttribute('aria-describedby'),'edit-releaseDate-error');assert.ok(date.focusCount>0);
  assert.equal(app.elements.get('edit-releaseDate-error').textContent,'「2025.05.05」の形で入力してください。');assert.match(app.elements.get('modal-body').innerHTML,/id="edit-releaseDate"[^>]*>\s*<[^>]*id="edit-releaseDate-error"[^>]*role="alert"/);
  date.value='2026.01.01';await date.dispatch('input');assert.equal(date.getAttribute('aria-invalid'),'false');assert.equal(app.elements.get('edit-releaseDate-error').textContent,'');assert.equal(await app.saveModal(),true);assert.equal(app.elements.get('modal').classList.contains('active'),false);
});
test('music data fields API failure keeps editor and baseline, structured errors bind only matching release',async()=>{
  const app=await musicApp({api:true,putResponse:{ok:false,json:async()=>({error:'invalid releaseDate',fields:[{id:'r',field:'releaseDate',message:'「2025.05.05」の形で入力してください。'}]})}});
  musicEdit(app,'r','digital',{releaseDate:'2026.01.01',releaseType:'Draft'});
  assert.equal(await app.saveModal(),false);assert.equal(app.elements.get('modal').classList.contains('active'),true);assert.equal(app.elements.get('edit-releaseType').value,'Draft');assert.equal(app.elements.get('edit-releaseDate').getAttribute('aria-invalid'),'true');assert.equal(app.getHasChanges(),true);
  app.useAdminFetch(async()=>({ok:true,json:async()=>({ok:true})}));assert.equal(await app.saveModal(),true);await app.loadData();
});
for(const oldDate of ['2025.5.5','2025/05/05','2025.05','',undefined,42,null]) test('music data fields legacy date '+String(oldDate)+' stays on unrelated save and move',async()=>{
  const data=musicFixture();data.discography.digital[0].releaseDate=oldDate;const app=await musicApp({data});musicEdit(app,'r','digital',{releaseType:'Demo',category:'demo'});assert.equal(await app.saveModal(),true);assert.equal(app.getSiteData().discography.demo[0].releaseDate,oldDate);assert.equal(await app.saveData(),true);
});
test('music data fields new release empty or shaped date, header validation and baseline only after success',async()=>{
  const app=await musicApp();app.addDiscography();app.elements.get('edit-releaseDate').value='2025/05/05';assert.equal(await app.saveModal(),false);app.elements.get('edit-releaseDate').value='';assert.equal(await app.saveModal(),true);assert.equal(await app.saveData(),true);
  app.getSiteData().discography.digital[0].releaseDate='bad';assert.equal(await app.saveData(),false);assert.equal(app.elements.get('edit-releaseDate').getAttribute('aria-invalid'),'true');assert.equal(app.elements.get('modal').classList.contains('active'),true);
  app.elements.get('edit-releaseDate').value='0000.99.99';assert.equal(await app.saveModal(),true);assert.equal(await app.saveData(),true);
});
test('music data fields API PUT preserves three fields and reloads values; saving/upload and read-only guard reject',async()=>{
  const app=await musicApp({api:true});musicEdit(app,'r','digital',{releaseType:'Album',playbackVideoId:'x'});assert.equal(await app.saveModal(),true);const put=app.fetchCalls.find(x=>x.options.method==='PUT');assert.equal(JSON.parse(put.options.body).discography.digital[0].releaseType,'Album');await app.loadData();musicEdit(app);assert.equal(app.elements.get('edit-releaseType').value,'Album');
  app.setApiFallbackReadOnly(true);app.elements.get('edit-releaseType').value='Tamper';app.elements.get('edit-playbackVideoId').value='w';assert.equal(await app.saveModal(),false);assert.equal(app.elements.get('edit-releaseType').value,'Album');assert.equal(app.elements.get('edit-playbackVideoId').value,'x');
  const featured=app.elements.get('site-featured-release-id');featured.value='s';featured.onchange();assert.equal(featured.value,'r');assert.equal(app.getSiteData().site.featuredReleaseId,'r');
  app.setApiFallbackReadOnly(false);app.setSaving(true);const before=JSON.stringify(app.getSiteData());musicEdit(app,'r','digital',{releaseType:'Busy'});assert.equal(await app.saveModal(),false);assert.equal(JSON.stringify(app.getSiteData()),before);
});

for(const api of [false,true]) test('music data fields deletion clears featured and shared video references through '+(api?'API':'Local JSON'),async()=>{
  const data=musicFixture(); data.discography.demo[0].playbackVideoId='v'; const app=await musicApp({data,api});app.setConfirm(()=>true);
  app.editYouTubeVideo('v','musicVideos');assert.equal(app.deleteItem(),true);assert.ok([...app.getSiteData().discography.digital,...app.getSiteData().discography.demo].every(x=>x.playbackVideoId===''));
  musicEdit(app);assert.equal(app.elements.get('edit-playbackVideoId').optionValues.includes('v'),false);assert.equal(app.deleteItem(),true);assert.equal(app.getSiteData().site.featuredReleaseId,'');assert.equal(app.elements.get('site-featured-release-id').optionValues.includes('r'),false);
  assert.equal(await app.saveData(),true);const out=api?JSON.parse(app.fetchCalls.filter(x=>x.options.method==='PUT').at(-1).options.body):JSON.parse(await app.objectUrls.at(-1).blob.text());assert.equal(out.site.featuredReleaseId,'');assert.equal(out.discography.digital.length,0);assert.equal(out.discography.demo[0].playbackVideoId,'');
});
test('music data fields unselected deletion, confirm cancellation and read-only never clear surviving selections',async()=>{
  const app=await musicApp();musicEdit(app,'s','demo');const before=JSON.stringify(app.getSiteData());assert.equal(app.deleteItem(),false);assert.equal(JSON.stringify(app.getSiteData()),before);
  app.setConfirm(()=>true);assert.equal(app.deleteItem(),true);assert.equal(app.getSiteData().site.featuredReleaseId,'r');assert.equal(app.getSiteData().discography.digital[0].playbackVideoId,'v');
  app.editYouTubeVideo('v','musicVideos');app.setApiFallbackReadOnly(true);const readOnly=JSON.stringify(app.getSiteData());assert.equal(app.deleteItem(),false);assert.equal(JSON.stringify(app.getSiteData()),readOnly);
});
test('music data fields release and video category moves preserve IDs and all selections',async()=>{
  const app=await musicApp();musicEdit(app,'r','digital',{category:'demo'});assert.equal(await app.saveModal(),true);assert.equal(app.getSiteData().site.featuredReleaseId,'r');assert.equal(app.elements.get('site-featured-release-id').value,'r');
  app.editYouTubeVideo('v','musicVideos');app.elements.get('edit-category').value='demos';assert.equal(await app.saveModal(),true);assert.equal(app.getSiteData().discography.demo[0].playbackVideoId,'v');musicEdit(app,'r','demo');assert.equal(app.elements.get('edit-playbackVideoId').value,'v');assert.equal(await app.saveData(),true);
});

test('music data fields successful saves advance date baseline and failures retain the old baseline',async()=>{
  for(const api of [false,true]) {
    const data=musicFixture();data.discography.digital[0].releaseDate='2025.5.5';const app=await musicApp({data,api});
    musicEdit(app,'r','digital',{releaseDate:'2026.01.01'});assert.equal(await app.saveModal(),true);
    if(!api)assert.equal(await app.saveData(),true);
    musicEdit(app,'r','digital',{releaseDate:'2025.5.5'});const before=JSON.stringify(app.getSiteData());assert.equal(await app.saveModal(),false);assert.equal(JSON.stringify(app.getSiteData()),before);
  }
  const data=musicFixture();data.discography.digital[0].releaseDate='2025.5.5';const failed=await musicApp({data,api:true,putResponse:{ok:false,json:async()=>({error:'synthetic failure'})}});
  musicEdit(failed,'r','digital',{releaseDate:'2026.01.01'});assert.equal(await failed.saveModal(),false);
  const calls=failed.fetchCalls.length;failed.elements.get('edit-releaseDate').value='2025.5.5';assert.equal(await failed.saveModal(),false);assert.equal(failed.fetchCalls.length,calls+1);assert.equal(failed.elements.get('edit-releaseDate').getAttribute('aria-invalid'),'false');
});
test('music data fields image upload blocks release mutation and JSON failure retains baseline',async()=>{
  const app=await musicApp();musicEdit(app,'r','digital',{releaseType:'Busy upload'});const before=JSON.stringify(app.getSiteData());app.setSyntheticImageUpload(true);assert.equal(await app.saveModal(),false);assert.equal(JSON.stringify(app.getSiteData()),before);assert.equal(await app.saveData(),false);app.setSyntheticImageUpload(false);
  const data=musicFixture();data.discography.digital[0].releaseDate='2025.5.5';const failed=await musicApp({data});musicEdit(failed,'r','digital',{releaseDate:'2026.01.01'});assert.equal(await failed.saveModal(),true);
  const count=failed.objectUrls.length;failed.setAnchorClickError(new Error('synthetic download failure'));assert.equal(await failed.saveData(),false);assert.equal(failed.objectUrls.length,count+1);
  musicEdit(failed,'r','digital',{releaseDate:'2025.5.5'});assert.equal(await failed.saveModal(),true);
});
test('music data fields structured API error for another release never marks the active release',async()=>{
  const app=await musicApp({api:true,putResponse:{ok:false,json:async()=>({error:'invalid releaseDate',fields:[{id:'s',field:'releaseDate',message:'Synthetic other error'}]})}});
  musicEdit(app,'r','digital',{releaseType:'Draft'});assert.equal(await app.saveModal(),false);assert.equal(app.elements.get('edit-releaseDate').getAttribute('aria-invalid'),'false');assert.equal(app.elements.get('edit-releaseDate-error').textContent,'');
});

for (const retry of ['same category', 'original category', 'other field']) {
  test('music data fields RV41-01 failed move retry with ' + retry + ' saves one release', async () => {
    const app = await musicApp({ api: true });
    let attempts = 0;
    let persisted;
    app.useAdminFetch(async (_path, options) => {
      attempts++;
      if (attempts === 1) return jsonResponse({ error: 'synthetic save failure' }, { ok: false, status: 500 });
      persisted = JSON.parse(options.body);
      return jsonResponse({ ok: true });
    });
    musicEdit(app, 'r', 'digital', { category: 'demo', releaseType: 'Draft' });
    assert.equal(await app.saveModal(), false);
    assert.equal(app.elements.get('modal').classList.contains('active'), true);
    assert.equal(app.elements.get('edit-releaseType').value, 'Draft');
    assert.equal(app.getHasChanges(), true);
    if (retry === 'original category') app.elements.get('edit-category').value = 'digital';
    if (retry === 'other field') app.elements.get('edit-title').value = 'Synthetic retry title';
    assert.equal(await app.saveModal(), true);
    assert.equal(attempts, 2);
    assert.equal(app.elements.get('modal').classList.contains('active'), false);
    assert.equal(app.getHasChanges(), false);
    for (const data of [app.getSiteData(), persisted]) {
      const releases = [...data.discography.digital, ...data.discography.demo];
      assert.equal(releases.filter(item => item.id === 'r').length, 1);
      const category = retry === 'original category' ? 'digital' : 'demo';
      const item = data.discography[category].find(item => item.id === 'r');
      assert.ok(item);
      assert.equal(item.releaseType, 'Draft');
      assert.equal(item.playbackVideoId, 'v');
      assert.equal(item.title, retry === 'other field' ? 'Synthetic retry title' : musicFixture().discography.digital[0].title);
      assert.equal(data.site.featuredReleaseId, 'r');
    }
  });
}

test('music data fields RV41-01 failed move then delete removes the moved release and featured reference', async () => {
  const app = await musicApp({ api: true, putResponse: jsonResponse({ error: 'synthetic failure' }, { ok: false, status: 500 }) });
  musicEdit(app, 'r', 'digital', { category: 'demo' });
  assert.equal(await app.saveModal(), false);
  app.setConfirm(() => true);
  assert.equal(app.deleteItem(), true);
  let persisted;
  app.useAdminFetch(async (_path, options) => {
    persisted = JSON.parse(options.body);
    return jsonResponse({ ok: true });
  });
  assert.equal(await app.saveData(), true);
  for (const data of [app.getSiteData(), persisted]) {
    assert.equal([...data.discography.digital, ...data.discography.demo].some(item => item.id === 'r'), false);
    assert.equal(data.site.featuredReleaseId, '');
    assert.equal(data.discography.demo.filter(item => item.id === 's').length, 1);
  }
});

test('music data fields RV41-01 Site and header save retries replace the same snapshot without adding releases', async () => {
  const app = await musicApp({ api: true });
  const featured = app.elements.get('site-featured-release-id');
  featured.value = 's';
  featured.onchange();
  const before = JSON.stringify(app.getSiteData());
  const payloads = [];
  app.useAdminFetch(async (_path, options) => {
    payloads.push(JSON.parse(options.body));
    return payloads.length === 1 ? jsonResponse({ error: 'synthetic failure' }, { ok: false, status: 500 }) : jsonResponse({ ok: true });
  });
  assert.equal(await app.saveData(), false);
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.equal(app.getHasChanges(), true);
  assert.equal(await app.saveData(), true);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(payloads[1].site.featuredReleaseId, 's');
  assert.equal([...payloads[1].discography.digital, ...payloads[1].discography.demo].length, 2);
});

for (const target of ['release', 'shared video']) {
  test('music data fields RV41-01 ' + target + ' deletion survives header failure and retry', async () => {
    const data = musicFixture();
    data.discography.demo[0].playbackVideoId = 'v';
    const app = await musicApp({ data, api: true });
    app.setConfirm(() => true);
    if (target === 'release') musicEdit(app);
    else app.editYouTubeVideo('v', 'musicVideos');
    assert.equal(app.deleteItem(), true);
    assert.equal(app.elements.get('modal').classList.contains('active'), false);
    const payloads = [];
    app.useAdminFetch(async (_path, options) => {
      payloads.push(JSON.parse(options.body));
      return payloads.length === 1 ? jsonResponse({ error: 'synthetic failure' }, { ok: false }) : jsonResponse({ ok: true });
    });
    assert.equal(await app.saveData(), false);
    assert.equal(await app.saveData(), true);
    assert.deepEqual(payloads[0], payloads[1]);
    const releases = [...payloads[1].discography.digital, ...payloads[1].discography.demo];
    assert.equal(releases.filter(item => item.id === 's').length, 1);
    if (target === 'release') {
      assert.equal(releases.some(item => item.id === 'r'), false);
      assert.equal(payloads[1].site.featuredReleaseId, '');
    } else {
      assert.equal(releases.length, 2);
      assert.ok(releases.every(item => item.playbackVideoId === ''));
      assert.equal(payloads[1].youtube.musicVideos.some(item => item.id === 'v'), false);
    }
  });
}

test('music data fields RV41-01 new release retry keeps its generated ID after category change', async () => {
  const app = await musicApp({ api: true });
  app.addDiscography();
  const id = app.getModalState().currentEditId;
  app.elements.get('edit-title').value = 'Synthetic new release';
  app.elements.get('edit-releaseDate').value = '';
  let attempts = 0;
  let persisted;
  app.useAdminFetch(async (_path, options) => {
    attempts++;
    if (attempts === 1) throw new Error('synthetic network failure');
    persisted = JSON.parse(options.body);
    return jsonResponse({ ok: true });
  });
  assert.equal(await app.saveModal(), false);
  app.elements.get('edit-category').value = 'demo';
  assert.equal(await app.saveModal(), true);
  const releases = [...persisted.discography.digital, ...persisted.discography.demo];
  assert.equal(releases.filter(item => item.id === id).length, 1);
  assert.equal(persisted.discography.demo.find(item => item.id === id).title, 'Synthetic new release');
  assert.equal(releases.length, 3);
});
