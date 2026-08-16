// 1212 HP Admin - App.js

const DEFAULT_SITE_DATA = {
  news: [],
  live: { ticketLink: '', upcoming: [], past: [] },
  discography: { digital: [], demo: [] },
  profile: { image: '', text: '', links: [] },
  // Seed with known videos so "missing youtube section" does not render as empty on public/admin.
  youtube: {
    channelUrl: 'https://www.youtube.com/@1212____ki',
    musicVideos: [
      { id: 'yt-mv-tsukiwomatte', title: '月を待って', youtubeId: 'JaPin67uO7A' },
      { id: 'yt-mv-lens', title: 'lens', youtubeId: 'gMNngWO5m1k' },
    ],
    liveMovies: [
      { id: 'yt-live-1', title: 'Live Movie 1', youtubeId: 'UembkfsXzJ4' },
      { id: 'yt-live-2', title: 'Live Movie 2', youtubeId: 'A58sXPiLb9M' },
    ],
    demos: [{ id: 'yt-demo-contrail', title: 'コントレイル', youtubeId: 'X5LEi_lEAWI' }],
  },
  site: {
    heroImage: 'assets/images/hero.jpg',
    links: {
      bandcamp: 'https://1212ki.bandcamp.com/',
      youtube: 'https://www.youtube.com/@1212____ki',
      x: 'https://www.x.com/1212____ki',
      instagram: 'https://www.instagram.com/1212____ki',
      note: 'https://note.com/1212_4939/m/m466c3962969c'
    },
    footerText: '© 2025 松本一樹 -itsuki matsumoto-. All rights reserved.'
  },
  ticket: {
    introText: 'ライブを選択して、必要事項を入力してください。',
    noticeText: '送信後、入力したe-mail宛に受付内容の自動返信をお送りします。',
    completeText: '予約しました。入力したe-mail宛に受付内容の自動返信をお送りします。',
    fields: {
      showQuantity: true,
      showMessage: true,
      labelQuantity: '枚数',
      labelMessage: '備考',
      placeholderMessage: '例: 取り置き名義が別の場合など',
      submitLabel: '予約する'
    }
  },
  contact: {
    introText: 'お問い合わせは以下のフォームに必要事項をご入力の上、送信してください。',
    formAction: 'https://formspree.io/f/xqaeddgj'
  }
};

const ADMIN_TOKEN_STORAGE_KEY = '1212hp_admin_token';
let API_BASE_URL = '';
let IS_API_MODE = false;
let adminToken = '';
const CANONICAL_API_BASE_URL = 'https://1212hp.itsukimatsumoto.workers.dev';

function normalizeLegacyApiBaseUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  return v
    .replace('tsukimatsumoto.workers.dev', 'itsukimatsumoto.workers.dev')
    .replace('itsuki-homepage-api.itsukii0414.workers.dev', '1212hp.itsukimatsumoto.workers.dev')
    .replace('1212hp.itsukii0414.workers.dev', '1212hp.itsukimatsumoto.workers.dev')
    .replace('itsuki-homepage-api.itsukimatsumoto.workers.dev', '1212hp.itsukimatsumoto.workers.dev');
}

function refreshAdminRuntimeConfig() {
  const cfg = window.ADMIN_CONFIG || {};
  const rawBase = normalizeLegacyApiBaseUrl(cfg.apiBaseUrl || '');
  const defaultProdBase = CANONICAL_API_BASE_URL;
  const isProdHost = typeof location !== 'undefined' && (location.hostname === '1212hp.com' || location.hostname.endsWith('.1212hp.com'));
  API_BASE_URL = String(rawBase || (isProdHost ? defaultProdBase : '')).replace(/\/+$/, '');
  IS_API_MODE = Boolean(API_BASE_URL);
  adminToken = String(cfg.adminToken || localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '').trim();
}

// In case scripts are cached/mis-ordered, compute API mode at runtime too.
refreshAdminRuntimeConfig();
let siteData = null;
let currentEditType = null;
let currentEditId = null;
let isNewItem = false;
let hasChanges = false;
let isSaving = false;
let activeLiveSourceIntakeOperation = null;
let modalGeneration = 0;
let modalReturnFocus = null;
let modalReturnFocusLive = null;
let liveEditorGeneration = 0;
let liveEditorReturnFocus = null;
let liveEditorReturnFocusLive = null;
let liveEditorDirty = false;
let liveReservationRequestSequence = 0;
let crossLiveReservationRequestSequence = 0;
let liveWorkspaceView = 'page';
let liveListView = 'upcoming';
let liveTicketSettingsOpen = false;
let isApiFallbackReadOnly = false;


// 新規追加した画像を保存（{filename: base64data}）
let pendingImages = {};
// APIモードの画像アップロード中ガード
let activeImageUploads = new Set();
let imageUploadSequence = 0;
const latestImageUploadByInput = new WeakMap();

document.addEventListener('click', handleTicketStatusAction);
document.addEventListener('click', handleLiveEditAction);
document.addEventListener('keydown', handleModalKeydown);

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  refreshAdminRuntimeConfig();
  renderModeBadge();
  await loadData();
  setupTabs();
  setupLiveWorkspace();
  renderAll();
  applyApiFallbackReadOnlyState();
});

function renderModeBadge() {
  const modeBadge = document.getElementById('modeBadge');
  const banner = document.getElementById('connectionBanner');
  const saveBtn = document.getElementById('saveBtn');
  if (!modeBadge || !banner) return;

  const build = window.ADMIN_BUILD_ID ? ' (' + window.ADMIN_BUILD_ID + ')' : '';

  if (IS_API_MODE) {
    modeBadge.textContent = (isApiFallbackReadOnly ? 'API Fallback' : 'API Mode') + build;
    banner.textContent = isApiFallbackReadOnly
      ? 'API接続失敗（ローカルJSONを読み取り専用で表示）'
      : 'Cloudflare APIへ接続中...';
    banner.classList.add('is-api');
    banner.classList[isApiFallbackReadOnly ? 'add' : 'remove']('is-error');
    if (saveBtn) {
      saveBtn.textContent = isApiFallbackReadOnly ? '読み取り専用' : '保存';
      saveBtn.disabled = isApiFallbackReadOnly;
    }
    return;
  }

  modeBadge.textContent = 'Local Mode' + build;
  banner.textContent = 'ローカルJSONモード（従来運用）';
  banner.classList.remove('is-api', 'is-error');
  if (saveBtn) {
    saveBtn.textContent = 'JSONを書き出す';
    saveBtn.disabled = false;
  }
}

function setConnectionBanner(text, state = 'normal') {
  const banner = document.getElementById('connectionBanner');
  if (!banner) return;
  banner.textContent = text;
  banner.classList.remove('is-api', 'is-error');
  if (state === 'api') banner.classList.add('is-api');
  if (state === 'error') banner.classList.add('is-error');
}

function applyApiFallbackReadOnlyState() {
  if (!isApiFallbackReadOnly) return;
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '読み取り専用';
  }
  setConnectionBanner('API接続失敗（ローカルJSONを読み取り専用で表示）', 'error');

  const readOnlyFieldIds = [
    'ticket-intro-text',
    'ticket-notice-text',
    'ticket-complete-text',
    'ticket-field-quantity',
    'ticket-field-message',
    'ticket-field-label-quantity',
    'ticket-field-label-message',
    'ticket-field-placeholder-message',
    'ticket-field-submit-label',
    'edit-sourceText',
    'edit-date',
    'edit-title',
    'edit-venue',
    'edit-openTime',
    'edit-startTime',
    'edit-ticket',
    'edit-notes',
    'edit-performers',
    'edit-description',
    'edit-image-file',
    'edit-ticketUrl',
    'edit-link',
    'edit-reservationClosed',
    'edit-isPast',
    'edit-xComment',
    'manual-reservation-name',
    'manual-reservation-quantity',
    'manual-reservation-contact',
    'manual-reservation-note',
  ];
  readOnlyFieldIds.forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.disabled = true;
  });
  [
    'live-source-parse-btn',
    'live-manual-entry-btn',
    'manual-reservation-submit',
    'live-editor-save-btn',
    'live-editor-delete-btn',
  ].forEach((id) => {
    const action = document.getElementById(id);
    if (action) {
      action.disabled = true;
      action.setAttribute('aria-disabled', 'true');
    }
  });
}

function rejectApiFallbackMutation(message = 'API接続を復旧してから操作してください。') {
  if (!isApiFallbackReadOnly) return false;
  showToast(message, 'error');
  applyApiFallbackReadOnlyState();
  return true;
}

function normalizeSiteData(input) {
  const base = structuredClone(DEFAULT_SITE_DATA);
  if (!input || typeof input !== 'object') return base;

  const normalized = { ...base, ...input };
  normalized.news = Array.isArray(normalized.news) ? normalized.news : [];

  normalized.live = normalized.live && typeof normalized.live === 'object' ? normalized.live : base.live;
  normalized.live.ticketLink = normalized.live.ticketLink || '';
  normalized.live.upcoming = Array.isArray(normalized.live.upcoming) ? normalized.live.upcoming : [];
  normalized.live.past = Array.isArray(normalized.live.past) ? normalized.live.past : [];

  normalized.discography = normalized.discography && typeof normalized.discography === 'object'
    ? normalized.discography
    : base.discography;
  normalized.discography.digital = Array.isArray(normalized.discography.digital) ? normalized.discography.digital : [];
  normalized.discography.demo = Array.isArray(normalized.discography.demo) ? normalized.discography.demo : [];

  normalized.profile = normalized.profile && typeof normalized.profile === 'object'
    ? normalized.profile
    : base.profile;
  normalized.profile.image = normalized.profile.image || '';
  normalized.profile.text = normalized.profile.text || '';
  normalized.profile.links = Array.isArray(normalized.profile.links) ? normalized.profile.links : [];

  normalized.youtube = normalized.youtube && typeof normalized.youtube === 'object' ? normalized.youtube : base.youtube;
  normalized.youtube.channelUrl = normalized.youtube.channelUrl || base.youtube.channelUrl;
  normalized.youtube.musicVideos = Array.isArray(normalized.youtube.musicVideos) ? normalized.youtube.musicVideos : base.youtube.musicVideos;
  normalized.youtube.liveMovies = Array.isArray(normalized.youtube.liveMovies) ? normalized.youtube.liveMovies : base.youtube.liveMovies;
  normalized.youtube.demos = Array.isArray(normalized.youtube.demos) ? normalized.youtube.demos : base.youtube.demos;

  normalized.site = normalized.site && typeof normalized.site === 'object' ? normalized.site : base.site;
  normalized.site.heroImage = normalized.site.heroImage || '';
  normalized.site.links = normalized.site.links && typeof normalized.site.links === 'object' ? normalized.site.links : base.site.links;
  normalized.site.links.bandcamp = normalized.site.links.bandcamp || '';
  normalized.site.links.youtube = normalized.site.links.youtube || '';
  normalized.site.links.x = normalized.site.links.x || '';
  normalized.site.links.instagram = normalized.site.links.instagram || '';
  normalized.site.links.note = normalized.site.links.note || '';
  normalized.site.footerText = normalized.site.footerText || '';

  normalized.ticket = normalized.ticket && typeof normalized.ticket === 'object' ? normalized.ticket : base.ticket;
  normalized.ticket.introText = normalized.ticket.introText || '';
  normalized.ticket.noticeText = normalized.ticket.noticeText || '';
  normalized.ticket.completeText = normalized.ticket.completeText || '';
  normalized.ticket.fields = normalized.ticket.fields && typeof normalized.ticket.fields === 'object'
    ? normalized.ticket.fields
    : base.ticket.fields;
  normalized.ticket.fields.showQuantity = normalized.ticket.fields.showQuantity !== false;
  normalized.ticket.fields.showMessage = normalized.ticket.fields.showMessage !== false;
  normalized.ticket.fields.labelQuantity = normalized.ticket.fields.labelQuantity || '';
  normalized.ticket.fields.labelMessage = normalized.ticket.fields.labelMessage || '';
  normalized.ticket.fields.placeholderMessage = normalized.ticket.fields.placeholderMessage || '';
  normalized.ticket.fields.submitLabel = normalized.ticket.fields.submitLabel || '';

  normalized.contact = normalized.contact && typeof normalized.contact === 'object' ? normalized.contact : base.contact;
  normalized.contact.introText = normalized.contact.introText || '';
  normalized.contact.formAction = normalized.contact.formAction || '';
  return normalized;
}

function findDuplicateLiveIds(input) {
  const operations = window.LiveOperations;
  if (operations && typeof operations.findDuplicateLiveIds === 'function') {
    return operations.findDuplicateLiveIds(input);
  }

  const live = input && input.live && typeof input.live === 'object' ? input.live : {};
  const upcoming = Array.isArray(live.upcoming) ? live.upcoming : [];
  const past = Array.isArray(live.past) ? live.past : [];
  const counts = new Map();
  for (const item of [...upcoming, ...past]) {
    const id = String(item && item.id != null ? item.id : '').trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
}

function getErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;

  const msg = payload.error || payload.message;
  if (msg) {
    // Worker returns { error: "unauthorized" } on auth failure.
    if (String(msg).toLowerCase() === "unauthorized") {
      return "認証エラー: 管理トークンが違う/期限切れの可能性があります（再入力してください）";
    }
    return msg;
  }

  return fallback;
}

function setImagePathForInputId(inputId, value) {
  if (inputId === 'profile-image') {
    siteData.profile.image = value || '';
    return;
  }
  if (inputId === 'site-hero-image') {
    siteData.site.heroImage = value || '';
    return;
  }
}

function ensureNoActiveImageUploads() {
  if (activeImageUploads.size === 0) return true;
  showToast('画像アップロード中です。完了してから保存してください', 'error');
  return false;
}

async function ensureAdminToken(forcePrompt = false) {
  if (!IS_API_MODE) return true;
  if (!forcePrompt && adminToken) return true;

  const promptText = forcePrompt
    ? "認証に失敗しました。管理トークンを再入力してください"
    : "管理トークンを入力してください（初回のみ）";

  const entered = window.prompt(promptText, "");
  if (!entered) return false;
  adminToken = String(entered).trim();
  if (!adminToken) return false;
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
  return true;
}

async function adminFetch(path, options = {}, policy = {}) {
  const resetToken = () => {
    adminToken = "";
    try {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch (e) {}
  };

  if (!(await ensureAdminToken())) {
    throw new Error("管理トークン未設定");
  }

  const baseHeaders = new Headers(options.headers || {});

  const buildHeaders = () => {
    const headers = new Headers(baseHeaders);
    if (adminToken) {
      headers.set("Authorization", `Bearer ${adminToken}`);
    }
    // Let the browser set Content-Type for FormData.
    if (options.body && !headers.has("Content-Type") && typeof options.body === "string") {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  const bases = [];
  const primary = String(API_BASE_URL || "").replace(/\/+$/, "");
  if (primary) bases.push(primary);
  if (policy.allowBaseFallback !== false && !bases.includes(CANONICAL_API_BASE_URL)) {
    bases.push(CANONICAL_API_BASE_URL);
  }

  let lastError = null;
  let lastResponse = null;
  let didRetryAuth = false;

  const shouldTryNextBase = (status) => {
    return status === 401 || status === 403 || status === 404 || status >= 500;
  };

  for (const base of bases) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${base}${path}`, { ...options, headers: buildHeaders() });
        lastResponse = response;

        if (response.ok) {
          if (base !== API_BASE_URL) API_BASE_URL = base;
          return response;
        }

        // If auth failed, clear stored token, prompt once, and retry on the same base.
        if (!didRetryAuth && (response.status === 401 || response.status === 403)) {
          let isUnauthorized = true;
          try {
            const payload = await response.clone().json();
            const msg = payload && (payload.error || payload.message);
            if (msg && String(msg).toLowerCase() !== "unauthorized") {
              isUnauthorized = false;
            }
          } catch (e) {}

          if (isUnauthorized) {
            didRetryAuth = true;
            resetToken();
            if (await ensureAdminToken(true)) {
              continue;
            }
          }
        }

        if (shouldTryNextBase(response.status)) {
          break; // try next base
        }

        if (base !== API_BASE_URL) API_BASE_URL = base;
        return response;
      } catch (error) {
        lastError = error;
        break; // try next base
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error("API request failed");
}

async function loadTickets() {
  if (!IS_API_MODE) return;
  const listEl = document.getElementById('tickets-list');
  if (!listEl) return;
  if (isApiFallbackReadOnly) {
    listEl.innerHTML = '<div class="empty-state operation-gate"><p>API接続失敗中は予約管理を読み取り専用で表示します。</p></div>';
    return;
  }

  const liveFilter = document.getElementById('tickets-live-filter');
  const statusFilter = document.getElementById('tickets-status-filter');
  const liveId = liveFilter?.value || '';
  const status = statusFilter?.value || '';
  const requestSequence = ++crossLiveReservationRequestSequence;
  const ownsCurrentList = () => (
    crossLiveReservationRequestSequence === requestSequence
    && listEl.isConnected
    && document.getElementById('tickets-list') === listEl
    && document.getElementById('tickets-live-filter') === liveFilter
    && document.getElementById('tickets-status-filter') === statusFilter
    && (liveFilter?.value || '') === liveId
    && (statusFilter?.value || '') === status
  );
  const params = new URLSearchParams();
  if (liveId) params.set('liveId', liveId);
  if (status) params.set('status', status);
  params.set('limit', '200');

  if (!ownsCurrentList()) return;
  listEl.innerHTML = '<div class="empty-state"><p>読み込み中...</p></div>';
  try {
    const res = await adminFetch(`/api/admin/ticket-reservations?${params.toString()}`);
    const payload = await res.json().catch(() => ({}));
    if (!ownsCurrentList()) return;
    if (!res.ok) throw new Error(getErrorMessage(payload, '予約一覧を取得できませんでした'));
    const reservations = Array.isArray(payload.reservations) ? payload.reservations : [];
    if (reservations.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>予約がありません</p></div>';
      return;
    }
    listEl.innerHTML = reservations.map(r => renderTicketRow(r)).join('');
  } catch (e) {
    if (!ownsCurrentList()) return;
    listEl.innerHTML = `<div class="empty-state"><p>取得失敗: ${escapeHtml(e.message)}</p></div>`;
  }
}

function renderTicketRow(r, options = {}) {
  const status = r.status || 'unknown';
  const statusLabel = status === 'pending' ? '未対応' : status === 'handled' ? '対応済み' : status === 'cancelled' ? 'キャンセル' : status;
  const statusClass = status === 'pending' ? 'is-pending' : status === 'handled' ? 'is-handled' : status === 'cancelled' ? 'is-cancelled' : '';
  const title = `${r.liveDate || ''} ${r.liveVenue || ''}`.trim();
  const source = r.source === 'manual' ? 'manual' : 'web';
  const sourceLabel = source === 'manual' ? '手動' : 'Web';
  const contact = source === 'manual' ? (r.contact || '') : (r.email || r.contact || '');
  const meta = `${r.name || ''} / ${r.quantity || 1}枚${contact ? ` / ${contact}` : ''}`.trim();
  const msg = r.message ? `<div class="meta ticket-message">${escapeHtml(r.message)}</div>` : '';
  const note = r.internalNote ? `<div class="meta ticket-note"><span class="meta-label">内部メモ</span> ${escapeHtml(r.internalNote)}</div>` : '';
  const reservationId = escapeHtml(String(r.id || ''));
  const actions = status === 'pending'
    ? `<button type="button" class="x-test-btn" data-reservation-id="${reservationId}" data-reservation-status="handled">対応済み</button>
       <button type="button" class="x-post-btn" data-reservation-id="${reservationId}" data-reservation-status="cancelled">キャンセル</button>`
    : `<button type="button" class="x-test-btn" data-reservation-id="${reservationId}" data-reservation-status="pending">未対応に戻す</button>`;

  return `
    <div class="item-card ticket-row ${options.compact ? 'is-compact' : ''}">
      <div class="info">
        <div class="ticket-top">
          <div class="title">${escapeHtml(options.compact ? (r.name || '') : (title || r.liveId || ''))}</div>
          <span class="source-badge is-${source}">${sourceLabel}</span>
          <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="meta">${escapeHtml(meta)}</div>
        ${msg}
        ${note}
        <div class="meta mt-2">${escapeHtml(r.createdAt || '')}</div>
        <div class="ticket-actions">
          ${actions}
        </div>
      </div>
    </div>
  `;
}

function handleTicketStatusAction(event) {
  const button = event.target?.closest?.('[data-reservation-status]');
  if (!button) return undefined;
  const id = String(button.dataset?.reservationId || '');
  const status = String(button.dataset?.reservationStatus || '');
  if (!id || !['pending', 'handled', 'cancelled'].includes(status)) return undefined;
  event.preventDefault?.();
  return markTicketStatus(id, status);
}

async function markTicketStatus(id, status) {
  if (rejectApiFallbackMutation('読み取り専用のため予約状態を変更できません。')) return false;
  if (!IS_API_MODE) return false;
  try {
    const res = await adminFetch(`/api/admin/ticket-reservations/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(payload, 'ステータス更新に失敗しました'));
    const refreshes = [loadTickets()];
    if (!isNewItem && currentEditId) refreshes.push(loadLiveReservations(currentEditId));
    await Promise.all(refreshes);
    return true;
  } catch (e) {
    showToast(`更新失敗: ${e.message}`, 'error');
    return false;
  }
}

async function downloadTicketsCsv() {
  if (!IS_API_MODE) {
    showToast('CSVはAPIモードでのみ利用できます', 'error');
    return;
  }
  let anchor = null;
  let objectUrl = '';
  try {
    const liveId = document.getElementById('tickets-live-filter')?.value || '';
    const status = document.getElementById('tickets-status-filter')?.value || '';
    const params = new URLSearchParams();
    if (liveId) params.set('liveId', liveId);
    if (status) params.set('status', status);
    params.set('limit', '200');
    const response = await adminFetch(`/api/admin/ticket-reservations.csv?${params.toString()}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(payload, 'CSVを取得できませんでした'));
    }
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'ticket_reservations.csv';
    document.body.appendChild(anchor);
    anchor.click();
  } catch (e) {
    showToast(`CSV失敗: ${e.message}`, 'error');
  } finally {
    try {
      if (anchor?.parentElement) {
        anchor.parentElement.removeChild(anchor);
      }
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }
}

// データ読み込み
async function loadData() {
  if (IS_API_MODE) {
    try {
      const response = await adminFetch('/api/admin/site-data');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'APIからデータを取得できませんでした'));
      }
      siteData = normalizeSiteData(payload.data ?? payload);
      isApiFallbackReadOnly = false;
      setConnectionBanner('Cloudflare API接続中', 'api');
      await loadTickets();
      return;
    } catch (error) {
      console.error('APIデータ読み込みエラー:', error);
      isApiFallbackReadOnly = true;
      setConnectionBanner(`API接続失敗: ${error.message}（ローカルJSONを読み取り専用で表示）`, 'error');
    }
  } else {
    isApiFallbackReadOnly = false;
  }

  try {
    const response = await fetch('data/site-data.json', { cache: 'no-store' });
    siteData = normalizeSiteData(await response.json());
  } catch (e) {
    console.error('データ読み込みエラー:', e);
    siteData = normalizeSiteData(null);
  }
}

// タブ切り替え
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const activate = () => {
        if (currentEditType?.startsWith('live')) closeLiveEditorImmediately();
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        return true;
      };
      if (btn.dataset.tab === 'live') activate();
      else requestLiveEditorTransition(activate);
    });
  });
}

function requestLiveEditorTransition(action) {
  if (liveEditorDirty) {
    const shouldDiscard = confirm('未保存の変更を破棄して移動しますか？');
    if (!shouldDiscard) return false;
    setLiveEditorDirty(false);
  }
  return action() !== false;
}

function syncLiveWorkspaceTabs() {
  document.querySelectorAll('[data-live-workspace-view]').forEach((tab) => {
    const isSelected = tab.dataset.liveWorkspaceView === liveWorkspaceView;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.setAttribute('tabindex', isSelected ? '0' : '-1');
    tab.classList[isSelected ? 'add' : 'remove']('is-active');
  });

  document.querySelectorAll('[data-live-workspace-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.liveWorkspacePanel !== liveWorkspaceView;
  });
}

function syncLiveListTabs() {
  document.querySelectorAll('[data-live-list-view]').forEach((tab) => {
    const isSelected = tab.dataset.liveListView === liveListView;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.setAttribute('tabindex', isSelected ? '0' : '-1');
    tab.classList[isSelected ? 'add' : 'remove']('is-active');
  });

  document.querySelectorAll('[data-live-list-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.liveListPanel !== liveListView;
  });
}

function syncTicketSettingsPanel() {
  const livePagePrimary = document.getElementById('live-page-primary');
  const ticketSettingsPanel = document.getElementById('live-ticket-settings-panel');
  const openTicketSettings = document.getElementById('live-ticket-settings-open');
  if (livePagePrimary) livePagePrimary.hidden = liveTicketSettingsOpen;
  if (ticketSettingsPanel) ticketSettingsPanel.hidden = !liveTicketSettingsOpen;
  openTicketSettings?.setAttribute('aria-expanded', String(liveTicketSettingsOpen));
}

function applyLiveWorkspaceView(view) {
  liveWorkspaceView = view === 'reservations' ? 'reservations' : 'page';
  if (liveWorkspaceView !== 'page') liveTicketSettingsOpen = false;
  syncLiveWorkspaceTabs();
  syncTicketSettingsPanel();
  return true;
}

function applyLiveListView(view) {
  liveListView = view === 'past' ? 'past' : 'upcoming';
  syncLiveListTabs();
  return true;
}

function applyTicketSettingsOpen(open) {
  liveTicketSettingsOpen = Boolean(open);
  if (liveTicketSettingsOpen) liveWorkspaceView = 'page';
  syncLiveWorkspaceTabs();
  syncTicketSettingsPanel();
  return true;
}

function setLiveWorkspaceView(view) {
  const target = view === 'reservations' ? 'reservations' : 'page';
  if (target === liveWorkspaceView) return applyLiveWorkspaceView(target);
  return requestLiveEditorTransition(() => {
    if (currentEditType?.startsWith('live')) closeLiveEditorImmediately();
    return applyLiveWorkspaceView(target);
  });
}

function setLiveListView(view) {
  const target = view === 'past' ? 'past' : 'upcoming';
  if (target === liveListView) return applyLiveListView(target);
  return requestLiveEditorTransition(() => {
    if (currentEditType?.startsWith('live')) closeLiveEditorImmediately();
    return applyLiveListView(target);
  });
}

function setTicketSettingsOpen(open) {
  const target = Boolean(open);
  if (target === liveTicketSettingsOpen) return applyTicketSettingsOpen(target);
  return requestLiveEditorTransition(() => {
    if (target && currentEditType?.startsWith('live')) closeLiveEditorImmediately();
    return applyTicketSettingsOpen(target);
  });
}

function bindLiveTablist(tabs, dataKey, setView) {
  tabs.forEach((tab, index) => {
    if (tab.dataset.liveTablistBound === 'true') return;
    tab.dataset.liveTablistBound = 'true';
    tab.addEventListener('click', () => setView(tab.dataset[dataKey]));
    tab.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      const nextTab = tabs[nextIndex];
      if (setView(nextTab.dataset[dataKey]) !== false) nextTab.focus();
    });
  });
}

function setupLiveWorkspace() {
  const workspaceTabs = Array.from(document.querySelectorAll('[data-live-workspace-view]'));
  const listTabs = Array.from(document.querySelectorAll('[data-live-list-view]'));
  bindLiveTablist(workspaceTabs, 'liveWorkspaceView', setLiveWorkspaceView);
  bindLiveTablist(listTabs, 'liveListView', setLiveListView);

  const openTicketSettings = document.getElementById('live-ticket-settings-open');
  const closeTicketSettings = document.getElementById('live-ticket-settings-close');
  if (openTicketSettings && openTicketSettings.dataset.liveSettingsBound !== 'true') {
    openTicketSettings.dataset.liveSettingsBound = 'true';
    openTicketSettings.addEventListener('click', () => {
      if (setTicketSettingsOpen(true) !== false) closeTicketSettings?.focus();
    });
  }
  if (closeTicketSettings && closeTicketSettings.dataset.liveSettingsBound !== 'true') {
    closeTicketSettings.dataset.liveSettingsBound = 'true';
    closeTicketSettings.addEventListener('click', () => {
      if (setTicketSettingsOpen(false) !== false) openTicketSettings?.focus();
    });
  }

  applyLiveWorkspaceView('page');
  applyLiveListView('upcoming');
  applyTicketSettingsOpen(false);
}

// 全描画
function renderAll() {
  renderSiteSettings();
  renderTicketSettings();
  renderNews();
  renderLive();
  renderTicketsUi();
  renderYouTube();
  renderDiscography();
  renderProfile();
}

function renderSiteSettings() {
  const heroForm = document.getElementById('site-hero-image-form');
  if (heroForm) {
    heroForm.innerHTML = getImageFormHtml(siteData.site.heroImage || '', 'site-hero-image');
    const previewContainer = document.getElementById('site-hero-image-preview-container');
    if (previewContainer) {
      previewContainer.onclick = () => document.getElementById('site-hero-image-file')?.click();
    }
  }

  const bandcamp = document.getElementById('site-link-bandcamp');
  const youtube = document.getElementById('site-link-youtube');
  const x = document.getElementById('site-link-x');
  const instagram = document.getElementById('site-link-instagram');
  const note = document.getElementById('site-link-note');
  const footer = document.getElementById('site-footer-text');
  const contactIntro = document.getElementById('contact-intro-text');
  const contactAction = document.getElementById('contact-form-action');

  if (bandcamp) {
    bandcamp.value = siteData.site.links.bandcamp || '';
    bandcamp.onchange = () => {
      siteData.site.links.bandcamp = bandcamp.value;
      markChanged();
    };
  }
  if (youtube) {
    youtube.value = siteData.site.links.youtube || '';
    youtube.onchange = () => {
      siteData.site.links.youtube = youtube.value;
      markChanged();
    };
  }
  if (x) {
    x.value = siteData.site.links.x || '';
    x.onchange = () => {
      siteData.site.links.x = x.value;
      markChanged();
    };
  }
  if (instagram) {
    instagram.value = siteData.site.links.instagram || '';
    instagram.onchange = () => {
      siteData.site.links.instagram = instagram.value;
      markChanged();
    };
  }
  if (note) {
    note.value = siteData.site.links.note || '';
    note.onchange = () => {
      siteData.site.links.note = note.value;
      markChanged();
    };
  }
  if (footer) {
    footer.value = siteData.site.footerText || '';
    footer.onchange = () => {
      siteData.site.footerText = footer.value;
      markChanged();
    };
  }

  if (contactIntro) {
    contactIntro.value = siteData.contact.introText || '';
    contactIntro.onchange = () => {
      siteData.contact.introText = contactIntro.value;
      markChanged();
    };
  }
  if (contactAction) {
    contactAction.value = siteData.contact.formAction || '';
    contactAction.onchange = () => {
      siteData.contact.formAction = contactAction.value;
      markChanged();
    };
  }
}

function renderTicketSettings() {
  const intro = document.getElementById('ticket-intro-text');
  const notice = document.getElementById('ticket-notice-text');
  const complete = document.getElementById('ticket-complete-text');
  const showQuantity = document.getElementById('ticket-field-quantity');
  const showMessage = document.getElementById('ticket-field-message');
  const labelQuantity = document.getElementById('ticket-field-label-quantity');
  const labelMessage = document.getElementById('ticket-field-label-message');
  const placeholderMessage = document.getElementById('ticket-field-placeholder-message');
  const submitLabel = document.getElementById('ticket-field-submit-label');

  if (intro) {
    intro.value = siteData.ticket.introText || '';
    intro.onchange = () => {
      siteData.ticket.introText = intro.value;
      markChanged();
    };
  }
  if (notice) {
    notice.value = siteData.ticket.noticeText || '';
    notice.onchange = () => {
      siteData.ticket.noticeText = notice.value;
      markChanged();
    };
  }
  if (complete) {
    complete.value = siteData.ticket.completeText || '';
    complete.onchange = () => {
      siteData.ticket.completeText = complete.value;
      markChanged();
    };
  }

  if (showQuantity) {
    showQuantity.checked = Boolean(siteData.ticket.fields.showQuantity);
    showQuantity.onchange = () => {
      siteData.ticket.fields.showQuantity = Boolean(showQuantity.checked);
      markChanged();
    };
  }
  if (showMessage) {
    showMessage.checked = Boolean(siteData.ticket.fields.showMessage);
    showMessage.onchange = () => {
      siteData.ticket.fields.showMessage = Boolean(showMessage.checked);
      markChanged();
    };
  }
  if (labelQuantity) {
    labelQuantity.value = siteData.ticket.fields.labelQuantity || '';
    labelQuantity.onchange = () => {
      siteData.ticket.fields.labelQuantity = labelQuantity.value;
      markChanged();
    };
  }
  if (labelMessage) {
    labelMessage.value = siteData.ticket.fields.labelMessage || '';
    labelMessage.onchange = () => {
      siteData.ticket.fields.labelMessage = labelMessage.value;
      markChanged();
    };
  }
  if (placeholderMessage) {
    placeholderMessage.value = siteData.ticket.fields.placeholderMessage || '';
    placeholderMessage.onchange = () => {
      siteData.ticket.fields.placeholderMessage = placeholderMessage.value;
      markChanged();
    };
  }
  if (submitLabel) {
    submitLabel.value = siteData.ticket.fields.submitLabel || '';
    submitLabel.onchange = () => {
      siteData.ticket.fields.submitLabel = submitLabel.value;
      markChanged();
    };
  }
}

function getYouTubeVideoId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  // Accept raw id (11 chars), watch URL, share URL, or embed URL.
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith('youtu.be')) {
      const id = url.pathname.replace(/^\/+/, '').slice(0, 64);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch (_e) {}
  return '';
}

function getYouTubeThumbUrl(id) {
  const safe = String(id || '').trim();
  if (!safe) return '';
  return `https://img.youtube.com/vi/${encodeURIComponent(safe)}/hqdefault.jpg`;
}

function renderYouTubeList(listEl, items, category) {
  if (!listEl) return;
  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>アイテムがありません</p></div>';
    return;
  }
  listEl.innerHTML = items.map(item => {
    const vid = item.youtubeId || '';
    const thumb = getYouTubeThumbUrl(vid);
    const title = item.title || vid || '(no title)';
    const meta = vid ? `ID: ${vid}` : '';
    return `
      <div class="item-card" onclick="editYouTubeVideo('${escapeHtml(item.id)}', '${escapeHtml(category)}')">
        ${thumb ? `<img class="thumbnail" src="${escapeHtml(thumb)}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="info">
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">${escapeHtml(meta)}</div>
        </div>
        <span class="arrow">›</span>
      </div>
    `;
  }).join('');
}

function renderYouTube() {
  const channelInput = document.getElementById('youtube-channel-url');
  if (channelInput) {
    channelInput.value = siteData.youtube.channelUrl || '';
    channelInput.onchange = () => {
      siteData.youtube.channelUrl = channelInput.value;
      markChanged();
    };
  }

  renderYouTubeList(
    document.getElementById('youtube-musicVideos-list'),
    siteData.youtube.musicVideos,
    'musicVideos'
  );
  renderYouTubeList(
    document.getElementById('youtube-liveMovies-list'),
    siteData.youtube.liveMovies,
    'liveMovies'
  );
  renderYouTubeList(
    document.getElementById('youtube-demos-list'),
    siteData.youtube.demos,
    'demos'
  );
}

function renderTicketsUi() {
  const liveSelect = document.getElementById('tickets-live-filter');
  if (!liveSelect) return;
  const currentValue = liveSelect.value || '';
  const options = [
    { value: '', label: '全ライブ' },
    ...((siteData?.live?.upcoming || []).map(l => ({ value: l.id, label: `${getAdminLiveDisplayDate(l.date)} ${l.venue || ''}`.trim() }))),
    ...((siteData?.live?.past || []).map(l => ({ value: l.id, label: `${getAdminLiveDisplayDate(l.date)} ${l.venue || ''}`.trim() }))),
  ];
  const nextValue = options.some((option) => option.value === currentValue) ? currentValue : '';
  liveSelect.innerHTML = options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
  liveSelect.value = nextValue;
  if (nextValue !== currentValue) void loadTickets();
}

function getAdminLiveDisplayDate(value) {
  return getLiveOperations()?.formatLiveDate(value) || String(value || '').trim();
}

// サムネイル画像のsrc取得（新規画像対応）
function getImageSrc(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  // pendingImagesに存在すればBase64を返す
  const filename = imagePath.split('/').pop();
  if (pendingImages[filename]) {
    return pendingImages[filename];
  }
  // 既存画像
  return `../${imagePath}`;
}

function renderLiveItem(item, category, options = {}) {
  const isSelected = currentEditType === `live-${category}` && String(currentEditId || '') === String(item.id || '');
  return `
    <button type="button" class="item-card live-edit-trigger ${category === 'past' ? 'past' : ''}${isSelected ? ' is-selected' : ''}" data-live-edit data-live-id="${escapeHtml(String(item.id || ''))}" data-live-category="${category}" aria-current="${isSelected ? 'true' : 'false'}">
      <img class="thumbnail" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
      <span class="info">
        ${options.isNext ? '<span class="next-live-badge" aria-label="Next Live">Next Live</span>' : ''}
        <span class="title">${escapeHtml((item.title || '').trim() || item.venue)}</span>
        <span class="meta">${escapeHtml([getAdminLiveDisplayDate(item.date), (item.title || '').trim() ? item.venue : ''].filter(Boolean).join(' '))}</span>
      </span>
      <span class="arrow">›</span>
    </button>
  `;
}

function syncLiveSelectionState() {
  document.querySelectorAll('[data-live-edit]').forEach((trigger) => {
    const isSelected = (
      currentEditType === `live-${String(trigger.dataset?.liveCategory || '')}`
      && String(currentEditId || '') === String(trigger.dataset?.liveId || '')
    );
    trigger.classList[isSelected ? 'add' : 'remove']('is-selected');
    trigger.setAttribute('aria-current', String(isSelected));
  });
}

function handleLiveEditAction(event) {
  const trigger = event.target?.closest?.('[data-live-edit]');
  if (!trigger) return;
  const id = String(trigger.dataset?.liveId || '');
  const category = String(trigger.dataset?.liveCategory || '');
  if (!id || !['upcoming', 'past'].includes(category)) return;
  event.preventDefault?.();
  editLive(id, category);
}

// News描画
function renderNews() {
  const list = document.getElementById('news-list');
  if (siteData.news.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📰</div><p>ニュースがありません</p></div>';
    return;
  }

  list.innerHTML = siteData.news.map(item => `
    <div class="item-card" onclick="editNews('${item.id}')">
      <img class="thumbnail" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="meta">${escapeHtml(item.date)}</div>
      </div>
      <span class="arrow">›</span>
    </div>
  `).join('');
}

// Live描画
function renderLive() {
  const upcomingList = document.getElementById('live-upcoming-list');
  const pastList = document.getElementById('live-past-list');

  if (siteData.live.upcoming.length === 0) {
    upcomingList.innerHTML = '<div class="empty-state"><p>開催予定のライブはありません</p></div>';
  } else {
    upcomingList.innerHTML = siteData.live.upcoming.map((item, index) => renderLiveItem(item, 'upcoming', { isNext: index === 0 })).join('');
  }

  if (siteData.live.past.length === 0) {
    pastList.innerHTML = '<div class="empty-state"><p>終了したライブはありません</p></div>';
  } else {
    pastList.innerHTML = siteData.live.past.map(item => renderLiveItem(item, 'past')).join('');
  }

  syncLiveSelectionState();
}

// Discography描画
function renderDiscography() {
  const digitalList = document.getElementById('disc-digital-list');
  const demoList = document.getElementById('disc-demo-list');

  if (siteData.discography.digital.length === 0) {
    digitalList.innerHTML = '<div class="empty-state"><p>リリースはありません</p></div>';
  } else {
    digitalList.innerHTML = siteData.discography.digital.map(item => `
      <div class="item-card" onclick="editDiscography('${item.id}', 'digital')">
        <img class="thumbnail" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
        <div class="info">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="meta">${escapeHtml(item.releaseDate)}</div>
        </div>
        <span class="arrow">›</span>
      </div>
    `).join('');
  }

  if (siteData.discography.demo.length === 0) {
    demoList.innerHTML = '<div class="empty-state"><p>デモはありません</p></div>';
  } else {
    demoList.innerHTML = siteData.discography.demo.map(item => `
      <div class="item-card" onclick="editDiscography('${item.id}', 'demo')">
        <img class="thumbnail" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
        <div class="info">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="meta">${escapeHtml(item.releaseDate)}</div>
        </div>
        <span class="arrow">›</span>
      </div>
    `).join('');
  }
}

// Profile描画
function renderProfile() {
  const profileImageForm = document.getElementById('profile-image-form');
  const profileText = document.getElementById('profile-text');
  if (profileImageForm) {
    profileImageForm.innerHTML = getImageFormHtml(siteData.profile.image || '', 'profile-image');
    const previewContainer = document.getElementById('profile-image-preview-container');
    if (previewContainer) {
      previewContainer.onclick = () => document.getElementById('profile-image-file')?.click();
    }
  }
  profileText.value = siteData.profile.text || '';

  profileText.onchange = () => {
    siteData.profile.text = profileText.value;
    markChanged();
  };

  renderProfileLinks();
}

// プロフィールリンク描画
function renderProfileLinks() {
  const list = document.getElementById('profile-links-list');
  if (!siteData.profile.links || siteData.profile.links.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>リンクがありません</p></div>';
    return;
  }

  list.innerHTML = siteData.profile.links.map((link, index) => `
    <div class="link-item">
      <input type="text" placeholder="名前" value="${escapeHtml(link.name)}"
        onchange="updateProfileLink(${index}, 'name', this.value)">
      <input type="url" placeholder="URL" value="${escapeHtml(link.url)}"
        onchange="updateProfileLink(${index}, 'url', this.value)">
      <button class="delete-link-btn" onclick="deleteProfileLink(${index})">×</button>
    </div>
  `).join('');
}

// プロフィールリンク更新
function updateProfileLink(index, field, value) {
  siteData.profile.links[index][field] = value;
  markChanged();
}

// プロフィールリンク追加
function addProfileLink() {
  if (!siteData.profile.links) siteData.profile.links = [];
  siteData.profile.links.push({ name: '', url: '' });
  renderProfileLinks();
  markChanged();
}

function addYouTubeVideo(category) {
  isNewItem = true;
  currentEditType = `youtube-${category}`;
  currentEditId = 'yt-' + Date.now();

  showModal('YouTube追加', `
    <div class="form-group">
      <label>カテゴリ</label>
      <select id="edit-category" class="select">
        <option value="musicVideos" ${category === 'musicVideos' ? 'selected' : ''}>Music Video</option>
        <option value="liveMovies" ${category === 'liveMovies' ? 'selected' : ''}>Live Movie</option>
        <option value="demos" ${category === 'demos' ? 'selected' : ''}>Demo</option>
      </select>
    </div>
    <div class="form-group">
      <label>タイトル</label>
      <input type="text" id="edit-title" class="text-input" placeholder="例: - 月を待って -">
    </div>
    <div class="form-group">
      <label>YouTube URL / ID</label>
      <input type="text" id="edit-youtube" class="text-input" placeholder="https://youtu.be/... または 11文字のID">
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'none';
}

function editYouTubeVideo(id, category) {
  const list = siteData.youtube[category] || [];
  const item = list.find(v => v.id === id);
  if (!item) return;

  isNewItem = false;
  currentEditType = `youtube-${category}`;
  currentEditId = id;

  showModal('YouTube編集', `
    <div class="form-group">
      <label>カテゴリ</label>
      <select id="edit-category" class="select">
        <option value="musicVideos" ${category === 'musicVideos' ? 'selected' : ''}>Music Video</option>
        <option value="liveMovies" ${category === 'liveMovies' ? 'selected' : ''}>Live Movie</option>
        <option value="demos" ${category === 'demos' ? 'selected' : ''}>Demo</option>
      </select>
    </div>
    <div class="form-group">
      <label>タイトル</label>
      <input type="text" id="edit-title" class="text-input" value="${escapeHtml(item.title || '')}">
    </div>
    <div class="form-group">
      <label>YouTube URL / ID</label>
      <input type="text" id="edit-youtube" class="text-input" value="${escapeHtml(item.youtubeId || '')}">
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'block';
}

// プロフィールリンク削除
function deleteProfileLink(index) {
  siteData.profile.links.splice(index, 1);
  renderProfileLinks();
  markChanged();
}

const LIVE_FLYER_IMAGE_OPTIONS = {
  downloadablePreview: true,
  showPath: false,
};

function getImageDownloadFilename(imagePath) {
  const cleaned = String(imagePath || '').split('#')[0].split('?')[0];
  return cleaned.split('/').filter(Boolean).pop() || 'image';
}

function getImagePreviewHtml(inputId, previewSrc, options = {}) {
  if (!previewSrc) {
    return `<div class="image-placeholder" id="${inputId}-placeholder">タップして画像を選択</div>`;
  }

  const imageHtml = `<img class="image-preview-large" id="${inputId}-preview" src="${escapeHtml(previewSrc)}" alt="">`;
  if (!options.downloadablePreview) return imageHtml;

  const downloadName = options.downloadName || getImageDownloadFilename(options.imagePath || previewSrc);
  const href = options.href || previewSrc;
  return `<a class="image-download-link" href="${escapeHtml(href)}" download="${escapeHtml(downloadName)}" aria-label="画像を保存">${imageHtml}</a>`;
}

function renderImagePreview(inputId, previewSrc, options = {}, targetContainer = null) {
  const container = targetContainer || document.getElementById(`${inputId}-preview-container`);
  if (!container) return;

  const downloadablePreview = container.dataset?.downloadablePreview === 'true';
  container.innerHTML = getImagePreviewHtml(inputId, previewSrc, {
    ...options,
    downloadablePreview,
  });
}

// 画像選択フォームHTML生成
function getImageFormHtml(currentImage, inputId = 'edit-image', options = {}) {
  const previewSrc = currentImage ? getImageSrc(currentImage) : '';
  const showPath = options.showPath !== false;
  const downloadablePreview = options.downloadablePreview === true;
  const previewHtml = getImagePreviewHtml(inputId, previewSrc, {
    downloadablePreview,
    imagePath: currentImage,
  });
  const pathHtml = showPath
    ? `<p class="image-path-display" id="${inputId}-path">${currentImage ? `パス: ${escapeHtml(currentImage)}` : ''}</p>`
    : '';

  return `
    <div class="form-group">
      <label>画像</label>
      <div class="image-upload-area" id="image-upload-area">
        <input type="file" id="${inputId}-file" accept="image/*" onchange="handleImageSelect(this, '${inputId}')" style="display:none">
        <input type="hidden" id="${inputId}" value="${escapeHtml(currentImage || '')}">
        <div class="image-preview-container" id="${inputId}-preview-container" data-downloadable-preview="${downloadablePreview ? 'true' : 'false'}">
          ${previewHtml}
        </div>
        <div class="image-actions">
          <button type="button" class="btn-image-select" onclick="document.getElementById('${inputId}-file').click()">画像を選択</button>
          ${currentImage ? `<button type="button" class="btn-image-clear" onclick="clearImage('${inputId}')">削除</button>` : ''}
        </div>
        ${pathHtml}
      </div>
    </div>
  `;
}

// 画像選択処理
function handleImageSelect(input, inputId) {
  const file = input.files[0];
  if (!file) return;

  const inputElement = document.getElementById(inputId);
  const container = document.getElementById(`${inputId}-preview-container`);
  const pathEl = document.getElementById(`${inputId}-path`);
  if (!inputElement || !container) return;

  const editorScoped = inputId === 'edit-image';
  const ownerUsesLiveEditor = currentEditType?.startsWith('live');
  const ownerGeneration = ownerUsesLiveEditor ? liveEditorGeneration : modalGeneration;
  const ownerEditId = currentEditId;
  const ownerEditType = currentEditType;
  const apiUploadToken = IS_API_MODE ? `image-upload-${++imageUploadSequence}` : '';
  const ownsCurrentInput = () => (
    document.getElementById(inputId) === inputElement
    && document.getElementById(`${inputId}-preview-container`) === container
    && (!editorScoped || (
      (ownerUsesLiveEditor ? liveEditorGeneration : modalGeneration) === ownerGeneration
      && currentEditId === ownerEditId
      && currentEditType === ownerEditType
    ))
  );

  if (apiUploadToken) {
    activeImageUploads.add(apiUploadToken);
    latestImageUploadByInput.set(inputElement, apiUploadToken);
  }
  if (pathEl) pathEl.textContent = IS_API_MODE ? 'アップロード中...' : '';

  // FileReaderでBase64に変換
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const isLatestUpload = () => !apiUploadToken || latestImageUploadByInput.get(inputElement) === apiUploadToken;

    if (!ownsCurrentInput() || !isLatestUpload()) {
      if (apiUploadToken) activeImageUploads.delete(apiUploadToken);
      return;
    }

    // プレビュー更新
    renderImagePreview(inputId, base64, {
      href: base64,
      downloadName: file.name || 'image',
    }, container);

    if (!apiUploadToken) {
      // ローカルJSON運用: ファイル名を生成（日付＋元のファイル名）
      const ext = file.name.split('.').pop().toLowerCase();
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `${baseName}_${timestamp}.${ext}`;
      const imagePath = `assets/images/${filename}`;

      // pendingImagesに保存（ダウンロード用）
      pendingImages[filename] = base64;

      // hiddenフィールドにパスを設定
      inputElement.value = imagePath;
      if (pathEl) pathEl.textContent = `パス: ${imagePath}`;

      setImagePathForInputId(inputId, imagePath);

      if (ownerUsesLiveEditor) markLiveEditorDirty();
      else markChanged();
      return;
    }

    // API運用: Cloudflare(R2)へアップロードしてURLを保存
    uploadImageToApi(file)
      .then((result) => {
        if (!ownsCurrentInput() || !isLatestUpload()) return;
        inputElement.value = result.url;
        if (pathEl) pathEl.textContent = `URL: ${result.url}`;
        renderImagePreview(inputId, base64, {
          href: result.url,
          imagePath: result.url,
        }, container);
        setImagePathForInputId(inputId, result.url);
        if (ownerUsesLiveEditor) markLiveEditorDirty();
        else markChanged();
      })
      .catch((err) => {
        if (!ownsCurrentInput() || !isLatestUpload()) return;
        if (pathEl) pathEl.textContent = '';
        showToast(`画像アップロード失敗: ${err.message}`, 'error');
      })
      .finally(() => {
        activeImageUploads.delete(apiUploadToken);
        if (latestImageUploadByInput.get(inputElement) === apiUploadToken) {
          latestImageUploadByInput.delete(inputElement);
        }
      });

    // クリアボタンを追加（なければ）
    const actionsDiv = container.parentElement.querySelector('.image-actions');
    if (!actionsDiv.querySelector('.btn-image-clear')) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn-image-clear';
      clearBtn.textContent = '削除';
      clearBtn.onclick = () => clearImage(inputId);
      actionsDiv.appendChild(clearBtn);
    }
  };
  reader.onerror = function() {
    if (apiUploadToken) {
      activeImageUploads.delete(apiUploadToken);
      if (latestImageUploadByInput.get(inputElement) === apiUploadToken) {
        latestImageUploadByInput.delete(inputElement);
      }
    }
    if (ownsCurrentInput()) showToast('画像を読み込めませんでした', 'error');
  };
  try {
    reader.readAsDataURL(file);
  } catch (error) {
    reader.onerror();
  }
}

async function uploadImageToApi(file) {
  if (!IS_API_MODE) throw new Error('APIモードではありません');
  const form = new FormData();
  form.append('file', file, file.name || 'image');
  const response = await adminFetch('/api/admin/upload-image', {
    method: 'POST',
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, '画像アップロードに失敗しました'));
  }
  if (!payload.url) throw new Error('画像URLが取得できませんでした');
  return payload;
}

// 画像クリア
function clearImage(inputId) {
  document.getElementById(inputId).value = '';
  const container = document.getElementById(`${inputId}-preview-container`);
  container.innerHTML = `<div class="image-placeholder" id="${inputId}-placeholder">タップして画像を選択</div>`;
  const pathEl = document.getElementById(`${inputId}-path`);
  if (pathEl) pathEl.textContent = '';

  // クリアボタンを削除
  const clearBtn = container.parentElement.querySelector('.btn-image-clear');
  if (clearBtn) clearBtn.remove();

  setImagePathForInputId(inputId, '');
  if (inputId === 'edit-image' && currentEditType?.startsWith('live')) {
    markLiveEditorDirty();
  } else if (inputId === 'profile-image' || inputId === 'site-hero-image') {
    markChanged();
  }
}

// News追加
function addNews() {
  isNewItem = true;
  currentEditType = 'news';
  currentEditId = 'news-' + Date.now();

  showModal('新規News', `
    <div class="form-group">
      <label>日付</label>
      <input type="text" id="edit-date" class="text-input" placeholder="2025/1/1(Mon.)">
    </div>
    <div class="form-group">
      <label>タイトル</label>
      <input type="text" id="edit-title" class="text-input" placeholder="ニュースタイトル">
    </div>
    <div class="form-group">
      <label>説明</label>
      <textarea id="edit-description" class="textarea" rows="3" placeholder="詳細説明"></textarea>
    </div>
    ${getImageFormHtml('')}
    <div class="form-group">
      <label>詳細リンクURL（instagramなど/任意）</label>
      <input type="url" id="edit-link" class="text-input" placeholder="https://...">
    </div>
    <div class="form-group">
      <label>リンクテキスト</label>
      <input type="text" id="edit-linkText" class="text-input" placeholder="view..." value="view...">
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'none';
}

// News編集
function editNews(id) {
  const item = siteData.news.find(n => n.id === id);
  if (!item) return;

  isNewItem = false;
  currentEditType = 'news';
  currentEditId = id;

  showModal('News編集', `
    <div class="form-group">
      <label>日付</label>
      <input type="text" id="edit-date" class="text-input" value="${escapeHtml(item.date)}">
    </div>
    <div class="form-group">
      <label>タイトル</label>
      <input type="text" id="edit-title" class="text-input" value="${escapeHtml(item.title)}">
    </div>
    <div class="form-group">
      <label>説明</label>
      <textarea id="edit-description" class="textarea" rows="3">${escapeHtml(item.description)}</textarea>
    </div>
    ${getImageFormHtml(item.image)}
    <div class="form-group">
      <label>リンクURL</label>
      <input type="url" id="edit-link" class="text-input" value="${escapeHtml(item.link)}">
    </div>
    <div class="form-group">
      <label>リンクテキスト</label>
      <input type="text" id="edit-linkText" class="text-input" value="${escapeHtml(item.linkText)}">
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'block';
}

function getLiveOperations() {
  return typeof window !== 'undefined' && window.LiveOperations ? window.LiveOperations : null;
}

function getEditorTicketUrl(item) {
  if (item && Object.prototype.hasOwnProperty.call(item, 'ticketUrl')) {
    return String(item.ticketUrl || '').trim();
  }
  return getLiveOperations()?.getTicketUrl(item) || '';
}

function readLiveDateFromEditor() {
  const dateElement = document.getElementById('edit-date');
  const inputValue = String(dateElement?.value || '').trim();
  return inputValue || String(dateElement?.dataset?.originalUnparsedDate || '');
}

function buildLiveEditorHtml(itemInput, category, isNew) {
  const item = itemInput && typeof itemInput === 'object' ? itemInput : {};
  const ticketUrl = getEditorTicketUrl(item);
  const operations = getLiveOperations();
  const normalizedDate = operations?.normalizeLiveDateInput(item.date) || '';
  const originalDate = String(item.date || '');
  const unparsedOriginalDate = originalDate.trim() && !normalizedDate ? originalDate : '';
  const normalizedPerformers = operations?.normalizeLivePerformers(item.performers) || String(item.performers || '').trim();
  const disabled = isNew ? ' disabled' : '';
  const saveFirstX = isNew ? '<p class="operation-gate">保存後にWeb Intentを利用できます。</p>' : '';
  const ledgerGate = isNew
    ? '<div class="empty-state operation-gate"><p>予約台帳はLiveを保存すると利用できます。</p></div>'
    : '<div class="empty-state"><p>予約台帳を読み込みます...</p></div>';
  const taskDisabled = isNew ? ' disabled aria-disabled="true"' : '';

  return `
    <div class="live-editor-task-tabs" role="tablist" aria-label="選択中Liveの操作">
      <button type="button" id="live-editor-task-public" class="live-editor-task-tab is-active" role="tab" data-live-editor-task="public" aria-controls="live-editor-panel-public" aria-selected="true" tabindex="0">公開内容</button>
      <button type="button" id="live-editor-task-announcement" class="live-editor-task-tab" role="tab" data-live-editor-task="announcement" aria-controls="live-editor-panel-announcement" aria-selected="false" tabindex="-1"${taskDisabled}>告知</button>
      <button type="button" id="live-editor-task-reservation" class="live-editor-task-tab" role="tab" data-live-editor-task="reservation" aria-controls="live-editor-panel-reservation" aria-selected="false" tabindex="-1"${taskDisabled}>予約</button>
    </div>

    <section id="live-editor-panel-public" class="live-editor-task-panel" role="tabpanel" data-live-editor-task-panel="public" aria-labelledby="live-editor-task-public">
      <details class="live-source-intake"${isNew ? ' open' : ''}>
        <summary>元情報から作成</summary>
        <div class="live-source-intake-body">
          <p class="live-workspace-eyebrow">管理専用</p>
          <div class="form-group">
            <label for="edit-sourceText">受け取った公演情報</label>
            <textarea id="edit-sourceText" class="textarea" rows="7" placeholder="主催者から届いたテキストをそのまま貼り付け">${escapeHtml(item.sourceText || '')}</textarea>
            <p class="field-hint">AIは下書き欄を埋めるだけです。保存や公開は行いません。</p>
          </div>
          <div class="live-source-actions">
            <button type="button" class="btn btn-secondary btn-compact" id="live-source-parse-btn">AIで下書きを作る</button>
            ${isNew ? '<button type="button" class="btn btn-secondary btn-compact" id="live-manual-entry-btn">手入力で作成</button>' : ''}
          </div>
          <div id="live-source-warnings" class="parse-warnings" aria-live="polite"></div>
        </div>
      </details>

      <div id="live-public-fields"${isNew ? ' hidden' : ''}>
        <p class="live-workspace-eyebrow">公開画面に表示</p>
        <section class="live-editor-section live-basic-fields">
          <div class="operation-heading"><h3>基本情報</h3></div>
          <div class="field-row">
            <div class="form-group">
              <label for="edit-date">日付</label>
              <input type="date" id="edit-date" class="text-input" value="${escapeHtml(normalizedDate)}" data-original-unparsed-date="${escapeHtml(unparsedOriginalDate)}" aria-describedby="edit-date-error">
              <p id="edit-date-error" class="form-error" role="alert"></p>
              ${unparsedOriginalDate ? `<p class="field-hint">現在の保存値: <code>${escapeHtml(unparsedOriginalDate)}</code>。有効な日付を入力するまではこの値を保持します。</p>` : ''}
            </div>
            <div class="form-group">
              <label for="edit-venue">会場</label>
              <input type="text" id="edit-venue" class="text-input" value="${escapeHtml(item.venue || '')}" placeholder="下北沢XXX" aria-describedby="edit-venue-error">
              <p id="edit-venue-error" class="form-error" role="alert"></p>
            </div>
          </div>
          <div class="form-group">
            <label for="edit-title">ライブ名（任意）</label>
            <input type="text" id="edit-title" class="text-input" value="${escapeHtml(item.title || '')}" placeholder="例: 〇〇企画 / 〇〇 presents...">
          </div>
        </section>

        <section class="live-editor-section">
          <div class="operation-heading"><h3>公演情報</h3></div>
          <div class="field-row live-time-fields">
            <div class="form-group">
              <label for="edit-openTime">Open</label>
              <input type="time" id="edit-openTime" class="text-input" value="${escapeHtml(item.openTime || '')}">
            </div>
            <div class="form-group">
              <label for="edit-startTime">Start</label>
              <input type="time" id="edit-startTime" class="text-input" value="${escapeHtml(item.startTime || '')}">
            </div>
          </div>
          <div class="form-group">
            <label for="edit-ticket">ticket</label>
            <input type="text" id="edit-ticket" class="text-input" value="${escapeHtml(item.ticket || '')}" placeholder="例: ¥2,500 + 1D">
          </div>
          <div class="form-group">
            <label for="edit-notes">補足</label>
            <textarea id="edit-notes" class="textarea" rows="3" placeholder="1補足1行（※は表示時に付きます）">${escapeHtml(item.notes || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-performers">共演者</label>
            <textarea id="edit-performers" class="textarea" rows="3" placeholder="1組1行、または / 区切り">${escapeHtml(normalizedPerformers)}</textarea>
          </div>
        </section>

        <details class="live-editor-details">
          <summary>画像・リンクなど</summary>
          <div class="live-editor-details-body">
            ${item.description ? `
            <details class="legacy-live-details">
              <summary>旧詳細（未構造化）</summary>
              <div class="form-group">
                <label for="edit-description">過去データ互換</label>
                <textarea id="edit-description" class="textarea" rows="4">${escapeHtml(item.description)}</textarea>
                <p class="field-hint">構造化項目が空のときだけ公開表示に使われます。</p>
              </div>
            </details>` : ''}
            ${getImageFormHtml(item.image || '', 'edit-image', LIVE_FLYER_IMAGE_OPTIONS)}
            <div class="form-group">
              <label for="edit-ticketUrl">予約先</label>
              <input type="url" id="edit-ticketUrl" class="text-input" value="${escapeHtml(ticketUrl)}" placeholder="https://...">
              <p class="field-hint">入力あり＝外部予約先、空欄なら1212HP内で予約します。</p>
            </div>
            <div class="form-group">
              <label for="edit-link">詳細・SNSリンク（予約先とは別）</label>
              <input type="url" id="edit-link" class="text-input" value="${escapeHtml(item.link || '')}" placeholder="Instagramや公演詳細など">
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="edit-reservationClosed" ${item.reservationClosed === true ? 'checked' : ''}>
              <label for="edit-reservationClosed">予約受付を終了</label>
            </div>
          </div>
        </details>
        <div class="checkbox-group live-category-field">
          <input type="checkbox" id="edit-isPast" ${category === 'past' ? 'checked' : ''}>
          <label for="edit-isPast">公演終了</label>
        </div>
        <p id="live-category-warning" class="form-warning" role="status"></p>
      </div>
    </section>

    <section id="live-editor-panel-announcement" class="live-editor-task-panel announcement-panel" role="tabpanel" data-live-editor-task-panel="announcement" aria-labelledby="live-editor-task-announcement" hidden>
      <div class="operation-heading"><h3>X告知を準備</h3></div>
      <p class="live-workspace-eyebrow">管理専用</p>
      <div class="form-group">
        <label for="edit-xComment">オーナーコメント</label>
        <textarea id="edit-xComment" class="textarea" rows="3" placeholder="このLiveへのひとこと">${escapeHtml(item.xComment || '')}</textarea>
      </div>
      <div class="form-group">
        <label for="x-post-preview">X投稿プレビュー</label>
        <textarea id="x-post-preview" class="textarea preview-text" rows="12" readonly></textarea>
      </div>
      ${saveFirstX}
      <div class="field-row">
        <button type="button" class="btn btn-secondary btn-compact" id="x-intent-btn"${disabled}>X Web Intentを開く</button>
        <button type="button" class="btn btn-secondary btn-compact" id="x-post-copy-btn">投稿文をコピー</button>
      </div>
    </section>

    <section id="live-editor-panel-reservation" class="live-editor-task-panel reservation-panel" role="tabpanel" data-live-editor-task-panel="reservation" aria-labelledby="live-editor-task-reservation" hidden>
      <div class="operation-heading"><h3>予約台帳</h3></div>
      <div id="live-reservation-ledger" aria-live="polite">${ledgerGate}</div>
      <form id="manual-reservation-form" class="manual-reservation-form">
        <h4>手動取り置きを追加</h4>
        <div class="form-group">
          <label for="manual-reservation-name">お名前</label>
          <input type="text" id="manual-reservation-name" class="text-input" required maxlength="200"${disabled}>
        </div>
        <div class="field-row manual-fields">
          <div class="form-group quantity-field">
            <label for="manual-reservation-quantity">枚数</label>
            <input type="number" id="manual-reservation-quantity" class="text-input" value="1" min="1" max="10" step="1" required${disabled}>
          </div>
          <div class="form-group">
            <label for="manual-reservation-contact">連絡先（任意）</label>
            <input type="text" id="manual-reservation-contact" class="text-input" maxlength="200"${disabled}>
          </div>
        </div>
        <div class="form-group">
          <label for="manual-reservation-note">内部メモ（任意）</label>
          <textarea id="manual-reservation-note" class="textarea" rows="3" maxlength="2000"${disabled}></textarea>
        </div>
        <div id="manual-reservation-error" class="form-error" role="alert"></div>
        <button type="submit" class="btn btn-secondary btn-compact" id="manual-reservation-submit"${disabled}>手動取り置きを追加</button>
      </form>
    </section>

    <footer class="live-editor-footer">
      <button type="button" class="btn btn-danger" id="live-editor-delete-btn" onclick="deleteLiveFromWorkspace()"${isNew ? ' hidden' : ''}>削除</button>
      <button type="button" class="btn btn-primary live-primary-action" id="live-editor-save-btn" onclick="saveLiveWorkspace()">保存して公開</button>
    </footer>
  `;
}

function setLiveEditorTask(task, options = {}) {
  const tabs = Array.from(document.querySelectorAll('[data-live-editor-task]'));
  const enabledTabs = tabs.filter((tab) => !tab.disabled);
  const requested = enabledTabs.find((tab) => tab.dataset.liveEditorTask === task);
  const selectedTask = requested?.dataset.liveEditorTask || 'public';

  tabs.forEach((tab) => {
    const isSelected = tab.dataset.liveEditorTask === selectedTask;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.setAttribute('tabindex', isSelected ? '0' : '-1');
    tab.classList[isSelected ? 'add' : 'remove']('is-active');
  });
  document.querySelectorAll('[data-live-editor-task-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.liveEditorTaskPanel !== selectedTask;
  });

  if (options.focus === true) {
    tabs.find((tab) => tab.dataset.liveEditorTask === selectedTask)?.focus?.();
  }
  return selectedTask;
}

function bindLiveEditorTaskTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-live-editor-task]'));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!tab.disabled) setLiveEditorTask(tab.dataset.liveEditorTask);
    });
    tab.addEventListener('keydown', (event) => {
      const enabledTabs = tabs.filter((candidate) => !candidate.disabled);
      const currentIndex = enabledTabs.indexOf(tab);
      if (currentIndex < 0) return;
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabledTabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = enabledTabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      setLiveEditorTask(enabledTabs[nextIndex].dataset.liveEditorTask, { focus: true });
    });
  });
}

function revealNewLivePublicFields() {
  const fields = document.getElementById('live-public-fields');
  if (!fields) return;
  fields.hidden = false;
  document.getElementById('edit-date')?.focus?.();
}

function getTodayDateInputValue(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLiveCategoryWarning() {
  const normalizedDate = getLiveOperations()?.normalizeLiveDateInput(readLiveDateFromEditor()) || '';
  if (!normalizedDate) return '';
  const isPast = Boolean(document.getElementById('edit-isPast')?.checked);
  const today = getTodayDateInputValue();
  if (!isPast && normalizedDate < today) {
    return '開催予定ですが、過去の日付です。区分は自動変更しません。';
  }
  if (isPast && normalizedDate >= today) {
    return '公演終了ですが、今日以降の日付です。区分は自動変更しません。';
  }
  return '';
}

function updateLiveCategoryWarning() {
  const target = document.getElementById('live-category-warning');
  if (target) target.textContent = getLiveCategoryWarning();
}

function validateLiveEditor() {
  revealNewLivePublicFields();
  const date = document.getElementById('edit-date');
  const venue = document.getElementById('edit-venue');
  const dateError = document.getElementById('edit-date-error');
  const venueError = document.getElementById('edit-venue-error');
  const dateMissing = !String(readLiveDateFromEditor() || '').trim();
  const venueMissing = !String(venue?.value || '').trim();

  date?.setAttribute('aria-invalid', String(dateMissing));
  venue?.setAttribute('aria-invalid', String(venueMissing));
  if (dateError) dateError.textContent = dateMissing ? '日付を入力してください。' : '';
  if (venueError) venueError.textContent = venueMissing ? '会場を入力してください。' : '';
  updateLiveCategoryWarning();

  if (dateMissing) date?.focus?.();
  else if (venueMissing) venue?.focus?.();
  return !dateMissing && !venueMissing;
}

function getLiveEditorRoot() {
  return document.getElementById('live-editor-body');
}

function getLiveEditorEmptyHtml() {
  return '<div class="empty-state live-editor-empty"><p>一覧からLiveを選択するか、新規Liveを追加してください。</p></div>';
}

function getLiveEditorHeading(item, isNew = false) {
  if (isNew) return '新規Live';
  const date = getAdminLiveDisplayDate(item?.date);
  const venue = String(item?.venue || '').trim();
  const title = String(item?.title || '').trim();
  const schedule = [date, venue].filter(Boolean).join(' ');
  return [schedule, title].filter(Boolean).join(' — ') || 'Live編集';
}

function setLiveEditorSaveStatus(status) {
  const target = document.getElementById('live-editor-save-status');
  if (target) target.textContent = String(status || '');
}

function setLiveEditorDirty(dirty, status = '') {
  liveEditorDirty = Boolean(dirty);
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = liveEditorDirty;
    saveBtn.title = liveEditorDirty ? 'Liveは編集画面の「保存して公開」から保存してください' : '';
  }
  setLiveEditorSaveStatus(status || (liveEditorDirty ? '未保存' : '保存済み'));
}

function markLiveEditorDirty() {
  if (!currentEditType?.startsWith('live') || !getLiveEditorRoot()) return;
  setLiveEditorDirty(true);
}

function bindLiveEditorDirtyState() {
  [
    'edit-sourceText',
    'edit-date',
    'edit-title',
    'edit-venue',
    'edit-openTime',
    'edit-startTime',
    'edit-ticket',
    'edit-notes',
    'edit-performers',
    'edit-description',
    'edit-ticketUrl',
    'edit-link',
    'edit-reservationClosed',
    'edit-isPast',
    'edit-xComment',
  ].forEach((id) => {
    const element = document.getElementById(id);
    element?.addEventListener('input', markLiveEditorDirty);
    element?.addEventListener('change', markLiveEditorDirty);
  });
}

function findLiveEditTrigger(id, category) {
  return Array.from(document.querySelectorAll('[data-live-edit]')).find((trigger) => (
    String(trigger.dataset?.liveId || '') === String(id || '')
    && String(trigger.dataset?.liveCategory || '') === String(category || '')
  )) || null;
}

function openLiveEditor(item, category, isNew) {
  const root = getLiveEditorRoot();
  if (!root) return false;
  const activeElement = document.activeElement;
  const activeLiveId = String(activeElement?.dataset?.liveId || '');
  const activeLiveCategory = String(activeElement?.dataset?.liveCategory || '');
  if (activeLiveId && ['upcoming', 'past'].includes(activeLiveCategory)) {
    liveEditorReturnFocus = activeElement;
    liveEditorReturnFocusLive = { id: activeLiveId, category: activeLiveCategory };
  } else if (isNew) {
    liveEditorReturnFocus = activeElement;
    liveEditorReturnFocusLive = null;
  }

  liveEditorGeneration += 1;
  applyLiveWorkspaceView('page');
  applyTicketSettingsOpen(false);
  applyLiveListView(category);
  root.innerHTML = buildLiveEditorHtml(item, category, isNew);
  document.getElementById('live-master-detail')?.classList.add('has-live-selection');
  const back = document.getElementById('live-editor-back');
  if (back) back.hidden = false;
  const heading = document.getElementById('live-editor-heading');
  if (heading) heading.textContent = getLiveEditorHeading(item, isNew);
  const context = document.getElementById('live-editor-context');
  if (context) context.textContent = `選択中Live・${category === 'past' ? '公演終了' : '開催予定'}`;
  syncLiveSelectionState();
  wireLiveOperationsModal();
  bindLiveEditorDirtyState();
  updateLiveCategoryWarning();
  setLiveEditorDirty(isNew, isNew ? '未保存' : '保存済み');
  applyApiFallbackReadOnlyState();
  const initialFocus = document.getElementById(isNew ? 'edit-sourceText' : 'edit-date') || root.querySelector(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
  );
  initialFocus?.focus?.();
  return true;
}

// Live追加
function addLive() {
  return requestLiveEditorTransition(() => {
    isNewItem = true;
    currentEditType = 'live-upcoming';
    currentEditId = 'live-' + Date.now();
    return openLiveEditor({}, 'upcoming', true);
  });
}

// Live編集
function editLive(id, category) {
  const list = category === 'upcoming' ? siteData.live.upcoming : siteData.live.past;
  const item = list.find(l => l.id === id);
  if (!item) return false;
  if (currentEditType === `live-${category}` && String(currentEditId) === String(id)) return true;

  return requestLiveEditorTransition(() => {
    isNewItem = false;
    currentEditType = `live-${category}`;
    currentEditId = id;
    return openLiveEditor(item, category, false);
  });
}

function closeLiveEditor() {
  return requestLiveEditorTransition(closeLiveEditorImmediately);
}

function closeLiveEditorImmediately() {
  const returnFocus = liveEditorReturnFocus;
  const returnFocusLive = liveEditorReturnFocusLive;
  liveEditorReturnFocus = null;
  liveEditorReturnFocusLive = null;
  liveEditorGeneration += 1;
  liveReservationRequestSequence += 1;
  const root = getLiveEditorRoot();
  if (root) root.innerHTML = getLiveEditorEmptyHtml();
  document.getElementById('live-master-detail')?.classList.remove('has-live-selection');
  const back = document.getElementById('live-editor-back');
  if (back) back.hidden = true;
  const heading = document.getElementById('live-editor-heading');
  if (heading) heading.textContent = 'Liveを選択';
  const context = document.getElementById('live-editor-context');
  if (context) context.textContent = '選択中Live';
  setLiveEditorSaveStatus('');
  liveEditorDirty = false;
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.title = '';
  }
  if (currentEditType?.startsWith('live')) {
    currentEditType = null;
    currentEditId = null;
    isNewItem = false;
  }
  syncLiveSelectionState();
  applyApiFallbackReadOnlyState();

  const hasConnectedReturnFocus = (
    returnFocus
    && typeof returnFocus.focus === 'function'
    && (typeof document.contains !== 'function' || document.contains(returnFocus))
  );
  if (hasConnectedReturnFocus) {
    returnFocus.focus();
    return true;
  }
  if (!returnFocusLive) return true;
  findLiveEditTrigger(returnFocusLive.id, returnFocusLive.category)?.focus?.();
  return true;
}

// Discography追加
function addDiscography() {
  isNewItem = true;
  currentEditType = 'discography-digital';
  currentEditId = 'disc-' + Date.now();

  showModal('新規Discography', `
    <div class="form-group">
      <label>タイトル</label>
      <input type="text" id="edit-title" class="text-input" placeholder='1st.Single "xxx"'>
    </div>
    <div class="form-group">
      <label>リリース日</label>
      <input type="text" id="edit-releaseDate" class="text-input" placeholder="2025.01.01">
    </div>
    <div class="form-group">
      <label>説明（曲リスト等）</label>
      <textarea id="edit-description" class="textarea" rows="4" placeholder="1. xxx&#10;2. yyy"></textarea>
    </div>
    ${getImageFormHtml('')}
    <div class="form-group">
      <label>リンクURL</label>
      <input type="url" id="edit-link" class="text-input" placeholder="https://...">
    </div>
    <div class="form-group">
      <label>カテゴリ</label>
      <select id="edit-category" class="select">
        <option value="digital">Digital Release</option>
        <option value="demo">宅録Demo</option>
      </select>
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'none';
}

// Discography編集
function editDiscography(id, category) {
  const list = category === 'digital' ? siteData.discography.digital : siteData.discography.demo;
  const item = list.find(d => d.id === id);
  if (!item) return;

  isNewItem = false;
  currentEditType = `discography-${category}`;
  currentEditId = id;

  showModal('Discography編集', `
    <div class="form-group">
      <label>タイトル</label>
      <input type="text" id="edit-title" class="text-input" value="${escapeHtml(item.title)}">
    </div>
    <div class="form-group">
      <label>リリース日</label>
      <input type="text" id="edit-releaseDate" class="text-input" value="${escapeHtml(item.releaseDate)}">
    </div>
    <div class="form-group">
      <label>説明（曲リスト等）</label>
      <textarea id="edit-description" class="textarea" rows="4">${escapeHtml(item.description)}</textarea>
    </div>
    ${getImageFormHtml(item.image)}
    <div class="form-group">
      <label>リンクURL</label>
      <input type="url" id="edit-link" class="text-input" value="${escapeHtml(item.link)}">
    </div>
    <div class="form-group">
      <label>カテゴリ</label>
      <select id="edit-category" class="select">
        <option value="digital" ${category === 'digital' ? 'selected' : ''}>Digital Release</option>
        <option value="demo" ${category === 'demo' ? 'selected' : ''}>宅録Demo</option>
      </select>
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'block';
}

// モーダル表示
function showModal(title, content) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  if (!modal.classList.contains('active')) {
    modalReturnFocus = document.activeElement;
    const liveId = String(modalReturnFocus?.dataset?.liveId || '');
    const liveCategory = String(modalReturnFocus?.dataset?.liveCategory || '');
    modalReturnFocusLive = liveId && ['upcoming', 'past'].includes(liveCategory)
      ? { id: liveId, category: liveCategory }
      : null;
  }
  modalGeneration += 1;
  document.getElementById('modal-title').textContent = title;
  modalBody.innerHTML = content;
  document.getElementById('modal-overlay').classList.add('active');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  const initialFocus = modalBody.querySelector(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
  );
  (initialFocus || modal).focus();
}

// モーダル閉じる
function closeModal() {
  const returnFocus = modalReturnFocus;
  const returnFocusLive = modalReturnFocusLive;
  modalReturnFocus = null;
  modalReturnFocusLive = null;
  modalGeneration += 1;
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('modal').classList.remove('active');
  document.body.style.overflow = '';
  currentEditType = null;
  currentEditId = null;
  isNewItem = false;
  const hasConnectedReturnFocus = (
    returnFocus
    && typeof returnFocus.focus === 'function'
    && (typeof document.contains !== 'function' || document.contains(returnFocus))
  );
  if (hasConnectedReturnFocus) {
    returnFocus.focus();
    return;
  }
  if (!returnFocusLive) return;
  const replacement = Array.from(document.querySelectorAll('[data-live-edit]')).find((trigger) => (
    String(trigger.dataset?.liveId || '') === returnFocusLive.id
    && String(trigger.dataset?.liveCategory || '') === returnFocusLive.category
  ));
  replacement?.focus?.();
}

function handleModalKeydown(event) {
  if (event.key !== 'Escape') return;
  const modal = document.getElementById('modal');
  if (!modal?.classList.contains('active')) return;
  event.preventDefault?.();
  closeModal();
}

// モーダル保存
async function saveModal() {
  let ok = true;
  if (!ensureNoActiveImageUploads()) return;
  if (currentEditType?.startsWith('live')) return saveLiveWorkspace();
  if (currentEditType === 'news') {
    saveNewsItem();
  } else if (currentEditType.startsWith('youtube')) {
    ok = saveYouTubeItem();
  } else if (currentEditType.startsWith('discography')) {
    saveDiscographyItem();
  }

  if (!ok) return;
  closeModal();
  markChanged();
  if (IS_API_MODE) {
    const saved = await saveData({ silent: true });
    if (saved) showToast('保存しました', 'success');
  } else {
    showToast('編集内容を反映しました。右上の「保存」で確定します', 'success');
  }
}

function saveYouTubeItem() {
  const newCategory = document.getElementById('edit-category').value;
  const input = document.getElementById('edit-youtube').value;
  const youtubeId = getYouTubeVideoId(input);
  if (!youtubeId) {
    showToast('YouTube URL / ID が不正です（IDは11文字）', 'error');
    return false;
  }
  const item = {
    id: currentEditId,
    title: document.getElementById('edit-title').value,
    youtubeId
  };

  const originalCategory = currentEditType.split('-')[1];
  const originalList = siteData.youtube[originalCategory] || [];
  const originalIndex = originalList.findIndex(v => v.id === currentEditId);
  if (originalIndex !== -1) {
    originalList.splice(originalIndex, 1);
  }

  if (!siteData.youtube[newCategory]) siteData.youtube[newCategory] = [];
  siteData.youtube[newCategory].unshift(item);
  renderYouTube();
  return true;
}

// News保存
function saveNewsItem() {
  const item = {
    id: currentEditId,
    date: document.getElementById('edit-date').value,
    title: document.getElementById('edit-title').value,
    description: document.getElementById('edit-description').value,
    image: document.getElementById('edit-image').value,
    link: document.getElementById('edit-link').value,
    linkText: document.getElementById('edit-linkText').value
  };

  if (isNewItem) {
    siteData.news.unshift(item);
  } else {
    const index = siteData.news.findIndex(n => n.id === currentEditId);
    if (index !== -1) siteData.news[index] = item;
  }

  renderNews();
}

// Live保存
function saveLiveItem() {
  const isPast = document.getElementById('edit-isPast').checked;
  const originalCategory = currentEditType.split('-')[1];
  const originalList = originalCategory === 'upcoming' ? siteData.live.upcoming : siteData.live.past;
  const originalIndex = originalList.findIndex(l => l.id === currentEditId);
  const originalItem = originalIndex === -1 ? {} : originalList[originalIndex];
  const operations = getLiveOperations();
  const editorDate = readLiveDateFromEditor();
  const normalizedDate = operations?.normalizeLiveDateInput(editorDate) || '';
  const item = {
    ...originalItem,
    id: currentEditId,
    date: normalizedDate || editorDate,
    title: document.getElementById('edit-title')?.value || '',
    venue: document.getElementById('edit-venue').value,
    openTime: document.getElementById('edit-openTime')?.value || '',
    startTime: document.getElementById('edit-startTime')?.value || '',
    ticket: document.getElementById('edit-ticket')?.value.trim() || '',
    notes: (document.getElementById('edit-notes')?.value || '')
      .split(/\r?\n/u)
      .map((note) => note.trim().replace(/^※+\s*/u, ''))
      .filter(Boolean)
      .join('\n'),
    performers: operations?.normalizeLivePerformers(document.getElementById('edit-performers')?.value) || '',
    description: document.getElementById('edit-description')?.value ?? originalItem.description ?? '',
    image: document.getElementById('edit-image').value,
    link: document.getElementById('edit-link').value,
    sourceText: document.getElementById('edit-sourceText')?.value || '',
    ticketUrl: document.getElementById('edit-ticketUrl')?.value.trim() || '',
    reservationClosed: Boolean(document.getElementById('edit-reservationClosed')?.checked),
    xComment: document.getElementById('edit-xComment')?.value || ''
  };

  // 元のカテゴリから削除
  if (originalIndex !== -1) {
    originalList.splice(originalIndex, 1);
  }

  // 新しいカテゴリに追加
  if (isPast) {
    siteData.live.past.unshift(item);
  } else {
    siteData.live.upcoming.unshift(item);
  }

  const destinationCategory = isPast ? 'past' : 'upcoming';
  currentEditType = `live-${destinationCategory}`;
  isNewItem = false;

  if (modalReturnFocusLive?.id === String(item.id)) {
    modalReturnFocusLive.category = destinationCategory;
  }
  if (liveEditorReturnFocusLive?.id === String(item.id)) {
    liveEditorReturnFocusLive.category = destinationCategory;
  }

  applyLiveWorkspaceView('page');
  applyTicketSettingsOpen(false);
  applyLiveListView(destinationCategory);
  renderLive();
  renderTicketsUi();
  return { liveId: item.id, postToX: false, item, category: destinationCategory };
}

async function saveLiveWorkspace() {
  if (!currentEditType?.startsWith('live') || !currentEditId) return false;
  if (rejectApiFallbackMutation('読み取り専用のためLiveを保存できません。')) return false;
  if (!ensureNoActiveImageUploads()) return false;
  if (!validateLiveEditor()) {
    setLiveEditorDirty(true, '未保存');
    return false;
  }

  const result = saveLiveItem();
  if (IS_API_MODE) {
    setLiveEditorSaveStatus('保存中');
    const saved = await saveData({ silent: true });
    if (!saved) {
      setLiveEditorDirty(true, '保存失敗');
      return false;
    }
  } else {
    markChanged();
  }

  openLiveEditor(result.item, result.category, false);
  setLiveEditorDirty(false, IS_API_MODE ? '保存済み' : 'JSON書き出し待ち');
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn && !IS_API_MODE) saveBtn.textContent = 'JSONを書き出す *';
  showToast(IS_API_MODE ? '保存しました' : '編集内容を反映しました。右上の「JSONを書き出す」で確定します', 'success');
  return true;
}

async function deleteLiveFromWorkspace() {
  if (!currentEditType?.startsWith('live') || !currentEditId) return false;
  if (rejectApiFallbackMutation('読み取り専用のためLiveを削除できません。')) return false;
  if (!confirm('削除しますか？')) return false;

  const category = currentEditType.split('-')[1];
  const liveId = currentEditId;
  if (category === 'upcoming') {
    siteData.live.upcoming = siteData.live.upcoming.filter(live => live.id !== liveId);
  } else {
    siteData.live.past = siteData.live.past.filter(live => live.id !== liveId);
  }
  renderLive();
  renderTicketsUi();
  closeLiveEditorImmediately();
  markChanged();
  showToast(
    IS_API_MODE
      ? '削除内容を反映しました。右上の「保存」で確定します'
      : '削除内容を反映しました。右上の「JSONを書き出す」で確定します',
    'success'
  );
  return true;
}

// Discography保存
function saveDiscographyItem() {
  const newCategory = document.getElementById('edit-category').value;
  const item = {
    id: currentEditId,
    title: document.getElementById('edit-title').value,
    releaseDate: document.getElementById('edit-releaseDate').value,
    description: document.getElementById('edit-description').value,
    image: document.getElementById('edit-image').value,
    link: document.getElementById('edit-link').value
  };

  // 元のカテゴリから削除
  const originalCategory = currentEditType.split('-')[1];
  const originalList = originalCategory === 'digital' ? siteData.discography.digital : siteData.discography.demo;
  const originalIndex = originalList.findIndex(d => d.id === currentEditId);
  if (originalIndex !== -1) {
    originalList.splice(originalIndex, 1);
  }

  // 新しいカテゴリに追加
  if (newCategory === 'digital') {
    siteData.discography.digital.unshift(item);
  } else {
    siteData.discography.demo.unshift(item);
  }

  renderDiscography();
}

// アイテム削除
function deleteItem() {
  if (currentEditType?.startsWith('live')) return deleteLiveFromWorkspace();
  if (!confirm('削除しますか？')) return;

  if (currentEditType === 'news') {
    siteData.news = siteData.news.filter(n => n.id !== currentEditId);
    renderNews();
  } else if (currentEditType.startsWith('youtube')) {
    const category = currentEditType.split('-')[1];
    if (siteData.youtube[category]) {
      siteData.youtube[category] = siteData.youtube[category].filter(v => v.id !== currentEditId);
    }
    renderYouTube();
  } else if (currentEditType.startsWith('discography')) {
    const category = currentEditType.split('-')[1];
    if (category === 'digital') {
      siteData.discography.digital = siteData.discography.digital.filter(d => d.id !== currentEditId);
    } else {
      siteData.discography.demo = siteData.discography.demo.filter(d => d.id !== currentEditId);
    }
    renderDiscography();
  }

  closeModal();
  markChanged();
  showToast('編集内容を反映しました。右上の「保存」で確定します', 'success');
}

// 変更マーク
function markChanged() {
  hasChanges = true;
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return;
  saveBtn.textContent = IS_API_MODE ? '保存 *' : 'JSONを書き出す *';
  saveBtn.classList.remove('saved');
}

function setSaveStateSaved(silent = false) {
  hasChanges = false;
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.textContent = '保存済';
    saveBtn.classList.add('saved');
  }

  if (!silent) {
    showToast('保存しました', 'success');
  }
  setTimeout(() => {
    if (saveBtn) saveBtn.textContent = IS_API_MODE ? '保存' : 'JSONを書き出す';
  }, 2000);
}

async function saveToApi() {
  const response = await adminFetch('/api/admin/site-data', {
    method: 'PUT',
    body: JSON.stringify(siteData)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'API保存に失敗しました'));
  }
}

// データ保存
async function saveData(options = {}) {
  if (rejectApiFallbackMutation('読み取り専用のため保存できません。')) return false;
  if (isSaving) return false;
  if (!ensureNoActiveImageUploads()) return false;
  const duplicateLiveIds = findDuplicateLiveIds(siteData);
  if (duplicateLiveIds.length > 0) {
    showToast(`保存できません: Live IDが重複しています: ${duplicateLiveIds.join(', ')}`, 'error');
    return false;
  }
  isSaving = true;
  const { silent = false } = options;
  const pendingCount = Object.keys(pendingImages).length;

  try {
    if (IS_API_MODE) {
      if (pendingCount > 0 && !silent) {
        showToast('画像ファイルは別途 assets/images に配置してください', 'error');
      }
      await saveToApi();
      setSaveStateSaved(silent);
      return true;
    }

    if (pendingCount > 0) {
      if (confirm(`新規画像が${pendingCount}件あります。\n\nOK: JSONと画像をダウンロード\nキャンセル: JSONのみダウンロード`)) {
        downloadImages();
      }
    }
    downloadJson();
    setSaveStateSaved(silent);
    return true;
  } catch (error) {
    showToast(`保存に失敗しました: ${error.message}`, 'error');
    return false;
  } finally {
    isSaving = false;
  }
}

function readLiveFromModal() {
  return {
    id: currentEditId,
    date: readLiveDateFromEditor(),
    title: document.getElementById('edit-title')?.value || '',
    venue: document.getElementById('edit-venue')?.value || '',
    openTime: document.getElementById('edit-openTime')?.value || '',
    startTime: document.getElementById('edit-startTime')?.value || '',
    ticket: document.getElementById('edit-ticket')?.value || '',
    notes: document.getElementById('edit-notes')?.value || '',
    performers: document.getElementById('edit-performers')?.value || '',
    description: document.getElementById('edit-description')?.value || '',
    link: document.getElementById('edit-link')?.value || '',
    sourceText: document.getElementById('edit-sourceText')?.value || '',
    ticketUrl: document.getElementById('edit-ticketUrl')?.value || '',
    reservationClosed: Boolean(document.getElementById('edit-reservationClosed')?.checked),
    xComment: document.getElementById('edit-xComment')?.value || ''
  };
}

function getCanonicalLiveUrl(liveId) {
  const id = String(liveId || '').trim();
  return id ? `https://1212hp.com/live/detail/?liveId=${encodeURIComponent(id)}` : '';
}

function updateXPreviewInModal() {
  const previewEl = document.getElementById('x-post-preview');
  if (!previewEl) return;
  const live = readLiveFromModal();
  const operations = getLiveOperations();
  if (!operations) {
    previewEl.value = '';
    return;
  }
  const canonicalUrl = isNewItem ? '' : getCanonicalLiveUrl(live.id);
  previewEl.value = operations.buildXAnnouncementText(live, live.xComment, canonicalUrl);
}

function setLiveSourceIntakeStatus(message) {
  const target = document.getElementById('live-source-warnings');
  if (!target) return;
  target.textContent = String(message || '');
}

const LIVE_SOURCE_INTAKE_FIELD_MAP = {
  date: 'edit-date',
  title: 'edit-title',
  venue: 'edit-venue',
  openTime: 'edit-openTime',
  startTime: 'edit-startTime',
  ticket: 'edit-ticket',
  notes: 'edit-notes',
  performers: 'edit-performers',
  ticketUrl: 'edit-ticketUrl',
  link: 'edit-link',
};

function normalizeLiveSourceIntakePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length !== 1 || payloadKeys[0] !== 'draft') return null;

  const draft = payload.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const expectedKeys = Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP).sort();
  const draftKeys = Object.keys(draft).sort();
  if (draftKeys.length !== expectedKeys.length || draftKeys.some((key, index) => key !== expectedKeys[index])) {
    return null;
  }

  const normalized = {};
  for (const key of expectedKeys) {
    if (typeof draft[key] !== 'string') return null;
    normalized[key] = draft[key].trim();
  }
  return normalized;
}

async function handleLiveSourceParse() {
  const sourceElement = document.getElementById('edit-sourceText');
  const button = document.getElementById('live-source-parse-btn');
  if (rejectApiFallbackMutation('読み取り専用のためAI整理を実行できません。')) return false;
  if (!IS_API_MODE) {
    setLiveSourceIntakeStatus('AIで整理はAPI Modeで利用可能です。元情報は変更されていません。');
    return false;
  }
  if (!sourceElement || !button) return false;

  const sourceText = sourceElement.value;
  const ownerGeneration = liveEditorGeneration;
  if (
    activeLiveSourceIntakeOperation
    && activeLiveSourceIntakeOperation.ownerGeneration === ownerGeneration
    && activeLiveSourceIntakeOperation.button === button
  ) {
    return false;
  }
  const fieldElements = Object.fromEntries(Object.entries(LIVE_SOURCE_INTAKE_FIELD_MAP).map(([key, id]) => (
    [key, document.getElementById(id)]
  )));
  const previewElement = document.getElementById('x-post-preview');
  if (Object.values(fieldElements).some((field) => !field) || !previewElement) {
    setLiveSourceIntakeStatus('AIで整理できませんでした。元情報は変更されていません。');
    return false;
  }
  const ownsCurrentEditor = () => (
    liveEditorGeneration === ownerGeneration
    && document.getElementById('edit-sourceText') === sourceElement
    && document.getElementById('live-source-parse-btn') === button
    && Object.entries(LIVE_SOURCE_INTAKE_FIELD_MAP).every(([key, id]) => document.getElementById(id) === fieldElements[key])
    && document.getElementById('x-post-preview') === previewElement
  );
  const requestInputSnapshot = {
    sourceText,
    fields: Object.fromEntries(Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP).map((key) => [key, fieldElements[key].value])),
  };
  const operation = { ownerGeneration, button };
  let rollbackSnapshot = null;

  activeLiveSourceIntakeOperation = operation;
  button.disabled = true;
  button.textContent = 'AIで整理中...';
  setLiveSourceIntakeStatus('AIで整理しています...');

  try {
    const response = await adminFetch('/api/admin/live-source-intake', {
      method: 'POST',
      body: JSON.stringify({ sourceText }),
    }, { allowBaseFallback: false });
    if (!response?.ok) throw new Error('live source intake failed');
    const payload = await response.json();
    const draft = normalizeLiveSourceIntakePayload(payload);
    if (!draft) throw new Error('invalid live source intake payload');
    if (!ownsCurrentEditor()) return false;
    const inputChanged = (
      sourceElement.value !== requestInputSnapshot.sourceText
      || Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP).some((key) => (
        fieldElements[key].value !== requestInputSnapshot.fields[key]
      ))
    );
    if (inputChanged) {
      setLiveSourceIntakeStatus('入力が変更されたため反映しませんでした。もう一度AIで整理してください。');
      return false;
    }

    rollbackSnapshot = {
      fields: Object.fromEntries(Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP).map((key) => [key, fieldElements[key].value])),
      preview: previewElement.value,
    };
    for (const key of Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP)) {
      if (draft[key]) fieldElements[key].value = draft[key];
    }
    updateXPreviewInModal();
    revealNewLivePublicFields();
    markLiveEditorDirty();
    setLiveSourceIntakeStatus('AIで整理しました。内容を確認してから更新してください。');
    return true;
  } catch (_error) {
    if (ownsCurrentEditor()) {
      if (rollbackSnapshot) {
        for (const key of Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP)) {
          fieldElements[key].value = rollbackSnapshot.fields[key];
        }
        previewElement.value = rollbackSnapshot.preview;
      }
      setLiveSourceIntakeStatus('AIで整理できませんでした。元情報は変更されていません。');
    }
    return false;
  } finally {
    if (activeLiveSourceIntakeOperation === operation) {
      activeLiveSourceIntakeOperation = null;
    }
    button.disabled = false;
    button.textContent = 'AIで下書きを作る';
  }
}

async function copyToClipboard(text) {
  const value = String(text || '');
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_e) {
    // Fallback for older browsers / non-secure contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_e2) {
      return false;
    }
  }
}

function buildXIntentUrlFromModal() {
  if (isNewItem || !currentEditId) return '';
  updateXPreviewInModal();
  const text = String(document.getElementById('x-post-preview')?.value || '').trim();
  return text ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` : '';
}

function openXIntentFromModal() {
  const intentUrl = buildXIntentUrlFromModal();
  if (!intentUrl) {
    showToast('先にLiveを保存してください', 'error');
    return;
  }
  window.open(intentUrl, '_blank', 'noopener');
}

async function copyXAnnouncementFromModal() {
  updateXPreviewInModal();
  const text = document.getElementById('x-post-preview')?.value || '';
  const ok = await copyToClipboard(text);
  showToast(ok ? '投稿文をコピーしました' : 'コピーできませんでした', ok ? 'success' : 'error');
  return ok;
}

function calculateActiveReservationTotals(reservations) {
  return (Array.isArray(reservations) ? reservations : []).reduce((totals, reservation) => {
    if (reservation?.status === 'cancelled') return totals;
    totals.records += 1;
    const quantity = Number(reservation?.quantity);
    totals.seats += Number.isFinite(quantity) ? quantity : 0;
    return totals;
  }, { records: 0, seats: 0 });
}

function renderLiveReservationLedger(reservations, target = document.getElementById('live-reservation-ledger')) {
  if (!target) return;
  const rows = Array.isArray(reservations) ? reservations : [];
  const totals = calculateActiveReservationTotals(rows);
  target.innerHTML = `
    <div class="reservation-totals" aria-label="有効予約集計">
      <span><strong>${totals.records}</strong> 有効予約件数</span>
      <span><strong>${totals.seats}</strong> 予約枚数</span>
    </div>
    <div class="items-list live-ledger-list">
      ${rows.length ? rows.map((row) => renderTicketRow(row, { compact: true })).join('') : '<div class="empty-state"><p>予約がありません</p></div>'}
    </div>`;
}

async function loadLiveReservations(liveId = currentEditId) {
  const target = document.getElementById('live-reservation-ledger');
  const normalizedLiveId = String(liveId || '');
  if (
    !target
    || isNewItem
    || !normalizedLiveId
    || !currentEditType?.startsWith('live')
    || String(currentEditId || '') !== normalizedLiveId
  ) return;
  if (isApiFallbackReadOnly) {
    target.innerHTML = '<div class="empty-state operation-gate"><p>API接続失敗中は予約データを変更できません。</p></div>';
    const submit = document.getElementById('manual-reservation-submit');
    if (submit) submit.disabled = true;
    return;
  }
  const ownerGeneration = liveEditorGeneration;
  const requestSequence = ++liveReservationRequestSequence;
  const ownsCurrentLedger = () => (
    liveEditorGeneration === ownerGeneration
    && liveReservationRequestSequence === requestSequence
    && String(currentEditId || '') === normalizedLiveId
    && document.getElementById('live-reservation-ledger') === target
  );
  if (!IS_API_MODE) {
    if (!ownsCurrentLedger()) return;
    target.innerHTML = '<div class="empty-state operation-gate"><p>予約台帳と手動取り置きにはAPI接続が必要です。Local Modeでは予約データを変更しません。</p></div>';
    const submit = document.getElementById('manual-reservation-submit');
    if (submit) submit.disabled = true;
    return;
  }

  target.innerHTML = '<div class="empty-state"><p>予約台帳を読み込み中...</p></div>';
  try {
    const params = new URLSearchParams({ liveId: normalizedLiveId, limit: '200' });
    const response = await adminFetch(`/api/admin/ticket-reservations?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!ownsCurrentLedger()) return;
    if (!response.ok) throw new Error(getErrorMessage(payload, '予約台帳を取得できませんでした'));
    renderLiveReservationLedger(payload.reservations, target);
  } catch (error) {
    if (!ownsCurrentLedger()) return;
    target.innerHTML = `<div class="empty-state operation-error"><p>取得失敗: ${escapeHtml(error.message)}</p></div>`;
  }
}

async function submitManualReservation() {
  const errorEl = document.getElementById('manual-reservation-error');
  const submit = document.getElementById('manual-reservation-submit');
  if (errorEl) errorEl.textContent = '';
  if (rejectApiFallbackMutation('読み取り専用のため予約を追加できません。')) {
    if (errorEl) errorEl.textContent = 'API接続失敗中は予約を追加できません。';
    return false;
  }
  if (!IS_API_MODE) {
    if (errorEl) errorEl.textContent = '手動取り置きにはAPI接続が必要です。';
    return false;
  }
  if (isNewItem || !currentEditId) {
    if (errorEl) errorEl.textContent = '先にLiveを保存してください。';
    return false;
  }

  const nameEl = document.getElementById('manual-reservation-name');
  const quantityEl = document.getElementById('manual-reservation-quantity');
  const contactEl = document.getElementById('manual-reservation-contact');
  const noteEl = document.getElementById('manual-reservation-note');
  const name = String(nameEl?.value || '').trim();
  const quantity = Number(quantityEl?.value);
  if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    if (errorEl) errorEl.textContent = 'お名前と1〜10の枚数を確認してください。';
    return false;
  }

  const payload = { liveId: currentEditId, name, quantity };
  const contact = String(contactEl?.value || '').trim();
  const internalNote = String(noteEl?.value || '').trim();
  if (contact) payload.contact = contact;
  if (internalNote) payload.internalNote = internalNote;

  if (submit) {
    submit.disabled = true;
    submit.textContent = '追加中...';
  }
  try {
    const response = await adminFetch('/api/admin/ticket-reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(getErrorMessage(result, '手動取り置きを追加できませんでした'));
    if (nameEl) nameEl.value = '';
    if (quantityEl) quantityEl.value = '1';
    if (contactEl) contactEl.value = '';
    if (noteEl) noteEl.value = '';
    await Promise.all([loadLiveReservations(currentEditId), loadTickets()]);
    showToast('手動取り置きを追加しました', 'success');
    return true;
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    return false;
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = '手動取り置きを追加';
    }
  }
}

function wireLiveOperationsModal() {
  bindLiveEditorTaskTabs();
  setLiveEditorTask('public');
  document.getElementById('live-source-parse-btn')?.addEventListener('click', handleLiveSourceParse);
  document.getElementById('live-manual-entry-btn')?.addEventListener('click', revealNewLivePublicFields);
  document.getElementById('edit-date')?.addEventListener('input', updateLiveCategoryWarning);
  document.getElementById('edit-isPast')?.addEventListener('change', updateLiveCategoryWarning);
  [
    'edit-date',
    'edit-title',
    'edit-venue',
    'edit-openTime',
    'edit-startTime',
    'edit-ticket',
    'edit-notes',
    'edit-performers',
    'edit-description',
    'edit-xComment',
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateXPreviewInModal);
  });
  document.getElementById('x-intent-btn')?.addEventListener('click', openXIntentFromModal);
  document.getElementById('x-post-copy-btn')?.addEventListener('click', copyXAnnouncementFromModal);
  document.getElementById('manual-reservation-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitManualReservation();
  });
  updateXPreviewInModal();
  loadLiveReservations(currentEditId);
}

// JSONダウンロード
function downloadJson() {
  const jsonStr = JSON.stringify(siteData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'site-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 画像ダウンロード
function downloadImages() {
  const filenames = Object.keys(pendingImages);
  if (filenames.length === 0) return;

  // 各画像を個別にダウンロード
  filenames.forEach((filename, index) => {
    setTimeout(() => {
      const base64 = pendingImages[filename];
      const a = document.createElement('a');
      a.href = base64;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, index * 500); // 0.5秒間隔でダウンロード
  });

  showToast(`${filenames.length}件の画像をダウンロード中...`, 'success');

  // ダウンロード後にクリア
  setTimeout(() => {
    pendingImages = {};
  }, filenames.length * 500 + 1000);
}

// トースト表示
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// HTMLエスケープ
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ページ離脱時の警告
window.addEventListener('beforeunload', (e) => {
  if (hasChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});
