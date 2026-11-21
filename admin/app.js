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
    featuredReleaseId: '',
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
    completeText: '予約しました。',
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
let releaseDateBaseline = null;
let currentEditType = null;
let currentEditId = null;
let isNewItem = false;
let hasChanges = false;
let isSaving = false;
let activeLiveSourceIntakeOperation = null;
let modalGeneration = 0;
let modalReturnFocusLive = null;
let liveEditorGeneration = 0;
let liveEditorReturnFocus = null;
let liveEditorReturnFocusLive = null;
let liveEditorDirty = false;
let liveEditorOwner = null;
let liveEditorRevision = 0;
let liveWorkspaceSaveOperation = null;
let liveWorkspaceSaveSequence = 0;
let liveReservationRequestSequence = 0;
let crossLiveReservationRequestSequence = 0;
let liveWorkspaceView = 'page';
let liveListView = 'upcoming';
let liveTicketSettingsOpen = false;
let isApiFallbackReadOnly = false;
// Issue #46: unsaved-change baseline for the Live editor, the Ticket Page settings draft and the confirmation surface.
let liveEditorBaseline = '';
let ticketSettingsBaseline = '';
let ticketSettingsDraft = null;
let ticketSettingsSaving = false;
let liveDialog = null;
let liveTransitionPending = false;
let liveLedgerSummary = null;
let reservationSummary = { status: 'idle', byLiveId: {} };
let reservationSummarySequence = 0;
let liveEditorScreen = 'edit';
let liveReservationView = 'list';
let liveReservationDetailId = null;
let liveReservationFilter = '';
let liveReservationRows = [];
let crossReservationDetailId = null;
let reservationRowsById = {};
let liveEditorStatusText = '';
// Issue #46 stage 7: which global tab is open (the header 保存 is hidden on the Live tab while the API is connected).
let activeGlobalTab = 'live';
let liveLayoutListenerBound = false;
// Issue #47: the edit surfaces of the occasional updates (News now; Music, Site and Profile follow). occPanels holds, per surface,
// what the unsaved judgement needs: read() the inputs, the baseline they were opened (or last saved) with, dirty, saving.
const occPanels = new Map();
let occActiveItem = null;
let occSaveOperation = null;
let occSaveSequence = 0;
let occReturnFocusId = '';
let occLayoutListenerBound = false;
let musicView = 'works';


// 新規追加した画像を保存（{filename: base64data}）
let pendingImages = {};
// APIモードの画像アップロード中ガード
let activeImageUploads = new Set();
let imageUploadSequence = 0;
const latestImageUploadByInput = new WeakMap();
const imageUploadOwners = new Map();
const imageUploadSeriesByInput = new WeakMap();

document.addEventListener('click', handleTicketStatusAction);
document.addEventListener('click', handleLiveEditAction);
document.addEventListener('click', handleReservationViewAction);
document.addEventListener('click', handleOccAction);

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

// Header (right): 接続中 while the API is connected; the build mark is the title attribute, never text. The band under the Header is
// for a failed connection (read-only) and for Local Mode only.
function renderModeLabel() {
  const modeBadge = document.getElementById('modeBadge');
  if (!modeBadge) return;
  modeBadge.textContent = IS_API_MODE ? (isApiFallbackReadOnly ? 'API Fallback' : '接続中') : 'Local Mode';
  if (window.ADMIN_BUILD_ID) modeBadge.setAttribute('title', String(window.ADMIN_BUILD_ID));
  else modeBadge.removeAttribute('title');
}

function renderModeBadge() {
  const modeBadge = document.getElementById('modeBadge');
  const banner = document.getElementById('connectionBanner');
  const saveBtn = document.getElementById('saveBtn');
  if (!modeBadge || !banner) return;

  renderModeLabel();

  if (IS_API_MODE) {
    if (isApiFallbackReadOnly) {
      setConnectionBanner('API接続失敗（ローカルJSONを読み取り専用で表示）', 'error');
      banner.classList.add('is-api');
    } else {
      setConnectionBanner('', 'api');
    }
    if (saveBtn) {
      saveBtn.textContent = isApiFallbackReadOnly ? '読み取り専用' : '保存';
      saveBtn.disabled = isApiFallbackReadOnly;
    }
    syncGlobalSaveButton();
    return;
  }

  setConnectionBanner('ローカルJSONモード（従来運用）');
  if (saveBtn) {
    saveBtn.textContent = 'JSONを書き出す';
    saveBtn.disabled = false;
  }
  syncGlobalSaveButton();
}

// Issue #47: every page saves from its own "保存して公開", so while the API is connected (also when the connection failed and the
// screens are read-only) the header 保存 is never shown and saveData sends nothing. Local Mode keeps 「JSONを書き出す」 in the header.
function shouldConcealGlobalSave() {
  return Boolean(IS_API_MODE);
}

function syncGlobalSaveButton() {
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return false;
  const conceal = shouldConcealGlobalSave();
  saveBtn.hidden = conceal;
  document.body?.classList?.[conceal ? 'remove' : 'add']?.('has-header-action');
  return conceal;
}

// state 'api' = connected: the band is not shown (the Header says 接続中). 'error' / 'normal' show it with the text.
function setConnectionBanner(text, state = 'normal') {
  const banner = document.getElementById('connectionBanner');
  if (!banner) return;
  banner.textContent = state === 'api' ? '' : text;
  banner.hidden = state === 'api';
  banner.classList.remove('is-api', 'is-error');
  if (state === 'error') banner.classList.add('is-error');
}

const API_FALLBACK_MUTATION_CONTROL_IDS = [
  'saveBtn',
  'news-add-btn',
  'news-save-btn',
  'news-delete-btn',
  'music-add-btn',
  'music-save-btn',
  'music-delete-btn',
  'channel-save-btn',
  'site-save-btn',
  'profile-save-btn',
  'profile-link-add-btn',
  'youtube-channel-url',
  'live-add-btn',
  'ticket-complete-text',
  'ticket-field-quantity',
  'ticket-field-message',
  'ticket-field-label-quantity',
  'ticket-field-label-message',
  'ticket-field-placeholder-message',
  'ticket-field-submit-label',
  'ticket-settings-save-btn',
  'live-editor-save-btn',
  'live-editor-delete-btn',
  'live-reservation-add-btn',
  'live-category-upcoming',
  'live-category-past',
  'live-source-parse-btn',
  'live-manual-entry-btn',
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
  'edit-image-select-btn',
  'edit-image-clear-btn',
  'edit-ticketUrl',
  'edit-link',
  'edit-reservationClosed',
  'edit-isPast',
  'edit-xComment',
  'manual-reservation-name',
  'manual-reservation-quantity',
  'manual-reservation-contact',
  'manual-reservation-note',
  'manual-reservation-submit',
];

function applyApiFallbackReadOnlyState() {
  if (!isApiFallbackReadOnly) return false;
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '読み取り専用';
  }
  syncGlobalSaveButton();
  renderModeLabel();
  setConnectionBanner('API接続失敗（ローカルJSONを読み取り専用で表示）', 'error');

  const mutationControls = [
    ...API_FALLBACK_MUTATION_CONTROL_IDS.map((id) => document.getElementById(id)),
    ...Array.from(document.querySelectorAll('[data-admin-mutation]')),
    ...Array.from(document.querySelectorAll('[data-live-editor-mutation]')),
  ];
  [...new Set(mutationControls.filter(Boolean))].forEach((control) => {
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
  });
  const editorMutations = getLiveEditorRoot()?.querySelectorAll?.(
    'input:not([readonly]), textarea:not([readonly]), select, .btn-image-select, .btn-image-clear'
  ) || [];
  Array.from(editorMutations).forEach((control) => {
    control.disabled = true;
    control.setAttribute?.('aria-disabled', 'true');
  });
  document.querySelectorAll('[data-reservation-status]').forEach((control) => {
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
  });
  return true;
}

function rejectApiFallbackMutation(message = 'API接続を復旧してから操作してください。') {
  if (!isApiFallbackReadOnly) return false;
  showToast(message, 'error');
  applyApiFallbackReadOnlyState();
  return true;
}

function applyAdminFieldMutation(control, currentValue, mutation) {
  if (rejectApiFallbackMutation()) {
    if (control) {
      if (typeof currentValue === 'boolean') control.checked = currentValue;
      else control.value = currentValue == null ? '' : String(currentValue);
    }
    return false;
  }
  mutation();
  markChanged();
  return true;
}

function normalizeSiteData(input) {
  const base = structuredClone(DEFAULT_SITE_DATA);
  if (!input || typeof input !== 'object') return base;

  const normalized = { ...base, ...structuredClone(input) };
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
  delete normalized.ticket.introText;
  delete normalized.ticket.noticeText;
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
  return window.MusicData.clearDanglingMusicReferences(normalized);
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


function ensureNoActiveImageUploads() {
  if (activeImageUploads.size === 0) return true;
  showToast('画像アップロード中です。完了してから保存してください', 'error');
  return false;
}

function hasActiveImageUploadForCurrentLiveEditor() {
  if (!liveEditorOwner) return false;
  return Array.from(imageUploadOwners.values()).some((owner) => (
    owner.usesLiveEditor
    && owner.generation === liveEditorGeneration
    && owner.editId === currentEditId
    && owner.editType === currentEditType
  ));
}

// Issue #47: a picture still uploading into the open edit surface counts as unsaved.
function hasActiveImageUploadForOccEditor() {
  if (!occActiveItem) return false;
  return Array.from(imageUploadOwners.values()).some((owner) => (
    owner.ownerKind === 'occ-editor'
    && owner.generation === modalGeneration
    && String(owner.editId) === String(currentEditId)
    && owner.editType === currentEditType
  ));
}

function settleImageUpload(token, inputElement) {
  if (!token) return;
  const uploadOwner = imageUploadOwners.get(token);
  const series = uploadOwner?.series;
  series?.tokens?.delete(token);
  activeImageUploads.delete(token);
  imageUploadOwners.delete(token);
  if (latestImageUploadByInput.get(inputElement) === token) {
    latestImageUploadByInput.delete(inputElement);
  }
  if (series?.tokens?.size === 0 && imageUploadSeriesByInput.get(inputElement) === series) {
    imageUploadSeriesByInput.delete(inputElement);
  }
}

function isSameImageOperationOwner(left, right) {
  return Boolean(
    left
    && right
    && left.ownerKind === right.ownerKind
    && left.generation === right.generation
    && left.editId === right.editId
    && left.editType === right.editType
  );
}

function resolveImageOperationOwner(inputId, inputElement) {
  const editorScoped = inputId === 'edit-image';
  const usesLiveEditor = editorScoped && currentEditType?.startsWith('live');
  // Issue #47: the News edit surface (and, later, Music) has the same edit-* ids as the generic modal and the same ownership
  // by modalGeneration / currentEditType / currentEditId; only its kind differs, so that its uploads count as unsaved.
  const usesOccEditor = editorScoped && !usesLiveEditor && Boolean(occActiveItem);
  const ownerKind = usesLiveEditor
    ? 'live-editor'
    : usesOccEditor
      ? 'occ-editor'
      : editorScoped
        ? 'generic-modal'
        : 'page';
  return {
    ownerKind,
    usesLiveEditor,
    generation: ownerKind === 'live-editor'
      ? liveEditorGeneration
      : ownerKind === 'page'
        ? 0
        : modalGeneration,
    editId: ownerKind === 'page' ? null : currentEditId,
    editType: ownerKind === 'page' ? null : currentEditType,
    inputElement,
  };
}

function imageOperationOwnsCurrentContext(owner) {
  if (owner.ownerKind === 'page') return true;
  if (owner.ownerKind === 'live-editor') {
    return (
      liveEditorGeneration === owner.generation
      && currentEditId === owner.editId
      && currentEditType === owner.editType
    );
  }
  return (
    modalGeneration === owner.generation
    && currentEditId === owner.editId
    && currentEditType === owner.editType
  );
}

function releaseImageOperations(matches, exceptToken = '') {
  for (const [token, owner] of imageUploadOwners) {
    if (token !== exceptToken && matches(owner)) {
      settleImageUpload(token, owner.inputElement);
    }
  }
}

function getOrCreateImageUploadSeries(inputElement, container, pathEl, owner) {
  const existing = imageUploadSeriesByInput.get(inputElement);
  const hasSameOwner = (
    existing
    && existing.tokens.size > 0
    && existing.ownerKind === owner.ownerKind
    && existing.usesLiveEditor === owner.usesLiveEditor
    && existing.generation === owner.generation
    && existing.editId === owner.editId
    && existing.editType === owner.editType
  );
  if (hasSameOwner) return existing;

  const actions = container.parentElement?.querySelector?.('.image-actions') || null;
  const series = {
    inputElement,
    container,
    pathEl,
    actions,
    ownerKind: owner.ownerKind,
    usesLiveEditor: owner.usesLiveEditor,
    generation: owner.generation,
    editId: owner.editId,
    editType: owner.editType,
    tokens: new Set(),
    baseline: {
      inputValue: inputElement.value,
      previewHtml: container.innerHTML,
      pathText: pathEl?.textContent || '',
      hadClearButton: Boolean(actions?.querySelector?.('.btn-image-clear')),
      liveEditorDirty: Boolean(liveEditorDirty),
      liveEditorRevision,
      liveEditorStatus: document.getElementById('live-editor-save-status')?.textContent || '',
    },
  };
  imageUploadSeriesByInput.set(inputElement, series);
  return series;
}

function restoreImageUploadSeriesBaseline(series) {
  if (!series) return;
  const { baseline, inputElement, container, pathEl, actions } = series;
  inputElement.value = baseline.inputValue;
  container.innerHTML = baseline.previewHtml;
  if (pathEl) pathEl.textContent = baseline.pathText;
  if (!baseline.hadClearButton) actions?.querySelector?.('.btn-image-clear')?.remove?.();
  if (series.usesLiveEditor && liveEditorRevision === baseline.liveEditorRevision) {
    setLiveEditorDirty(baseline.liveEditorDirty, baseline.liveEditorStatus);
  }
}

function releaseImageUploadsForLiveOwner(owner) {
  if (!owner) return;
  releaseImageOperations((uploadOwner) => (
    uploadOwner.usesLiveEditor
    && uploadOwner.generation === owner.generation
    && uploadOwner.editId === owner.id
    && uploadOwner.editType === owner.type
  ));
}

function releaseImageUploadsForModalGeneration(generation) {
  releaseImageOperations((owner) => (
    (owner.ownerKind === 'generic-modal' || owner.ownerKind === 'occ-editor')
    && owner.generation === generation
  ));
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
    if (!res.ok) throw adminResponseError(res, payload, '予約一覧を取得できませんでした');
    const reservations = Array.isArray(payload.reservations) ? payload.reservations : [];
    reservations.forEach(rememberReservation);
    if (reservations.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><p>${LIVE_UI_TEXT.noReservations}</p></div>`;
      return;
    }
    listEl.innerHTML = `${renderReservationTableHead()}${reservations.map((row) => renderReservationRow(row, { scope: 'cross' })).join('')}`;
  } catch (e) {
    if (!ownsCurrentList()) return;
    listEl.innerHTML = `<div class="empty-state"><p>${isAuthFailure(e) ? LIVE_UI_TEXT.authFailed : `取得失敗: ${escapeHtml(e.message)}`}</p></div>`;
  }
}

// Issue #46: an authentication failure (401 / 403 / the passphrase prompt was closed) is told the same way everywhere.
function adminResponseError(response, payload, fallback) {
  const authFailed = response?.status === 401 || response?.status === 403;
  const error = new Error(authFailed ? LIVE_UI_TEXT.authFailed : getErrorMessage(payload, fallback));
  error.authFailed = authFailed;
  return error;
}

function isAuthFailure(error) {
  return Boolean(error?.authFailed) || error?.message === '管理トークン未設定' || error?.message === LIVE_UI_TEXT.authFailed;
}

function describeAdminError(error) {
  return isAuthFailure(error) ? LIVE_UI_TEXT.authFailed : String(error?.message || '');
}

function rememberReservation(row) {
  if (row && row.id !== undefined && row.id !== null) reservationRowsById[String(row.id)] = row;
}

const RESERVATION_STATUS_LABELS = { pending: '未対応', handled: '対応済み', cancelled: 'キャンセル' };

// "M/D HH:mm" in Japan time, so the same record reads the same wherever the page is opened.
function formatReservationTime(value) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return String(value || '');
  const jst = new Date(time + 9 * 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

function getReservationContact(row) {
  return row?.source === 'manual' ? String(row.contact || '') : String(row?.email || row?.contact || '');
}

function getReservationNameAndSeats(row) {
  return `${String(row?.name || '')}　${row?.quantity || 1}枚`;
}

// One reservation in a list: name and seats, when it was received (and which Live in the cross list), the status badge.
function renderReservationRow(row, options = {}) {
  const status = row?.status || 'unknown';
  const label = RESERVATION_STATUS_LABELS[status] || status;
  const scope = options.scope === 'cross' ? 'cross' : 'live';
  const received = formatReservationTime(row?.createdAt);
  const meta = scope === 'cross'
    ? `${[row?.liveDate ? getAdminLiveDisplayDate(row.liveDate) : '', row?.liveVenue || ''].filter(Boolean).join(' ')}${received ? `・${received}` : ''}`
    : received;
  // Width 900px and above is a table (名前・枚数・連絡先・受付・状態・操作): the cells are shown there, the two-line main block below.
  // A pending row can be marked 対応済み right in the row without opening it.
  const id = escapeHtml(String(row?.id ?? ''));
  const inlineAction = status === 'pending'
    ? `<button type="button" class="btn btn-secondary reservation-row-action" data-reservation-id="${id}" data-reservation-status="handled">対応済みにする</button>`
    : '';
  return `
    <div class="reservation-row-item">
      <button type="button" class="reservation-row" data-reservation-open="${id}" data-reservation-scope="${scope}">
        <span class="reservation-row-main">
          <span class="reservation-row-name">${escapeHtml(getReservationNameAndSeats(row))}</span>
          <span class="reservation-row-meta">${escapeHtml(meta)}</span>
        </span>
        <span class="reservation-cell reservation-cell-name">${escapeHtml(String(row?.name || ''))}</span>
        <span class="reservation-cell reservation-cell-seats">${escapeHtml(`${row?.quantity || 1}枚`)}</span>
        <span class="reservation-cell reservation-cell-contact">${escapeHtml(getReservationContact(row))}</span>
        <span class="reservation-cell reservation-cell-received">${escapeHtml(received)}</span>
        <span class="status-badge is-${escapeHtml(status)}">${escapeHtml(label)}</span>
      </button>
      ${inlineAction}
    </div>`;
}

// The column names of the wide table (decorative: the cells carry their own text for assistive technology).
function renderReservationTableHead() {
  return '<div class="reservation-table-head" aria-hidden="true"><span class="reservation-table-cols"><span>名前</span><span>枚数</span><span>連絡先</span><span>受付</span><span>状態</span></span><span>操作</span></div>';
}

// One reservation opened: the seven lines (連絡先 is the e-mail of a web reservation), then the status operations.
function renderReservationDetail(row) {
  const status = row?.status || 'unknown';
  const id = escapeHtml(String(row?.id ?? ''));
  const line = (name, value) => `<div class="reservation-detail-row"><dt>${name}</dt><dd>${escapeHtml(String(value ?? ''))}</dd></div>`;
  const live = [row?.liveDate ? getAdminLiveDisplayDate(row.liveDate) : '', row?.liveVenue || ''].filter(Boolean).join(' ');
  const actions = status === 'pending'
    ? `<button type="button" class="btn btn-primary" data-reservation-id="${id}" data-reservation-status="handled">対応済みにする</button>
       <button type="button" class="btn btn-secondary" data-reservation-id="${id}" data-reservation-status="cancelled">キャンセルにする</button>`
    : `<button type="button" class="btn btn-primary" data-reservation-id="${id}" data-reservation-status="pending">未対応に戻す</button>`;
  return `
    <dl class="reservation-detail-list">
      ${line('ライブ', live || row?.liveId || '')}
      ${line('枚数', `${row?.quantity || 1}枚`)}
      ${line('連絡先', getReservationContact(row))}
      ${line('備考', row?.message || '')}
      ${row?.internalNote ? line('内部メモ', row.internalNote) : ''}
      ${line('受付元', row?.source === 'manual' ? '手動' : 'Web')}
      ${line('受付', formatReservationTime(row?.createdAt))}
    </dl>
    <p class="form-error reservation-detail-error" id="reservation-detail-error" role="alert"></p>
    <div class="reservation-detail-actions">
      ${actions}
    </div>
    <button type="button" class="live-text-button reservation-pane-close" data-reservation-close>閉じる</button>`;
}

// Delegated clicks: a reservation row opens it; a filter chip selects / unselects its status.
function handleReservationViewAction(event) {
  const opener = event.target?.closest?.('[data-reservation-open]');
  if (opener) {
    const id = String(opener.dataset?.reservationOpen || '');
    if (!id) return undefined;
    event.preventDefault?.();
    return openReservationDetail(id, opener.dataset?.reservationScope === 'cross' ? 'cross' : 'live');
  }
  const closer = event.target?.closest?.('[data-reservation-close]');
  if (closer) {
    event.preventDefault?.();
    if (crossReservationDetailId) return closeCrossReservationDetail();
    return setLiveReservationView('list');
  }
  const chip = event.target?.closest?.('[data-reservation-filter]');
  if (chip) {
    event.preventDefault?.();
    return setReservationFilter(String(chip.dataset?.reservationFilter || ''));
  }
  return undefined;
}

function openReservationDetail(id, scope = 'live') {
  const row = reservationRowsById[String(id)];
  if (!row) return false;
  if (scope === 'cross') {
    crossReservationDetailId = String(id);
    syncCrossReservationView();
    return true;
  }
  return setLiveReservationView('detail', id);
}

function closeCrossReservationDetail() {
  crossReservationDetailId = null;
  syncCrossReservationView();
  return true;
}

function syncCrossReservationView(options = {}) {
  const row = crossReservationDetailId ? reservationRowsById[crossReservationDetailId] : null;
  if (crossReservationDetailId && !row) crossReservationDetailId = null;
  const wide = isWideLiveLayout();
  const listView = document.getElementById('tickets-list-view');
  const detailView = document.getElementById('tickets-detail-view');
  const detail = document.getElementById('tickets-detail');
  // Width 900px and above: the table stays and the one reservation opens on its right.
  if (listView) listView.hidden = Boolean(crossReservationDetailId) && !wide;
  if (detailView) detailView.hidden = !crossReservationDetailId;
  const keptCrossError = crossReservationDetailId && String(detail?.dataset?.reservationId || '') === String(crossReservationDetailId)
    ? String(document.getElementById('reservation-detail-error')?.textContent || '')
    : '';
  if (detail) {
    detail.innerHTML = crossReservationDetailId ? renderReservationDetail(row) : '';
    if (detail.dataset) detail.dataset.reservationId = crossReservationDetailId ? String(crossReservationDetailId) : '';
  }
  if (keptCrossError) {
    const errorLine = document.getElementById('reservation-detail-error');
    if (errorLine) errorLine.textContent = keptCrossError;
  }
  document.getElementById('live-reservations-panel')?.setAttribute?.('data-tickets-view', crossReservationDetailId ? 'detail' : 'list');
  if (crossReservationDetailId && options.focus !== false) {
    (wide ? detailView : document.getElementById('tickets-detail-back'))?.focus?.();
  }
}

function setReservationFilter(status) {
  const next = ['pending', 'handled', 'cancelled'].includes(status) && status !== liveReservationFilter ? status : '';
  liveReservationFilter = next;
  renderLiveReservationLedger(liveReservationRows);
  return true;
}

// The reservations tab of an open Live has three views: the list, one reservation, and the 取り置き form.
function setLiveReservationView(view, id = null, options = {}) {
  let next = ['detail', 'add'].includes(view) ? view : 'list';
  const row = next === 'detail' ? reservationRowsById[String(id)] : null;
  if (next === 'detail' && !row) next = 'list';
  liveReservationView = next;
  liveReservationDetailId = next === 'detail' ? String(id) : null;
  // Width 900px and above: the list stays and the one reservation / the form opens on its right; the Header stays on the Live.
  const wide = isWideLiveLayout();
  const setHidden = (elementId, hidden) => { const element = document.getElementById(elementId); if (element) element.hidden = hidden; };
  setHidden('live-reservation-list-view', next !== 'list' && !wide);
  setHidden('live-reservation-detail', next !== 'detail');
  setHidden('manual-reservation-form', next !== 'add');
  document.getElementById('live-editor-panel-reservation')?.setAttribute?.('data-reservation-view', next);
  const detail = document.getElementById('live-reservation-detail');
  // The same reservation stays open (a list reload or a width change redraws it): keep the failure line of the last status change.
  const keptDetailError = next === 'detail' && String(detail?.dataset?.reservationId || '') === String(id)
    ? String(document.getElementById('reservation-detail-error')?.textContent || '')
    : '';
  if (detail) {
    detail.innerHTML = next === 'detail' ? renderReservationDetail(row) : '';
    if (detail.dataset) detail.dataset.reservationId = next === 'detail' ? String(id) : '';
  }
  if (keptDetailError) {
    const errorLine = document.getElementById('reservation-detail-error');
    if (errorLine) errorLine.textContent = keptDetailError;
  }
  syncLiveEditorHeader();
  setHidden('live-editor-task-tabs', Boolean(liveEditorOwner?.isNew) || liveEditorScreen !== 'edit' || (next !== 'list' && !wide));
  syncLiveEditorFooter();
  if (options.focus !== false) {
    if (next === 'detail') (wide ? document.getElementById('live-reservation-detail') : document.getElementById('live-editor-back'))?.focus?.();
    if (next === 'add') document.getElementById('manual-reservation-name')?.focus?.();
  }
  return true;
}

// Header: ‹ 一覧 | date and venue | state, or ‹ 予約 | name and seats / 取り置きを追加 while a reservation or the form is open.
function syncLiveEditorHeader() {
  const back = document.getElementById('live-editor-back');
  const inReservation = liveReservationView !== 'list' && !isWideLiveLayout();
  if (back) back.textContent = inReservation ? LIVE_UI_TEXT.backReservation : LIVE_UI_TEXT.backList;
  if (inReservation && liveReservationView === 'detail') {
    setLiveEditorHeading(getReservationNameAndSeats(reservationRowsById[liveReservationDetailId]));
  } else if (inReservation && liveReservationView === 'add') {
    setLiveEditorHeading(LIVE_UI_TEXT.manualTitle);
  } else if (liveEditorOwner) {
    const list = liveEditorOwner.category === 'past' ? siteData?.live?.past : siteData?.live?.upcoming;
    const item = (list || []).find((live) => String(live.id) === String(liveEditorOwner.id));
    setLiveEditorHeading(getLiveEditorHeading(item, liveEditorOwner.isNew));
  }
  setLiveEditorSaveStatus(liveEditorStatusText);
}

// The Header's back button leaves one reservation (or the form) first, and only then leaves the Live.
function handleLiveEditorBack() {
  if (liveReservationView !== 'list' && !isWideLiveLayout()) return setLiveReservationView('list');
  return closeLiveEditor();
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
  if (liveWorkspaceSaveOperation) return false;
  if (rejectApiFallbackMutation('読み取り専用のため予約状態を変更できません。')) return false;
  if (!IS_API_MODE) return false;
  try {
    const res = await adminFetch(`/api/admin/ticket-reservations/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw adminResponseError(res, payload, 'ステータス更新に失敗しました');
    // The changed reservation is closed: back to the list it was opened from, which is read again below.
    if (liveReservationView === 'detail' && String(liveReservationDetailId) === String(id)) setLiveReservationView('list');
    if (crossReservationDetailId && String(crossReservationDetailId) === String(id)) closeCrossReservationDetail();
    const refreshes = [loadTickets(), loadReservationSummary()];
    if (!isNewItem && currentEditId) refreshes.push(loadLiveReservations(currentEditId));
    await Promise.all(refreshes);
    return true;
  } catch (e) {
    const message = describeAdminError(e);
    ['reservation-detail-error'].forEach((errorId) => {
      const target = document.getElementById(errorId);
      if (target) target.textContent = isAuthFailure(e) ? message : `更新失敗: ${message}`;
    });
    showToast(`更新失敗: ${message}`, 'error');
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
      releaseDateBaseline = structuredClone(siteData);
      isApiFallbackReadOnly = false;
      setConnectionBanner('', 'api');
      await loadTickets();
      void loadReservationSummary();
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
  releaseDateBaseline = structuredClone(siteData);
}

// タブ切り替え
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (liveWorkspaceSaveOperation || occSaveOperation || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      if (btn.classList.contains('active')) return;
      const activate = () => {
        if (currentEditType?.startsWith('live')) closeLiveEditorImmediately();
        // Issue #47: the edit surface of News is closed when its tab is left (its edit-* ids are the Live editor's, too).
        if (occActiveItem) closeOccEditorImmediately();
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        activeGlobalTab = btn.dataset.tab;
        syncGlobalSaveButton();
        return true;
      };
      requestLiveEditorTransition(activate);
    });
  });
}

// Issue #46: with nothing unsaved the action still runs synchronously (true/false). With an unsaved Live, an image still
// uploading or unsaved Ticket Page settings it returns a Promise<boolean> that settles after the confirmation surface.
// Issue #47: an unsaved edit surface of the occasional updates (News now), or a picture still uploading into one, asks the same way.
// `options.scope: 'item'` asks only about the open News / work / video: moving between the items of a list does not ask about the Channel URL.
function requestLiveEditorTransition(action, options = {}) {
  if (liveWorkspaceSaveOperation || occSaveOperation) return false;
  const hasPendingImage = hasActiveImageUploadForCurrentLiveEditor();
  const ticketDirty = isTicketSettingsDirty();
  const occScope = options.scope === 'item' ? 'item' : 'all';
  const occDirty = isOccDirty(occScope);
  if (!(liveEditorDirty || hasPendingImage || ticketDirty || occDirty)) return action() !== false;
  if (liveTransitionPending) return false;
  liveTransitionPending = true;
  return openLiveDialog({
    title: LIVE_UI_TEXT.unsavedTitle,
    actions: [
      { id: 'discard', label: LIVE_UI_TEXT.unsavedDiscard, tone: 'secondary' },
      { id: 'stay', label: LIVE_UI_TEXT.unsavedStay, safe: true, tone: 'primary' },
    ],
  }).then((choice) => {
    liveTransitionPending = false;
    if (choice !== 'discard') return false;
    if (hasPendingImage) releaseImageUploadsForLiveOwner(liveEditorOwner);
    if (liveEditorDirty || hasPendingImage) setLiveEditorDirty(false);
    if (ticketDirty) discardTicketSettingsDraft();
    if (occDirty) discardOccPanels(occScope);
    return action() !== false;
  });
}

function afterLiveTransition(result, callback) {
  if (result === false) return;
  if (typeof result?.then === 'function') result.then((ok) => { if (ok !== false) callback(); });
  else callback();
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

  // 予約管理 shows the switch only (Figma 44:811 / 47:926): 「+ 新しいライブ」 belongs to the Liveページ.
  const addButton = document.getElementById('live-add-btn');
  if (addButton) addButton.hidden = liveWorkspaceView === 'reservations';
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

// Issue #46 stage 7: Ticket Page共通設定 is a screen of its own. Width 899px and below it takes the whole page (the Live chrome
// steps aside like on an open Live); width 900px and above it opens in the editor's place with the list kept on the left.
function syncTicketSettingsPanel() {
  const livePagePrimary = document.getElementById('live-page-primary');
  const ticketSettingsPanel = document.getElementById('live-ticket-settings-panel');
  const openTicketSettings = document.getElementById('live-ticket-settings-open');
  livePagePrimary?.classList?.[liveTicketSettingsOpen ? 'add' : 'remove']?.('is-ticket-settings');
  if (ticketSettingsPanel) ticketSettingsPanel.hidden = !liveTicketSettingsOpen;
  openTicketSettings?.setAttribute('aria-expanded', String(liveTicketSettingsOpen));
  document.body?.classList?.[liveTicketSettingsOpen ? 'add' : 'remove']?.('is-live-ticket-settings');
  syncTicketSettingsActions();
}

// 保存して公開 of the settings: width 899px and below only while something is unsaved (or saving); width 900px and above
// always in the heading, dimmed and not pressable while nothing is unsaved.
function syncTicketSettingsActions() {
  const actions = document.getElementById('ticket-settings-actions');
  if (!actions) return;
  const dirty = isTicketSettingsDirty();
  const wide = isWideLiveLayout();
  actions.hidden = wide ? false : (!dirty && !ticketSettingsSaving);
  const button = document.getElementById('ticket-settings-save-btn');
  if (!button) return;
  if (wide && !dirty && !ticketSettingsSaving) {
    if (!button.disabled) {
      button.disabled = true;
      button.dataset.idleDisabled = 'true';
    }
    button.setAttribute('aria-disabled', 'true');
  } else if (button.dataset.idleDisabled === 'true' && !ticketSettingsSaving) {
    button.disabled = false;
    delete button.dataset.idleDisabled;
    button.setAttribute('aria-disabled', 'false');
  }
}

function applyLiveWorkspaceView(view) {
  liveWorkspaceView = view === 'reservations' ? 'reservations' : 'page';
  if (liveWorkspaceView === 'reservations') crossReservationDetailId = null;
  if (liveWorkspaceView !== 'page') liveTicketSettingsOpen = false;
  syncLiveWorkspaceTabs();
  syncTicketSettingsPanel();
  if (liveWorkspaceView === 'reservations') syncCrossReservationView();
  return true;
}

function applyLiveListView(view) {
  liveListView = view === 'past' ? 'past' : 'upcoming';
  syncLiveListTabs();
  return true;
}

function applyTicketSettingsOpen(open) {
  const wasOpen = liveTicketSettingsOpen;
  liveTicketSettingsOpen = Boolean(open);
  if (liveTicketSettingsOpen && !wasOpen) resetTicketSettingsDraft();
  if (liveTicketSettingsOpen) liveWorkspaceView = 'page';
  syncLiveWorkspaceTabs();
  syncTicketSettingsPanel();
  return true;
}

function setLiveWorkspaceView(view) {
  if (liveWorkspaceSaveOperation) return false;
  const target = view === 'reservations' ? 'reservations' : 'page';
  if (target === liveWorkspaceView) return applyLiveWorkspaceView(target);
  return requestLiveEditorTransition(() => {
    if (currentEditType?.startsWith('live')) closeLiveEditorImmediately();
    return applyLiveWorkspaceView(target);
  });
}

function setLiveListView(view) {
  if (liveWorkspaceSaveOperation) return false;
  const target = view === 'past' ? 'past' : 'upcoming';
  if (target === liveListView) return applyLiveListView(target);
  return requestLiveEditorTransition(() => {
    if (currentEditType?.startsWith('live')) closeLiveEditorImmediately();
    return applyLiveListView(target);
  });
}

function setTicketSettingsOpen(open) {
  if (liveWorkspaceSaveOperation) return false;
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
      afterLiveTransition(setView(nextTab.dataset[dataKey]), () => nextTab.focus());
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
      afterLiveTransition(setTicketSettingsOpen(true), () => closeTicketSettings?.focus());
    });
  }
  if (closeTicketSettings && closeTicketSettings.dataset.liveSettingsBound !== 'true') {
    closeTicketSettings.dataset.liveSettingsBound = 'true';
    closeTicketSettings.addEventListener('click', () => {
      afterLiveTransition(setTicketSettingsOpen(false), () => openTicketSettings?.focus());
    });
  }

  setupTicketSettingsSave();
  bindLiveLayoutListener();
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

function musicReleases(data) {
  return ['digital', 'demo'].flatMap(key => data?.discography?.[key] || []);
}

function musicOptions(groups, selected, emptyLabel, sorted = false) {
  const option = item => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.title)}</option>`;
  return `<option value="">${emptyLabel}</option>` + groups.map(([label, items]) =>
    `<optgroup label="${label}">${(sorted ? window.MusicData.sortReleasesByDate(items) : items).map(option).join('')}</optgroup>`).join('');
}

function playbackVideoOptions(selected) {
  return musicOptions([['Music Video', siteData.youtube.musicVideos], ['Live Movie', siteData.youtube.liveMovies], ['Demo', siteData.youtube.demos]], selected, '選ばない');
}

function musicReleaseFields(item = {}) {
  return `<div class="form-group">
      <label for="edit-releaseType">種別</label>
      <input type="text" id="edit-releaseType" class="text-input" placeholder="2nd Single" value="${escapeHtml(item.releaseType || '')}">
    </div>
    <div class="form-group">
      <label for="edit-playbackVideoId">その場で再生する映像</label>
      <select id="edit-playbackVideoId" class="select">${playbackVideoOptions(item.playbackVideoId || '')}</select>
    </div>`;
}

const RELEASE_DATE_ERROR = '「2025.05.05」の形で入力してください。';
function releaseDateIsAllowed(item) {
  const previous = musicReleases(releaseDateBaseline).find(old => old.id === item.id);
  const value = item.releaseDate === undefined ? '' : item.releaseDate;
  const old = previous?.releaseDate === undefined ? '' : previous.releaseDate;
  if (previous && JSON.stringify(value) === JSON.stringify(old)) return true;
  return value === '' || window.MusicData.isReleaseDateFormat(value);
}

function showReleaseDateError(message = RELEASE_DATE_ERROR) {
  const field = document.getElementById('edit-releaseDate');
  const error = document.getElementById('edit-releaseDate-error');
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', 'edit-releaseDate-error');
    field.focus();
  }
  if (error) error.textContent = message;
}

function bindReleaseDateError() {
  const field = document.getElementById('edit-releaseDate');
  field?.addEventListener('input', () => {
    const old = musicReleases(siteData).find(item => item.id === currentEditId);
    const value = old && typeof old.releaseDate !== 'string' && field.value === String(old.releaseDate ?? '') ? old.releaseDate : field.value;
    if (releaseDateIsAllowed({ id: currentEditId, releaseDate: value })) {
      field.setAttribute('aria-invalid', 'false');
      document.getElementById('edit-releaseDate-error').textContent = '';
    }
  });
}



// The JSON export of Local Mode refuses a work whose release date is not allowed (a new or changed date in the wrong shape) and shows the
// work with the reason under its date. Every save checks this before it applies a date, so it is a safety net for the file that is written.
function validateMusicBeforeSave() {
  const invalid = musicReleases(siteData).find(item => !releaseDateIsAllowed(item));
  if (!invalid) return true;
  const category = siteData.discography.digital.includes(invalid) ? 'digital' : 'demo';
  const alreadyOpen = occActiveItem?.kind === 'release' && String(occActiveItem.id) === String(invalid.id);
  if (!alreadyOpen) editDiscography(invalid.id, category);
  showReleaseDateError();
  return false;
}

function renderTicketSettings() {
  if (!siteData?.ticket) return;
  // Issue #46: the inputs edit a draft, not siteData. "保存して公開" (saveTicketSettings) is what changes the data.
  if (isTicketSettingsDirty()) writeTicketSettingsInputs(ticketSettingsDraft);
  else resetTicketSettingsDraft();
  TICKET_SETTINGS_INPUT_IDS.forEach((id) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.oninput = () => onTicketSettingsInput(control);
    control.onchange = () => onTicketSettingsInput(control);
  });
  setupTicketSettingsSave();
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

function renderLiveRow(item, category, options = {}) {
  const isSelected = liveEditorOwner?.type === `live-${category}` && String(liveEditorOwner?.id || '') === String(item.id || '');
  const summary = category === 'upcoming' ? getLiveSummaryText(item.id) : null;
  const reservationLine = summary
    ? `<span class="live-row-reservation"><span class="live-row-seats">${escapeHtml(summary.seatsText)}</span>${summary.pendingText ? `<span class="status-badge is-pending live-row-pending">${escapeHtml(summary.pendingText)}</span>` : ''}</span>`
    : '';
  return `
    <button type="button" class="live-row live-edit-trigger ${category === 'past' ? 'past' : ''}${isSelected ? ' is-selected' : ''}" data-live-edit data-live-id="${escapeHtml(String(item.id || ''))}" data-live-category="${category}" aria-current="${isSelected ? 'true' : 'false'}">
      <img class="thumbnail live-row-thumb" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
      <span class="info live-row-info">
        ${options.isNext ? '<span class="next-live-badge" aria-label="Next Live">Next Live</span>' : ''}
        <span class="title live-row-date">${escapeHtml(getAdminLiveDisplayDate(item.date))}</span>
        <span class="meta live-row-venue">${escapeHtml(String(item.venue || ''))}</span>
        ${reservationLine}
      </span>
      <span class="arrow">›</span>
    </button>
  `;
}

// Issue #46: the reservation count of an upcoming row ("予約 N枚", and "未対応 N" only while something is pending).
// Nothing is returned while the summary is not ready, so the row stays date + venue only.
function getLiveSummaryText(liveId) {
  if (reservationSummary.status !== 'ready') return null;
  const entry = reservationSummary.byLiveId[String(liveId)] || { seats: 0, pending: 0 };
  return {
    seatsText: `予約 ${entry.seats}枚`,
    pendingText: entry.pending > 0 ? `未対応 ${entry.pending}` : '',
  };
}

function renderReservationSummaryNote() {
  const target = document.getElementById('live-summary-note');
  if (!target) return;
  target.textContent = reservationSummary.status === 'failed'
    ? LIVE_UI_TEXT.summaryFailed
    : (reservationSummary.status === 'unauthorized' ? LIVE_UI_TEXT.authFailed : '');
}

// Issue #46: GET /api/admin/ticket-reservation-summary. Only the latest request is applied. A failure only affects the
// list (saving and the reservation operations do not depend on it). Local Mode and the read-only fallback never call it.
async function loadReservationSummary() {
  const sequence = ++reservationSummarySequence;
  if (!IS_API_MODE || isApiFallbackReadOnly) {
    reservationSummary = { status: 'idle', byLiveId: {} };
    renderReservationSummaryNote();
    return false;
  }
  if (reservationSummary.status !== 'ready') reservationSummary = { status: 'loading', byLiveId: {} };
  const settle = (next) => {
    reservationSummary = next;
    renderLive();
    return next.status === 'ready';
  };
  try {
    // Only the list depends on this read: a failure must not move API_BASE_URL (adminFetch would try the canonical base on a 404 / 5xx).
    const response = await adminFetch('/api/admin/ticket-reservation-summary', {}, { allowBaseFallback: false });
    const payload = await response.json().catch(() => ({}));
    if (sequence !== reservationSummarySequence) return false;
    if (response.status === 401 || response.status === 403) return settle({ status: 'unauthorized', byLiveId: {} });
    if (!response.ok || !Array.isArray(payload?.summaries)) return settle({ status: 'failed', byLiveId: {} });
    const byLiveId = {};
    for (const entry of payload.summaries) {
      if (!entry || typeof entry.liveId !== 'string') return settle({ status: 'failed', byLiveId: {} });
      const seats = Number(entry.seats);
      const pending = Number(entry.pending);
      byLiveId[entry.liveId] = {
        seats: Number.isFinite(seats) ? seats : 0,
        pending: Number.isFinite(pending) ? pending : 0,
      };
    }
    return settle({ status: 'ready', byLiveId });
  } catch (error) {
    if (sequence !== reservationSummarySequence) return false;
    return settle({ status: error?.message === '管理トークン未設定' ? 'unauthorized' : 'failed', byLiveId: {} });
  }
}

function syncLiveSelectionState() {
  document.querySelectorAll('[data-live-edit]').forEach((trigger) => {
    const isSelected = (
      liveEditorOwner?.type === `live-${String(trigger.dataset?.liveCategory || '')}`
      && String(liveEditorOwner?.id || '') === String(trigger.dataset?.liveId || '')
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
// Live描画
function renderLive() {
  const upcomingList = document.getElementById('live-upcoming-list');
  const pastList = document.getElementById('live-past-list');

  if (siteData.live.upcoming.length === 0) {
    upcomingList.innerHTML = '<div class="empty-state"><p>開催予定のライブはありません</p></div>';
  } else {
    upcomingList.innerHTML = siteData.live.upcoming.map((item, index) => renderLiveRow(item, 'upcoming', { isNext: index === 0 })).join('');
  }

  if (siteData.live.past.length === 0) {
    pastList.innerHTML = '<div class="empty-state"><p>終了したライブはありません</p></div>';
  } else {
    pastList.innerHTML = siteData.live.past.map(item => renderLiveRow(item, 'past')).join('');
  }

  syncLiveSelectionState();
  renderReservationSummaryNote();
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
    return `<div class="image-placeholder" id="${inputId}-placeholder">${options.placeholderText || 'タップして画像を選択'}</div>`;
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


// Issue #46: the Live flyer block (same ids and handlers as getImageFormHtml; the shared form of the other tabs is unchanged).
function getFlyerFormHtml(currentImage) {
  const inputId = 'edit-image';
  const previewSrc = currentImage ? getImageSrc(currentImage) : '';
  const previewHtml = getImagePreviewHtml(inputId, previewSrc, {
    downloadablePreview: true,
    imagePath: currentImage,
    placeholderText: LIVE_UI_TEXT.flyerNone,
  });
  return `
    <div class="form-group live-flyer" id="live-flyer">
      <p class="live-field-label" id="live-flyer-label">${LIVE_UI_TEXT.flyerLabel}</p>
      <div class="image-upload-area live-flyer-row" id="image-upload-area">
        <input type="file" id="${inputId}-file" data-admin-mutation="" accept="image/*" onchange="handleImageSelect(this, '${inputId}')" style="display:none">
        <input type="hidden" id="${inputId}" data-admin-mutation="" value="${escapeHtml(currentImage || '')}">
        <div class="image-preview-container live-flyer-preview" id="${inputId}-preview-container" data-downloadable-preview="true">
          ${previewHtml}
        </div>
        <div class="image-actions live-flyer-actions">
          <button type="button" class="btn btn-secondary btn-image-select" id="${inputId}-select-btn" data-admin-mutation="" data-live-editor-mutation="true" onclick="document.getElementById('${inputId}-file').click()">${currentImage ? LIVE_UI_TEXT.flyerChange : LIVE_UI_TEXT.flyerChoose}</button>
          ${currentImage ? `<button type="button" class="btn-image-clear live-flyer-clear" id="${inputId}-clear-btn" data-admin-mutation="" data-live-editor-mutation="true" onclick="clearImage('${inputId}')">${LIVE_UI_TEXT.flyerRemove}</button>` : ''}
        </div>
      </div>
      <p class="live-flyer-status" id="${inputId}-path" role="status" aria-live="polite"></p>
    </div>
  `;
}

// The flyer's select button says 画像を変える once a flyer is registered.
function syncFlyerSelectLabel() {
  const select = document.getElementById('edit-image-select-btn');
  if (select) select.textContent = document.getElementById('edit-image')?.value ? LIVE_UI_TEXT.flyerChange : LIVE_UI_TEXT.flyerChoose;
}

// Issue #47: the picture form of every page except the Live flyer: 画像を選ぶ (none) / 画像を変える and 画像を外す (a picture), the path
// (パス: / URL:) under it and the state of the upload in its own line. Same ids and handlers as before (-file, -select-btn,
// -clear-btn, -preview-container, -path); -status is new.
function getOccImageFormHtml(currentImage, inputId = 'edit-image', options = {}) {
  const image = currentImage ? String(currentImage) : '';
  const previewSrc = image ? getImageSrc(image) : '';
  const showPath = options.showPath !== false;
  const downloadablePreview = options.downloadablePreview === true;
  const previewHtml = getImagePreviewHtml(inputId, previewSrc, {
    downloadablePreview,
    imagePath: image,
    placeholderText: LIVE_UI_TEXT.flyerNone,
  });
  const pathHtml = showPath
    ? `<p class="image-path-display" id="${inputId}-path">${image ? `パス: ${escapeHtml(image)}` : ''}</p>`
    : '';

  return `
    <div class="form-group occ-field occ-image${options.variant ? ` occ-image-${options.variant}` : ''}">
      ${options.omitLabel ? '' : `<p class="occ-field-label" id="${inputId}-label">${escapeHtml(options.label || '画像')}</p>`}
      <div class="image-upload-area" id="${inputId}-area">
        <input type="file" id="${inputId}-file" data-admin-mutation="" accept="image/*" onchange="handleImageSelect(this, '${inputId}')" style="display:none">
        <input type="hidden" id="${inputId}" data-admin-mutation="" value="${escapeHtml(image)}">
        <div class="image-preview-container" id="${inputId}-preview-container" data-downloadable-preview="${downloadablePreview ? 'true' : 'false'}">
          ${previewHtml}
        </div>
        <div class="image-actions">
          <button type="button" class="btn-image-select" id="${inputId}-select-btn" data-admin-mutation="" onclick="document.getElementById('${inputId}-file').click()">${image ? LIVE_UI_TEXT.flyerChange : LIVE_UI_TEXT.flyerChoose}</button>
          <button type="button" class="btn-image-clear" id="${inputId}-clear-btn" data-admin-mutation="" onclick="clearImage('${inputId}')"${image ? '' : ' hidden'}>${LIVE_UI_TEXT.flyerRemove}</button>
        </div>
      </div>
      ${pathHtml}
      <p class="occ-image-status" id="${inputId}-status" role="status" aria-live="polite"></p>
    </div>
  `;
}

// 画像選択フォームHTML生成 (every page except the Live flyer; kept under its name for Site, Profile and the Music modal)
function getImageFormHtml(currentImage, inputId = 'edit-image', options = {}) {
  return getOccImageFormHtml(currentImage, inputId, options);
}

// The select button says 画像を変える and 画像を外す is offered only while a picture is registered.
function syncOccImageControls(inputId) {
  const value = document.getElementById(inputId)?.value || '';
  const select = document.getElementById(`${inputId}-select-btn`);
  if (select) select.textContent = value ? LIVE_UI_TEXT.flyerChange : LIVE_UI_TEXT.flyerChoose;
  const clear = document.getElementById(`${inputId}-clear-btn`);
  if (clear) clear.hidden = !value;
}

// Puts a picture value (and what shows it) into a picture form: the saved picture again after the input was dropped.
function setOccImageValue(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const image = value ? String(value) : '';
  input.value = image;
  const container = document.getElementById(`${inputId}-preview-container`);
  if (container) {
    renderImagePreview(inputId, image ? getImageSrc(image) : '', { imagePath: image, placeholderText: LIVE_UI_TEXT.flyerNone }, container);
  }
  const path = document.getElementById(`${inputId}-path`);
  if (path) path.textContent = image ? `パス: ${image}` : '';
  setOccImageStatus(inputId, '');
  syncOccImageControls(inputId);
}

function setOccImageStatus(inputId, message, isError = false) {
  const status = document.getElementById(`${inputId}-status`);
  if (!status) return;
  status.textContent = String(message || '');
  status.classList[isError ? 'add' : 'remove']('is-error');
}

// 画像選択処理
function handleImageSelect(input, inputId) {
  if (rejectApiFallbackMutation('読み取り専用のため画像を変更できません。')) return false;
  const file = input.files[0];
  if (!file) return false;

  const inputElement = document.getElementById(inputId);
  const container = document.getElementById(`${inputId}-preview-container`);
  const pathEl = document.getElementById(`${inputId}-path`);
  if (!inputElement || !container) return false;

  let temporaryClearButton = null;
  const imageOperationToken = `image-operation-${++imageUploadSequence}`;
  const uploadOwner = resolveImageOperationOwner(inputId, inputElement);
  const ownerUsesLiveEditor = uploadOwner.usesLiveEditor;
  const ownsCurrentInput = () => (
    document.getElementById(inputId) === inputElement
    && document.getElementById(`${inputId}-preview-container`) === container
    && imageOperationOwnsCurrentContext(uploadOwner)
  );

  const imageUploadSeries = getOrCreateImageUploadSeries(inputElement, container, pathEl, uploadOwner);
  imageUploadSeries.tokens.add(imageOperationToken);
  activeImageUploads.add(imageOperationToken);
  imageUploadOwners.set(imageOperationToken, { ...uploadOwner, series: imageUploadSeries });
  latestImageUploadByInput.set(inputElement, imageOperationToken);
  releaseImageOperations((owner) => (
    owner.inputElement === inputElement
    && isSameImageOperationOwner(owner, uploadOwner)
  ), imageOperationToken);
  const isFlyer = inputId === 'edit-image' && Boolean(pathEl?.classList?.contains('live-flyer-status'));
  // Issue #47: a picture form with a -status line says what is happening there and leaves the path as it is.
  const statusEl = document.getElementById(`${inputId}-status`);
  // The picture of an edit surface (and of Site / Profile) is held by the screen: it counts as unsaved there, and nothing goes to siteData.
  const occImageKey = OCC_PAGE_IMAGE_PANELS[inputId] || (uploadOwner.ownerKind === 'occ-editor' ? 'item' : '');
  const ownerUsesOccEditor = Boolean(occImageKey);
  const refreshOccState = () => { if (ownerUsesOccEditor) recomputeOccDirty(occImageKey); };
  if (statusEl) setOccImageStatus(inputId, IS_API_MODE ? LIVE_UI_TEXT.flyerUploading : '');
  else if (pathEl) pathEl.textContent = IS_API_MODE ? (isFlyer ? LIVE_UI_TEXT.flyerUploading : 'アップロード中...') : '';
  refreshOccState();

  // FileReaderでBase64に変換
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const isLatestUpload = () => latestImageUploadByInput.get(inputElement) === imageOperationToken;

    if (!ownsCurrentInput() || !isLatestUpload()) {
      settleImageUpload(imageOperationToken, inputElement);
      return;
    }

    // プレビュー更新
    renderImagePreview(inputId, base64, {
      href: base64,
      downloadName: file.name || 'image',
    }, container);

    if (!IS_API_MODE) {
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
      if (pathEl) pathEl.textContent = isFlyer ? '' : `パス: ${imagePath}`;

      setImagePathForInputId(inputId, imagePath);

      if (isFlyer) syncFlyerSelectLabel();
      if (statusEl) syncOccImageControls(inputId);
      if (ownerUsesLiveEditor) markLiveEditorDirty();
      else if (!ownerUsesOccEditor) markChanged();
      settleImageUpload(imageOperationToken, inputElement);
      refreshOccState();
      return;
    }

    // API運用: Cloudflare(R2)へアップロードしてURLを保存
    uploadImageToApi(file)
      .then((result) => {
        if (!ownsCurrentInput() || !isLatestUpload()) return;
        inputElement.value = result.url;
        if (pathEl) pathEl.textContent = isFlyer ? '' : `URL: ${result.url}`;
        if (statusEl) setOccImageStatus(inputId, '');
        renderImagePreview(inputId, base64, {
          href: result.url,
          imagePath: result.url,
        }, container);
        setImagePathForInputId(inputId, result.url);
        if (isFlyer) syncFlyerSelectLabel();
        if (statusEl) syncOccImageControls(inputId);
        if (ownerUsesLiveEditor) markLiveEditorDirty();
        else if (!ownerUsesOccEditor) markChanged();
      })
      .catch((err) => {
        if (!ownsCurrentInput() || !isLatestUpload()) return;
        restoreImageUploadSeriesBaseline(imageUploadSeries);
        temporaryClearButton?.remove?.();
        if (statusEl) {
          syncOccImageControls(inputId);
          setOccImageStatus(inputId, `${LIVE_UI_TEXT.flyerUploadFailed}（${err.message}）`, true);
        } else if (isFlyer) {
          syncFlyerSelectLabel();
          if (pathEl) pathEl.textContent = `${LIVE_UI_TEXT.flyerUploadFailed}（${err.message}）`;
        } else {
          showToast(`画像アップロード失敗: ${err.message}`, 'error');
        }
      })
      .finally(() => {
        settleImageUpload(imageOperationToken, inputElement);
        refreshOccState();
      });

    // クリアボタンを追加（なければ）。-status のあるフォームは、画像を外すボタンを最初から持つ。
    if (statusEl) return;
    const actionsDiv = container.parentElement.querySelector('.image-actions');
    if (!actionsDiv.querySelector('.btn-image-clear')) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.id = `${inputId}-clear-btn`;
      clearBtn.className = 'btn-image-clear';
      clearBtn.dataset.adminMutation = '';
      if (inputId === 'edit-image') clearBtn.dataset.liveEditorMutation = '';
      clearBtn.textContent = isFlyer ? LIVE_UI_TEXT.flyerRemove : '削除';
      clearBtn.onclick = () => clearImage(inputId);
      actionsDiv.appendChild(clearBtn);
      temporaryClearButton = clearBtn;
    }
  };
  reader.onerror = function() {
    const isLatestUpload = latestImageUploadByInput.get(inputElement) === imageOperationToken;
    if (ownsCurrentInput() && isLatestUpload) {
      restoreImageUploadSeriesBaseline(imageUploadSeries);
      if (statusEl) {
        syncOccImageControls(inputId);
        setOccImageStatus(inputId, '画像を読み込めませんでした', true);
      }
      showToast('画像を読み込めませんでした', 'error');
    }
    settleImageUpload(imageOperationToken, inputElement);
    refreshOccState();
  };
  try {
    reader.readAsDataURL(file);
  } catch (error) {
    reader.onerror();
  }
  return true;
}

async function uploadImageToApi(file) {
  if (rejectApiFallbackMutation('読み取り専用のため画像を変更できません。')) {
    throw new Error('API接続に失敗したため閲覧専用です');
  }
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
  if (rejectApiFallbackMutation('読み取り専用のため画像を削除できません。')) return false;
  const inputElement = document.getElementById(inputId);
  const clearOwner = resolveImageOperationOwner(inputId, inputElement);
  releaseImageOperations((owner) => (
    owner.inputElement === inputElement
    && isSameImageOperationOwner(owner, clearOwner)
  ));
  inputElement.value = '';
  const container = document.getElementById(`${inputId}-preview-container`);
  const isFlyer = inputId === 'edit-image' && container.classList?.contains?.('live-flyer-preview');
  const hasStatusLine = Boolean(document.getElementById(`${inputId}-status`));
  container.innerHTML = `<div class="image-placeholder" id="${inputId}-placeholder">${isFlyer || hasStatusLine ? LIVE_UI_TEXT.flyerNone : 'タップして画像を選択'}</div>`;
  const pathEl = document.getElementById(`${inputId}-path`);
  if (pathEl) pathEl.textContent = '';
  if (isFlyer) syncFlyerSelectLabel();
  if (hasStatusLine) setOccImageStatus(inputId, '');

  // クリアボタンを削除（-status のあるフォームは、画像を外すボタンを隠すだけ）
  if (hasStatusLine) {
    syncOccImageControls(inputId);
  } else {
    const clearBtn = container.parentElement.querySelector('.btn-image-clear');
    if (clearBtn) clearBtn.remove();
  }

  setImagePathForInputId(inputId, '');
  if (inputId === 'edit-image' && currentEditType?.startsWith('live')) {
    markLiveEditorDirty();
  } else if (inputId === 'edit-image' && occActiveItem) {
    recomputeOccDirty('item');
  } else if (OCC_PAGE_IMAGE_PANELS[inputId]) {
    recomputeOccDirty(OCC_PAGE_IMAGE_PANELS[inputId]);
  }
  return true;
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
  const taskDisabled = isNew ? ' disabled aria-disabled="true"' : '';
  const saveFirst = isNew ? `<p class="operation-gate">${LIVE_UI_TEXT.saveFirst}</p>` : '';
  const ledgerGate = isNew
    ? `<div class="empty-state operation-gate"><p>${LIVE_UI_TEXT.saveFirst}</p></div>`
    : '<div class="empty-state"><p>予約台帳を読み込みます...</p></div>';

  // Source: a screen of its own for a new Live, a folded block for an existing one. The ids are the same.
  const sourceBody = `
          <div class="form-group">
            <label for="edit-sourceText">${LIVE_UI_TEXT.sourceLabel}</label>
            <textarea id="edit-sourceText" class="textarea live-source-textarea" rows="7" placeholder="主催者から届いたテキストをそのまま貼り付け">${escapeHtml(item.sourceText || '')}</textarea>
          </div>
          <div class="live-source-actions">
            <button type="button" class="btn btn-primary" id="live-source-parse-btn">${LIVE_UI_TEXT.draftButton}</button>
            ${isNew ? `<button type="button" class="live-text-button" id="live-manual-entry-btn">${LIVE_UI_TEXT.manualEntry}</button>` : ''}
          </div>
          <div id="live-source-warnings" class="parse-warnings" aria-live="polite"></div>`;
  const sourceBlock = isNew
    ? `<section id="live-source-intake" class="live-source-intake live-source-screen">${sourceBody}</section>`
    : `<details id="live-source-intake" class="live-source-intake live-collapse">
          <summary class="live-collapse-summary"><span>${LIVE_UI_TEXT.sourceRebuild}</span><span class="live-collapse-chevron" aria-hidden="true"></span></summary>
          <div class="live-collapse-body">${sourceBody}</div>
        </details>`;

  const categoryBlock = isNew
    ? '<input type="checkbox" id="edit-isPast" hidden>'
    : `<div class="live-category-field" id="live-category-field">
          <p class="live-field-label" id="live-category-label">${LIVE_UI_TEXT.categoryLabel}</p>
          <div class="live-segment" role="group" aria-labelledby="live-category-label">
            <button type="button" class="live-segment-option${category === 'past' ? '' : ' is-selected'}" id="live-category-upcoming" aria-pressed="${category === 'past' ? 'false' : 'true'}">${LIVE_UI_TEXT.categoryUpcoming}</button>
            <button type="button" class="live-segment-option${category === 'past' ? ' is-selected' : ''}" id="live-category-past" aria-pressed="${category === 'past' ? 'true' : 'false'}">${LIVE_UI_TEXT.categoryPast}</button>
          </div>
          <input type="checkbox" id="edit-isPast" hidden ${category === 'past' ? 'checked' : ''}>
        </div>
        <p id="live-category-warning" class="form-warning" role="status"></p>`;

  return `
    <div class="live-editor-task-tabs" id="live-editor-task-tabs" role="tablist" aria-label="選択中Liveの操作"${isNew ? ' hidden' : ''}>
      <button type="button" id="live-editor-task-public" class="live-editor-task-tab is-active" role="tab" data-live-editor-task="public" aria-controls="live-editor-panel-public" aria-selected="true" tabindex="0">${LIVE_UI_TEXT.taskPublic}</button>
      <button type="button" id="live-editor-task-announcement" class="live-editor-task-tab" role="tab" data-live-editor-task="announcement" aria-controls="live-editor-panel-announcement" aria-selected="false" tabindex="-1"${taskDisabled}>${LIVE_UI_TEXT.taskAnnouncement}</button>
      <button type="button" id="live-editor-task-reservation" class="live-editor-task-tab" role="tab" data-live-editor-task="reservation" aria-controls="live-editor-panel-reservation" aria-selected="false" tabindex="-1"${taskDisabled}>${LIVE_UI_TEXT.taskReservation}<span class="live-task-count" id="live-editor-reservation-count"></span></button>
    </div>

    <section id="live-editor-panel-public" class="live-editor-task-panel" role="tabpanel" data-live-editor-task-panel="public" aria-labelledby="live-editor-task-public">
      ${isNew ? sourceBlock : ''}
      <div id="live-public-fields" class="live-public-fields"${isNew ? ' hidden' : ''}>
        ${isNew ? '<p id="live-draft-notice" class="live-draft-notice" role="status" aria-live="polite"></p>' : ''}
        ${getFlyerFormHtml(item.image || '')}
        <div class="live-field-grid live-field-grid-venue">
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
          <label for="edit-title">ライブ名</label>
          <input type="text" id="edit-title" class="text-input" value="${escapeHtml(item.title || '')}" placeholder="例: 〇〇企画 / 〇〇 presents...">
        </div>
        <div class="live-field-grid live-field-grid-times">
          <div class="form-group">
            <label for="edit-openTime">OPEN</label>
            <input type="time" id="edit-openTime" class="text-input" value="${escapeHtml(item.openTime || '')}">
          </div>
          <div class="form-group">
            <label for="edit-startTime">START</label>
            <input type="time" id="edit-startTime" class="text-input" value="${escapeHtml(item.startTime || '')}">
          </div>
          <div class="form-group live-field-fee">
            <label for="edit-ticket">料金</label>
            <input type="text" id="edit-ticket" class="text-input" value="${escapeHtml(item.ticket || '')}" placeholder="例: ¥2,500 + 1D">
          </div>
        </div>
        <div class="live-field-grid live-field-grid-notes">
          <div class="form-group">
            <label for="edit-notes">補足</label>
            <textarea id="edit-notes" class="textarea" rows="2" placeholder="1補足1行（※は表示時に付きます）">${escapeHtml(item.notes || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-performers">共演者</label>
            <textarea id="edit-performers" class="textarea" rows="2" placeholder="1組1行、または / 区切り">${escapeHtml(normalizedPerformers)}</textarea>
          </div>
        </div>

        <details class="live-editor-details live-collapse" id="live-links-details">
          <summary class="live-collapse-summary"><span>${LIVE_UI_TEXT.linksLabel}</span><span class="live-collapse-chevron" aria-hidden="true"></span></summary>
          <div class="live-editor-details-body live-collapse-body">
            <div class="form-group">
              <label for="edit-ticketUrl">予約URL</label>
              <input type="url" id="edit-ticketUrl" class="text-input" value="${escapeHtml(ticketUrl)}" placeholder="https://...">
            </div>
            <label class="live-switch-row" for="edit-reservationClosed">
              <span class="live-switch-label">予約の受付を終了する</span>
              <input type="checkbox" role="switch" class="live-switch" id="edit-reservationClosed" ${item.reservationClosed === true ? 'checked' : ''}>
            </label>
            <div class="form-group">
              <label for="edit-link">リンク</label>
              <input type="url" id="edit-link" class="text-input" value="${escapeHtml(item.link || '')}" placeholder="Instagramや公演詳細など">
            </div>
            <div class="form-group">
              <label for="edit-description">説明</label>
              <textarea id="edit-description" class="textarea" rows="4">${escapeHtml(item.description || '')}</textarea>
            </div>
          </div>
        </details>
        ${isNew ? '' : sourceBlock}
        ${categoryBlock}
        ${isNew ? '' : `<button type="button" class="live-text-button live-delete-link" id="live-editor-delete-btn" onclick="deleteLiveFromWorkspace()">${LIVE_UI_TEXT.deleteLink}</button>`}
      </div>
    </section>

    <section id="live-editor-panel-announcement" class="live-editor-task-panel announcement-panel" role="tabpanel" data-live-editor-task-panel="announcement" aria-labelledby="live-editor-task-announcement" hidden>
      <div class="form-group live-announce-comment">
        <label for="edit-xComment">ひとこと</label>
        <textarea id="edit-xComment" class="textarea" rows="2" placeholder="このLiveへのひとこと">${escapeHtml(item.xComment || '')}</textarea>
      </div>
      <div class="form-group live-announce-preview">
        <label for="x-post-preview">投稿の内容</label>
        <textarea id="x-post-preview" class="textarea preview-text" rows="12" readonly></textarea>
      </div>
      ${saveFirst}
      <div class="live-announcement-actions">
        <button type="button" class="btn btn-primary" id="x-intent-btn"${disabled}>${LIVE_UI_TEXT.announceX}</button>
        <button type="button" class="btn btn-secondary" id="x-post-copy-btn">${LIVE_UI_TEXT.copyPost}</button>
        <button type="button" class="btn btn-secondary" id="x-link-copy-btn"${disabled}>${LIVE_UI_TEXT.copyLink}</button>
      </div>
      <p id="live-copy-status" class="live-copy-status" role="status" aria-live="polite"></p>
    </section>

    <section id="live-editor-panel-reservation" class="live-editor-task-panel reservation-panel" role="tabpanel" data-live-editor-task-panel="reservation" aria-labelledby="live-editor-task-reservation" hidden>
      <div id="live-reservation-list-view" class="live-reservation-list-view">
        <div id="live-reservation-ledger" aria-live="polite">${ledgerGate}</div>
        <button type="button" class="btn btn-secondary live-reservation-add" id="live-reservation-add-btn"${disabled}>${LIVE_UI_TEXT.addReservation}</button>
      </div>
      <div id="live-reservation-detail" class="live-reservation-detail" hidden></div>
      <form id="manual-reservation-form" class="manual-reservation-form" novalidate hidden>
        <div class="form-group">
          <label for="manual-reservation-name">お名前</label>
          <input type="text" id="manual-reservation-name" class="text-input" required maxlength="200"${disabled}>
        </div>
        <div class="form-group quantity-field">
          <label for="manual-reservation-quantity">枚数</label>
          <input type="number" id="manual-reservation-quantity" class="text-input" value="1" min="1" max="10" step="1" required${disabled}>
        </div>
        <div class="form-group">
          <label for="manual-reservation-contact">連絡先</label>
          <input type="text" id="manual-reservation-contact" class="text-input" maxlength="200"${disabled}>
        </div>
        <div class="form-group">
          <label for="manual-reservation-note">内部メモ</label>
          <textarea id="manual-reservation-note" class="textarea" rows="2" maxlength="2000"${disabled}></textarea>
        </div>
        <div id="manual-reservation-error" class="form-error" role="alert"></div>
        <button type="submit" class="btn btn-primary" id="manual-reservation-submit"${disabled}>${LIVE_UI_TEXT.manualSubmit}</button>
      </form>
    </section>

    <section id="live-postsave" class="live-postsave" aria-labelledby="live-postsave-title" hidden>
      <h3 id="live-postsave-title" class="live-postsave-title">${LIVE_UI_TEXT.postSaveTitle}</h3>
      <div id="live-postsave-preview" class="live-postsave-preview"></div>
      <button type="button" class="btn btn-primary" id="live-postsave-x-btn">${LIVE_UI_TEXT.announceX}</button>
      <button type="button" class="live-text-button" id="live-postsave-later-btn">${LIVE_UI_TEXT.later}</button>
    </section>

    <p id="live-editor-save-error" class="form-error" role="alert"></p>
    <footer class="live-editor-footer" id="live-editor-footer" hidden>
      <button type="button" class="btn btn-primary live-primary-action" id="live-editor-save-btn" onclick="saveLiveWorkspace()">${LIVE_UI_TEXT.savePublish}</button>
    </footer>
  `;
}

function setLiveEditorTask(task, options = {}) {
  if (liveWorkspaceSaveOperation) return false;
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

// A new Live starts on the source screen; the draft (or 手入力で作る) moves it to the fields to check.
function revealNewLivePublicFields() {
  const fields = document.getElementById('live-public-fields');
  if (!fields) return;
  if (liveEditorScreen === 'postsave') return;
  if (liveEditorScreen === 'source') setLiveEditorScreen('edit');
  fields.hidden = false;
  document.getElementById('edit-date')?.focus?.();
}

// Issue #46: the three screens of the editor. `source` (new Live: the source only), `edit` (the fields, and for an
// existing Live the 公開内容／告知／予約 switch), `postsave` (right after a new Live was saved: the announcement).
function setLiveEditorScreen(screen) {
  const next = ['source', 'edit', 'postsave'].includes(screen) ? screen : 'edit';
  liveEditorScreen = next;
  const isNew = Boolean(liveEditorOwner?.isNew);
  const setHidden = (id, hidden) => { const element = document.getElementById(id); if (element) element.hidden = hidden; };
  setHidden('live-editor-task-tabs', isNew || next !== 'edit');
  setHidden('live-editor-panel-public', next === 'postsave');
  if (isNew) {
    setHidden('live-source-intake', next !== 'source');
    setHidden('live-public-fields', next !== 'edit');
  }
  setHidden('live-postsave', next !== 'postsave');
  if (next === 'postsave') {
    setHidden('live-editor-panel-announcement', true);
    setHidden('live-editor-panel-reservation', true);
    renderLivePostSave();
  }
  document.getElementById('live-editor-pane')?.setAttribute?.('data-live-screen', next);
  setLiveEditorSaveStatus(liveEditorStatusText);
  syncLiveEditorFooter();
  return next;
}

// The announcement shown right after a new Live was saved (the same post text as the 告知 tab).
function renderLivePostSave() {
  updateXPreviewInModal();
  const target = document.getElementById('live-postsave-preview');
  if (target) target.textContent = String(document.getElementById('x-post-preview')?.value || '');
}

// Issue #46 stage 7: width 900px and above is a different arrangement of the same screens (the list on the left, the editor
// on the right, 保存して公開 on the right of the editor's heading). The layout itself is CSS; this reads the same media query.
const LIVE_WIDE_QUERY = '(min-width: 900px)';

function isWideLiveLayout() {
  try {
    return Boolean(window.matchMedia?.(LIVE_WIDE_QUERY)?.matches);
  } catch (_error) {
    return false;
  }
}

function bindLiveLayoutListener() {
  if (liveLayoutListenerBound) return false;
  const query = window.matchMedia?.(LIVE_WIDE_QUERY);
  if (!query || typeof query.addEventListener !== 'function') return false;
  liveLayoutListenerBound = true;
  query.addEventListener('change', syncLiveLayoutMode);
  return true;
}

// The width crossed 900px: apply the other arrangement to what is open (nothing is reset, nothing takes the focus).
function syncLiveLayoutMode() {
  if (liveEditorOwner) setLiveReservationView(liveReservationView, liveReservationDetailId, { focus: false });
  syncCrossReservationView({ focus: false });
  syncTicketSettingsActions();
  syncLiveEditorFooter();
  return isWideLiveLayout();
}

// 保存して公開. Width 899px and below: shown at the bottom only while the Live is unsaved (or saving / failed), never on the
// source and announcement screens. Width 900px and above: always in the heading of the editing screen, dimmed and not
// pressable while nothing is unsaved (the same for 公開内容・告知・予約).
function syncLiveEditorFooter() {
  const footer = document.getElementById('live-editor-footer');
  if (!footer) return;
  const wide = isWideLiveLayout();
  footer.hidden = wide ? liveEditorScreen !== 'edit' : !(liveEditorDirty && liveEditorScreen === 'edit' && liveReservationView === 'list');
  const button = document.getElementById('live-editor-save-btn');
  if (!button) return;
  if (wide && !liveEditorDirty && !liveWorkspaceSaveOperation) {
    if (!button.disabled) {
      button.disabled = true;
      button.dataset.idleDisabled = 'true';
    }
    button.setAttribute('aria-disabled', 'true');
  } else if (button.dataset.idleDisabled === 'true' && !liveWorkspaceSaveOperation) {
    button.disabled = false;
    delete button.dataset.idleDisabled;
    button.setAttribute('aria-disabled', 'false');
  }
}

function syncLiveEditingBody() {
  document.body?.classList?.[liveEditorOwner ? 'add' : 'remove']?.('is-live-editing');
}

function setLiveEditorHeading(text) {
  const heading = document.getElementById('live-editor-heading');
  if (!heading) return;
  heading.textContent = text;
  heading.setAttribute('title', text);
}

function setLiveReservationCount(value) {
  const target = document.getElementById('live-editor-reservation-count');
  if (target) target.textContent = value === null || value === undefined || value === '' ? '' : ` ${value}`;
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
  if (isNew) return LIVE_UI_TEXT.newLive;
  const date = getAdminLiveDisplayDate(item?.date);
  const venue = String(item?.venue || '').trim();
  return [date, venue].filter(Boolean).join(' ') || 'Live編集';
}

function setLiveEditorSaveStatus(status) {
  liveEditorStatusText = String(status || '');
  const target = document.getElementById('live-editor-save-status');
  if (target) target.textContent = (liveEditorScreen === 'source' || (liveReservationView !== 'list' && !isWideLiveLayout())) ? '' : liveEditorStatusText;
}

function setLiveEditorDirty(dirty, status = '') {
  liveEditorDirty = Boolean(dirty);
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = liveEditorDirty;
    saveBtn.title = liveEditorDirty ? 'Liveは編集画面の「保存して公開」から保存してください' : '';
  }
  setLiveEditorSaveStatus(status || (liveEditorDirty ? '未保存' : '保存済み'));
  syncLiveEditorFooter();
}

function markLiveEditorDirty() {
  if (!liveEditorOwner || !getLiveEditorRoot() || liveWorkspaceSaveOperation) return;
  liveEditorRevision += 1;
  setLiveEditorSaveError('');
  recomputeLiveEditorDirty();
}

// Issue #46: the editor is unsaved only while its values differ from the values it was opened (or last saved) with.
function recomputeLiveEditorDirty() {
  if (!liveEditorOwner) return false;
  const dirty = snapshotLiveEditor() !== liveEditorBaseline;
  setLiveEditorDirty(dirty, dirty ? LIVE_UI_TEXT.statusUnsaved : (liveEditorOwner.isNew ? '' : LIVE_UI_TEXT.statusSaved));
  return dirty;
}

function setLiveEditorInteractionLocked(locked, priorState = [], operation = null) {
  if (operation && liveWorkspaceSaveOperation !== operation) return priorState;
  const controlIds = [
    'saveBtn',
    'live-add-btn',
    'live-workspace-page-tab',
    'live-workspace-reservations-tab',
    'live-list-upcoming-tab',
    'live-list-past-tab',
    'live-ticket-settings-open',
    'live-ticket-settings-close',
    'live-editor-back',
  ];
  const editorControls = getLiveEditorRoot()?.querySelectorAll?.('button, input, textarea, select') || [];
  const controls = [
    ...controlIds.map((id) => document.getElementById(id)).filter(Boolean),
    ...Array.from(editorControls),
    ...Array.from(document.querySelectorAll('.tab-btn')),
    ...Array.from(document.querySelectorAll('[data-live-edit]')),
  ];
  const uniqueControls = [...new Set(controls)];

  if (locked) {
    const state = priorState;
    const trackedElements = new Set(state.map(({ element }) => element));
    uniqueControls.forEach((element) => {
      if (!trackedElements.has(element)) {
        state.push({ element, disabled: Boolean(element.disabled) });
      }
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
    });
    document.getElementById('live-editor-pane')?.setAttribute('aria-busy', 'true');
    return state;
  }

  priorState.forEach(({ element, disabled }) => {
    if (element?.isConnected === false) return;
    element.disabled = disabled;
    element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
  document.getElementById('live-editor-pane')?.setAttribute('aria-busy', 'false');
  return [];
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

function openLiveEditor(item, category, isNew, options = {}) {
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
  liveEditorRevision = 0;
  liveEditorOwner = {
    id: currentEditId,
    type: currentEditType,
    category,
    isNew: Boolean(isNew),
    generation: liveEditorGeneration,
  };
  applyLiveWorkspaceView('page');
  applyTicketSettingsOpen(false);
  applyLiveListView(category);
  liveEditorScreen = options.screen || (isNew ? 'source' : 'edit');
  liveEditorStatusText = '';
  liveReservationView = 'list';
  liveReservationDetailId = null;
  liveReservationFilter = '';
  liveReservationRows = [];
  root.innerHTML = buildLiveEditorHtml(item, category, isNew);
  document.getElementById('live-master-detail')?.classList.add('has-live-selection');
  const back = document.getElementById('live-editor-back');
  if (back) back.hidden = false;
  setLiveEditorHeading(getLiveEditorHeading(item, isNew));
  syncLiveEditingBody();
  syncLiveSelectionState();
  wireLiveOperationsModal();
  bindLiveEditorDirtyState();
  updateLiveCategoryWarning();
  liveEditorBaseline = snapshotLiveEditor();
  setLiveEditorSaveError('');
  setLiveEditorDirty(false, isNew ? '' : LIVE_UI_TEXT.statusSaved);
  setLiveEditorScreen(liveEditorScreen);
  syncFlyerSelectLabel();
  applyApiFallbackReadOnlyState();
  if (liveEditorScreen === 'postsave') {
    document.getElementById('live-postsave-x-btn')?.focus?.();
    return true;
  }
  const initialFocus = document.getElementById(isNew ? 'edit-sourceText' : 'edit-date') || root.querySelector(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
  );
  initialFocus?.focus?.();
  return true;
}

// Live追加
function addLive() {
  if (rejectApiFallbackMutation()) return false;
  return requestLiveEditorTransition(() => {
    isNewItem = true;
    currentEditType = 'live-upcoming';
    currentEditId = 'live-' + Date.now();
    return openLiveEditor({}, 'upcoming', true);
  });
}

// Live編集
function editLive(id, category) {
  if (liveWorkspaceSaveOperation) return false;
  const list = category === 'upcoming' ? siteData.live.upcoming : siteData.live.past;
  const item = list.find(l => l.id === id);
  if (!item) return false;
  if (liveEditorOwner?.type === `live-${category}` && String(liveEditorOwner?.id) === String(id)) return true;

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
  const closingOwner = liveEditorOwner;
  const returnFocus = liveEditorReturnFocus;
  const returnFocusLive = liveEditorReturnFocusLive;
  releaseImageUploadsForLiveOwner(closingOwner);
  liveEditorReturnFocus = null;
  liveEditorReturnFocusLive = null;
  liveEditorGeneration += 1;
  liveEditorRevision = 0;
  liveEditorOwner = null;
  liveReservationRequestSequence += 1;
  const root = getLiveEditorRoot();
  if (root) root.innerHTML = getLiveEditorEmptyHtml();
  document.getElementById('live-master-detail')?.classList.remove('has-live-selection');
  const back = document.getElementById('live-editor-back');
  if (back) back.hidden = true;
  setLiveEditorHeading('Liveを選択');
  liveEditorScreen = 'edit';
  liveReservationView = 'list';
  liveReservationDetailId = null;
  setLiveEditorSaveStatus('');
  liveEditorDirty = false;
  syncLiveEditingBody();
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.title = '';
  }
  if (closingOwner && currentEditType === closingOwner.type && String(currentEditId) === String(closingOwner.id)) {
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



// Live保存
function saveLiveItem() {
  if (rejectApiFallbackMutation()) return false;
  if (!liveEditorOwner) return null;
  const isPast = document.getElementById('edit-isPast').checked;
  const originalCategory = liveEditorOwner.category;
  const originalList = originalCategory === 'upcoming' ? siteData.live.upcoming : siteData.live.past;
  const originalIndex = originalList.findIndex(l => String(l.id) === String(liveEditorOwner.id));
  const originalItem = originalIndex === -1 ? {} : originalList[originalIndex];
  const operations = getLiveOperations();
  const editorDate = readLiveDateFromEditor();
  const normalizedDate = operations?.normalizeLiveDateInput(editorDate) || '';
  const item = {
    ...originalItem,
    id: liveEditorOwner.id,
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
  currentEditId = item.id;
  currentEditType = `live-${destinationCategory}`;
  isNewItem = false;
  liveEditorOwner.type = currentEditType;
  liveEditorOwner.category = destinationCategory;
  liveEditorOwner.isNew = false;

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
  if (liveWorkspaceSaveOperation) return false;
  if (!liveEditorOwner || !currentEditType?.startsWith('live') || !currentEditId) return false;
  if (rejectApiFallbackMutation('読み取り専用のためLiveを保存できません。')) return false;
  if (!ensureNoActiveImageUploads()) return false;
  if (!validateLiveEditor()) {
    setLiveEditorDirty(true, '未保存');
    return false;
  }

  const snapshot = {
    siteData: structuredClone(siteData),
    currentEditType,
    currentEditId,
    isNewItem,
    liveEditorOwner: { ...liveEditorOwner },
    liveEditorRevision,
    liveListView,
    liveWorkspaceView,
    liveTicketSettingsOpen,
    modalReturnFocusLive: modalReturnFocusLive ? { ...modalReturnFocusLive } : null,
    liveEditorReturnFocusLive: liveEditorReturnFocusLive ? { ...liveEditorReturnFocusLive } : null,
  };

  // The publish owns this exact editor revision. Older AI and reservation
  // responses must fail their generation/sequence checks from this point.
  liveEditorGeneration += 1;
  liveEditorOwner.generation = liveEditorGeneration;
  liveReservationRequestSequence += 1;
  const operation = {
    token: ++liveWorkspaceSaveSequence,
    generation: liveEditorGeneration,
    revision: liveEditorRevision,
    ownerId: String(liveEditorOwner.id),
    lockedControls: [],
  };
  liveWorkspaceSaveOperation = operation;
  setLiveEditorSaveError('');
  setLiveEditorSaveStatus(LIVE_UI_TEXT.statusSaving);
  operation.lockedControls = setLiveEditorInteractionLocked(true, operation.lockedControls, operation);

  const stillOwnsEditor = () => (
    liveWorkspaceSaveOperation === operation
    && liveEditorGeneration === operation.generation
    && liveEditorRevision === operation.revision
    && String(liveEditorOwner?.id || '') === operation.ownerId
  );

  const unlockOwnedOperation = () => {
    if (liveWorkspaceSaveOperation !== operation) return false;
    setLiveEditorInteractionLocked(false, operation.lockedControls, operation);
    liveWorkspaceSaveOperation = null;
    return true;
  };

  const rollback = (reason = '') => {
    const ownsEditor = stillOwnsEditor();
    siteData = snapshot.siteData;
    if (ownsEditor) {
      currentEditType = snapshot.currentEditType;
      currentEditId = snapshot.currentEditId;
      isNewItem = snapshot.isNewItem;
      liveEditorOwner = { ...snapshot.liveEditorOwner, generation: liveEditorGeneration };
      liveEditorRevision = snapshot.liveEditorRevision;
      liveListView = snapshot.liveListView;
      liveWorkspaceView = snapshot.liveWorkspaceView;
      liveTicketSettingsOpen = snapshot.liveTicketSettingsOpen;
      modalReturnFocusLive = snapshot.modalReturnFocusLive;
      liveEditorReturnFocusLive = snapshot.liveEditorReturnFocusLive;
    }
    renderLive();
    renderTicketsUi();
    if (ownsEditor) {
      syncLiveWorkspaceTabs();
      syncLiveListTabs();
      syncTicketSettingsPanel();
    }
    unlockOwnedOperation();
    if (!ownsEditor) return;
    const sourceButton = document.getElementById('live-source-parse-btn');
    if (sourceButton && activeLiveSourceIntakeOperation?.button !== sourceButton) {
      sourceButton.disabled = false;
      sourceButton.setAttribute('aria-disabled', 'false');
      sourceButton.textContent = LIVE_UI_TEXT.draftButton;
    }
    setLiveEditorDirty(true, LIVE_UI_TEXT.statusFailed);
    setLiveEditorSaveError(reason);
  };

  try {
    const result = saveLiveItem();
    if (!result) throw new Error('Live editor owner is unavailable');
    operation.lockedControls = setLiveEditorInteractionLocked(true, operation.lockedControls, operation);
    if (IS_API_MODE) {
      // Only this Live is layered onto the last loaded / saved content; unsaved changes in other tabs are not sent.
      await saveScoped((data) => applyLiveSlice(data, result.item, result.category), { fallbackBase: snapshot.siteData });
    } else {
      markChanged();
    }

    if (!stillOwnsEditor()) {
      unlockOwnedOperation();
      return false;
    }

    unlockOwnedOperation();
    if (IS_API_MODE) void loadReservationSummary();
    const taskBeforeSave = getSelectedLiveEditorTask();
    const wasNewLive = snapshot.isNewItem;
    // Only a new Live is followed by the announcement; an existing Live stays on what it was showing.
    openLiveEditor(result.item, result.category, false, { screen: wasNewLive ? 'postsave' : 'edit' });
    if (!wasNewLive && taskBeforeSave !== 'public') setLiveEditorTask(taskBeforeSave);
    setLiveEditorDirty(false, IS_API_MODE ? LIVE_UI_TEXT.statusSaved : 'JSON書き出し待ち');
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn && !IS_API_MODE) saveBtn.textContent = 'JSONを書き出す *';
    showToast(IS_API_MODE ? '保存しました' : '編集内容を反映しました。右上の「JSONを書き出す」で確定します', 'success');
    return true;
  } catch (error) {
    rollback(error.message);
    showToast(`保存に失敗しました: ${error.message}`, 'error');
    return false;
  }
}

async function deleteLiveFromWorkspace() {
  if (liveWorkspaceSaveOperation) return false;
  if (!liveEditorOwner || !currentEditType?.startsWith('live') || !currentEditId) return false;
  if (rejectApiFallbackMutation('読み取り専用のためLiveを削除できません。')) return false;

  const owner = { ...liveEditorOwner };
  const liveId = owner.id;
  if (owner.isNew) return false;
  const reservationCount = await resolveLiveReservationCount(liveId);
  if (!liveEditorOwner || String(liveEditorOwner.id) !== String(liveId) || liveWorkspaceSaveOperation) return false;
  const choice = await openLiveDialog({
    title: LIVE_UI_TEXT.deleteTitle,
    body: getLiveDeleteDialogBody(reservationCount),
    actions: [
      { id: 'cancel', label: LIVE_UI_TEXT.deleteCancel, safe: true, tone: 'secondary' },
      { id: 'delete', label: LIVE_UI_TEXT.deleteConfirm, tone: 'primary' },
    ],
  });
  if (choice !== 'delete') return false;
  if (!liveEditorOwner || String(liveEditorOwner.id) !== String(liveId) || liveWorkspaceSaveOperation) return false;

  const snapshot = { siteData: structuredClone(siteData) };
  liveEditorGeneration += 1;
  liveEditorOwner.generation = liveEditorGeneration;
  liveReservationRequestSequence += 1;
  const operation = {
    token: ++liveWorkspaceSaveSequence,
    generation: liveEditorGeneration,
    revision: liveEditorRevision,
    ownerId: String(liveId),
    lockedControls: [],
  };
  liveWorkspaceSaveOperation = operation;
  setLiveEditorSaveError('');
  setLiveEditorSaveStatus(LIVE_UI_TEXT.statusSaving);
  operation.lockedControls = setLiveEditorInteractionLocked(true, operation.lockedControls, operation);
  const unlock = () => {
    if (liveWorkspaceSaveOperation !== operation) return;
    setLiveEditorInteractionLocked(false, operation.lockedControls, operation);
    liveWorkspaceSaveOperation = null;
  };

  siteData.live.upcoming = siteData.live.upcoming.filter((live) => String(live.id) !== String(liveId));
  siteData.live.past = siteData.live.past.filter((live) => String(live.id) !== String(liveId));
  renderLive();
  renderTicketsUi();
  try {
    if (IS_API_MODE) {
      await saveScoped((data) => applyDeleteSlice(data, liveId), { fallbackBase: snapshot.siteData });
    } else {
      markChanged();
    }
  } catch (error) {
    siteData = snapshot.siteData;
    renderLive();
    renderTicketsUi();
    const stillOpen = liveWorkspaceSaveOperation === operation && String(liveEditorOwner?.id || '') === String(liveId);
    unlock();
    if (stillOpen) {
      syncLiveSelectionState();
      // The inputs were not touched by the delete: keep whatever was unsaved before it, and say it failed.
      recomputeLiveEditorDirty();
      setLiveEditorSaveStatus(LIVE_UI_TEXT.statusFailed);
      setLiveEditorSaveError(error.message);
    }
    showToast(`削除に失敗しました: ${error.message}`, 'error');
    return false;
  }
  unlock();
  closeLiveEditorImmediately();
  if (IS_API_MODE) void loadReservationSummary();
  showToast(
    IS_API_MODE ? '削除しました' : '削除内容を反映しました。右上の「JSONを書き出す」で確定します',
    'success'
  );
  return true;
}

// Issue #47: the generic edit modal is gone (News, works, videos, Site and Profile save from their own edit surfaces: saveOccPanel / deleteOccItem).
// What stays is the Live delete, which this name has always forwarded to.
function deleteItem() {
  if (rejectApiFallbackMutation()) return false;
  if (currentEditType?.startsWith('live')) return deleteLiveFromWorkspace();
  return false;
}

// 変更マーク
function markChanged() {
  if (isApiFallbackReadOnly) {
    applyApiFallbackReadOnlyState();
    return;
  }
  hasChanges = true;
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return;
  saveBtn.textContent = IS_API_MODE ? '保存 *' : 'JSONを書き出す *';
  saveBtn.classList.remove('saved');
  syncGlobalSaveButton();
}

function setSaveStateSaved(silent = false) {
  hasChanges = false;
  // Issue #47: what a surface saved in Local Mode was waiting for is exported now
  occPanels.forEach((panel) => { panel.localWaiting = false; });
  recomputeOccDirty();
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.textContent = '保存済';
    saveBtn.classList.add('saved');
  }
  syncGlobalSaveButton();

  if (!silent) {
    showToast('保存しました', 'success');
  }
  setTimeout(() => {
    if (saveBtn) saveBtn.textContent = IS_API_MODE ? '保存' : 'JSONを書き出す';
  }, 2000);
}

// Issue #47: the only caller is saveScoped, which always passes the slice it built. The default (siteData as it is) is kept for the
// T46-PIN (h) test seam; no screen and no header button reaches it any more (saveData sends nothing while the API is connected).
async function saveToApi(payloadOverride, options = {}) {
  if (rejectApiFallbackMutation()) return false;
  const snapshot = payloadOverride || window.MusicData.clearDanglingMusicReferences(siteData);
  const response = await adminFetch('/api/admin/site-data', {
    method: 'PUT',
    body: JSON.stringify(snapshot)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (currentEditType?.startsWith('discography')) {
      const field = payload.fields?.find(item => item.id === currentEditId && item.field === 'releaseDate');
      if (field) showReleaseDateError(field.message);
    }
    if (options.authReason && (response.status === 401 || response.status === 403)) throw new Error(LIVE_UI_TEXT.authFailed);
    throw new Error(getErrorMessage(payload, 'API保存に失敗しました'));
  }
  releaseDateBaseline = structuredClone(snapshot);
}


// データ保存 — the header 保存 of Local Mode only (JSONを書き出す). While the API is connected every page saves from its own
// 「保存して公開」 (saveOccPanel / saveLiveWorkspace / …); the whole of siteData is never sent, so this sends nothing and answers false.
async function saveData(options = {}) {
  if (IS_API_MODE) return false;
  if (isSaving) return false;
  if (!ensureNoActiveImageUploads()) return false;
  if (!validateMusicBeforeSave()) return false;
  const duplicateLiveIds = findDuplicateLiveIds(siteData);
  if (duplicateLiveIds.length > 0) {
    showToast(`保存できません: Live IDが重複しています: ${duplicateLiveIds.join(', ')}`, 'error');
    return false;
  }
  isSaving = true;
  const { silent = false } = options;
  const pendingCount = Object.keys(pendingImages).length;

  try {
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

function getLiveShareUrl(liveId) {
  const origin = String(CANONICAL_API_BASE_URL || '').replace(/\/+$/, '');
  const id = String(liveId || '').trim();
  return origin && id ? `${origin}/og/live/${encodeURIComponent(id)}` : '';
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
  previewEl.value = operations.buildXAnnouncementText(
    live,
    live.xComment,
    isNewItem ? '' : getLiveShareUrl(live.id),
  );
}

function setLiveSourceIntakeStatus(message) {
  const target = document.getElementById('live-source-warnings');
  if (!target) return;
  target.textContent = String(message || '');
}

// After a draft the source screen is hidden, so the one-line provider notice is also shown at the top of the fields to check (new Live only).
function setLiveDraftNotice(message) {
  const target = document.getElementById('live-draft-notice');
  if (target) target.textContent = String(message || '');
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

const LIVE_SOURCE_INTAKE_SUCCESS_MESSAGES = {
  openai: 'OpenAIで整理しました。内容を確認してから更新してください。',
  claude: 'Claudeで整理しました。内容を確認してから更新してください。',
};

function normalizeLiveSourceIntakePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const payloadKeys = Object.keys(payload);
  const hasProvider = Object.prototype.hasOwnProperty.call(payload, 'provider');
  if (
    !Object.prototype.hasOwnProperty.call(payload, 'draft')
    || payloadKeys.length !== (hasProvider ? 2 : 1)
    || payloadKeys.some((key) => key !== 'draft' && key !== 'provider')
  ) return null;
  if (hasProvider && payload.provider !== 'openai' && payload.provider !== 'claude') return null;

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
  return { draft: normalized, provider: hasProvider ? payload.provider : null };
}

async function handleLiveSourceParse() {
  const sourceElement = document.getElementById('edit-sourceText');
  const button = document.getElementById('live-source-parse-btn');
  if (liveWorkspaceSaveOperation) return false;
  if (rejectApiFallbackMutation('読み取り専用のためAI整理を実行できません。')) return false;
  if (!IS_API_MODE) {
    setLiveSourceIntakeStatus(LIVE_UI_TEXT.draftLocal);
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
    setLiveSourceIntakeStatus(LIVE_UI_TEXT.draftFailed);
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
  button.textContent = LIVE_UI_TEXT.draftRunning;
  setLiveSourceIntakeStatus(LIVE_UI_TEXT.draftRunning);

  try {
    const response = await adminFetch('/api/admin/live-source-intake', {
      method: 'POST',
      body: JSON.stringify({ sourceText }),
    }, { allowBaseFallback: false });
    if (!response?.ok) throw new Error('live source intake failed');
    const payload = await response.json();
    const intake = normalizeLiveSourceIntakePayload(payload);
    if (!intake) throw new Error('invalid live source intake payload');
    const { draft, provider } = intake;
    if (!ownsCurrentEditor()) return false;
    const inputChanged = (
      sourceElement.value !== requestInputSnapshot.sourceText
      || Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP).some((key) => (
        fieldElements[key].value !== requestInputSnapshot.fields[key]
      ))
    );
    if (inputChanged) {
      setLiveSourceIntakeStatus(LIVE_UI_TEXT.draftStale);
      return false;
    }

    rollbackSnapshot = {
      fields: Object.fromEntries(Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP).map((key) => [key, fieldElements[key].value])),
      preview: previewElement.value,
    };
    for (const key of Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP)) {
      fieldElements[key].value = draft[key];
    }
    updateXPreviewInModal();
    revealNewLivePublicFields();
    markLiveEditorDirty();
    const successMessage = provider
      ? LIVE_SOURCE_INTAKE_SUCCESS_MESSAGES[provider]
      : 'AIで整理しました。内容を確認してから更新してください。';
    setLiveSourceIntakeStatus(successMessage);
    setLiveDraftNotice(successMessage);
    return true;
  } catch (_error) {
    if (ownsCurrentEditor()) {
      if (rollbackSnapshot) {
        for (const key of Object.keys(LIVE_SOURCE_INTAKE_FIELD_MAP)) {
          fieldElements[key].value = rollbackSnapshot.fields[key];
        }
        previewElement.value = rollbackSnapshot.preview;
      }
      setLiveSourceIntakeStatus(LIVE_UI_TEXT.draftFailed);
    }
    return false;
  } finally {
    if (activeLiveSourceIntakeOperation === operation) {
      activeLiveSourceIntakeOperation = null;
    }
    if (document.getElementById('live-source-parse-btn') === button && !liveWorkspaceSaveOperation) {
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
      button.textContent = LIVE_UI_TEXT.draftButton;
    }
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

function setLiveCopyStatus(ok) {
  const target = document.getElementById('live-copy-status');
  if (target) target.textContent = ok ? LIVE_UI_TEXT.copied : LIVE_UI_TEXT.copyFailed;
}

async function copyXAnnouncementFromModal() {
  updateXPreviewInModal();
  const text = document.getElementById('x-post-preview')?.value || '';
  const ok = await copyToClipboard(text);
  setLiveCopyStatus(ok);
  return ok;
}

async function copyLiveLinkFromModal() {
  if (isNewItem || !currentEditId) return false;
  const shareUrl = getLiveShareUrl(currentEditId);
  if (!shareUrl) return false;
  const ok = await copyToClipboard(shareUrl);
  setLiveCopyStatus(ok);
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
  liveReservationRows = rows;
  rows.forEach(rememberReservation);
  const totals = calculateActiveReservationTotals(rows);
  const countOf = (status) => rows.filter((row) => row?.status === status).length;
  const visible = liveReservationFilter ? rows.filter((row) => row?.status === liveReservationFilter) : rows;
  const chip = (status) => {
    const selected = liveReservationFilter === status;
    return `<button type="button" class="reservation-chip${selected ? ' is-selected' : ''}" data-reservation-filter="${status}" aria-pressed="${selected}">${RESERVATION_STATUS_LABELS[status]} ${countOf(status)}</button>`;
  };
  target.innerHTML = `
    <div class="reservation-totals" aria-label="有効予約集計">
      <span class="reservation-total-seats"><strong>${totals.seats}</strong>枚</span>
      <span class="reservation-total-records">${totals.records}件</span>
    </div>
    <div class="reservation-filters" role="group" aria-label="状態で絞り込む">
      ${chip('pending')}${chip('handled')}${chip('cancelled')}
    </div>
    <div class="reservation-list">
      ${visible.length ? `${renderReservationTableHead()}${visible.map((row) => renderReservationRow(row, { scope: 'live' })).join('')}` : `<div class="empty-state"><p>${LIVE_UI_TEXT.noReservations}</p></div>`}
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
    const addButton = document.getElementById('live-reservation-add-btn');
    if (addButton) addButton.disabled = true;
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
    const addButton = document.getElementById('live-reservation-add-btn');
    if (addButton) addButton.disabled = true;
    return;
  }

  target.innerHTML = '<div class="empty-state"><p>予約台帳を読み込み中...</p></div>';
  try {
    const params = new URLSearchParams({ liveId: normalizedLiveId, limit: '200' });
    const response = await adminFetch(`/api/admin/ticket-reservations?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!ownsCurrentLedger()) return;
    if (!response.ok) throw adminResponseError(response, payload, '予約台帳を取得できませんでした');
    renderLiveReservationLedger(payload.reservations, target);
    if (liveReservationView === 'detail' && !reservationRowsById[String(liveReservationDetailId)]) setLiveReservationView('list');
    const ledgerTotals = calculateActiveReservationTotals(payload.reservations);
    liveLedgerSummary = { liveId: normalizedLiveId, records: ledgerTotals.records, seats: ledgerTotals.seats };
    setLiveReservationCount(ledgerTotals.seats);
  } catch (error) {
    if (!ownsCurrentLedger()) return;
    target.innerHTML = `<div class="empty-state operation-error"><p>${isAuthFailure(error) ? LIVE_UI_TEXT.authFailed : `取得失敗: ${escapeHtml(error.message)}`}</p></div>`;
  }
}

async function submitManualReservation() {
  const errorEl = document.getElementById('manual-reservation-error');
  const submit = document.getElementById('manual-reservation-submit');
  if (errorEl) errorEl.textContent = '';
  if (liveWorkspaceSaveOperation) return false;
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
    if (!response.ok) throw adminResponseError(response, result, '手動取り置きを追加できませんでした');
    if (nameEl) nameEl.value = '';
    if (quantityEl) quantityEl.value = '1';
    if (contactEl) contactEl.value = '';
    if (noteEl) noteEl.value = '';
    setLiveReservationView('list');
    await Promise.all([loadLiveReservations(currentEditId), loadTickets(), loadReservationSummary()]);
    showToast('手動取り置きを追加しました', 'success');
    return true;
  } catch (error) {
    if (errorEl) errorEl.textContent = describeAdminError(error);
    return false;
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = LIVE_UI_TEXT.manualSubmit;
    }
  }
}

// The category is a two-way choice; edit-isPast keeps the value (saveLiveItem and the tests read it).
function chooseLiveCategory(isPast) {
  const checkbox = document.getElementById('edit-isPast');
  if (!checkbox || liveWorkspaceSaveOperation) return false;
  if (rejectApiFallbackMutation('読み取り専用のため区分を変更できません。')) return false;
  checkbox.checked = Boolean(isPast);
  syncLiveCategoryChoice();
  updateLiveCategoryWarning();
  markLiveEditorDirty();
  return true;
}

function syncLiveCategoryChoice() {
  const isPast = Boolean(document.getElementById('edit-isPast')?.checked);
  [['live-category-upcoming', !isPast], ['live-category-past', isPast]].forEach(([id, selected]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.setAttribute('aria-pressed', String(selected));
    button.classList[selected ? 'add' : 'remove']('is-selected');
  });
}

function wireLiveOperationsModal() {
  bindLiveEditorTaskTabs();
  setLiveEditorTask('public');
  document.getElementById('live-source-parse-btn')?.addEventListener('click', handleLiveSourceParse);
  document.getElementById('live-manual-entry-btn')?.addEventListener('click', revealNewLivePublicFields);
  ['live-category-upcoming', 'live-category-past'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => chooseLiveCategory(id === 'live-category-past'));
  });
  document.getElementById('live-reservation-add-btn')?.addEventListener('click', () => { if (!rejectApiFallbackMutation('読み取り専用のため予約を追加できません。')) setLiveReservationView('add'); });
  document.getElementById('live-postsave-x-btn')?.addEventListener('click', openXIntentFromModal);
  document.getElementById('live-postsave-later-btn')?.addEventListener('click', () => { closeLiveEditor(); });
  document.getElementById('edit-date')?.addEventListener('input', updateLiveCategoryWarning);
  document.getElementById('edit-isPast')?.addEventListener('change', () => { syncLiveCategoryChoice(); updateLiveCategoryWarning(); });
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
  document.getElementById('x-link-copy-btn')?.addEventListener('click', copyLiveLinkFromModal);
  document.getElementById('manual-reservation-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitManualReservation();
  });
  updateXPreviewInModal();
  setLiveReservationCount(getInitialReservationCount());
  loadLiveReservations(currentEditId);
}

// Before the ledger is read the count comes from the list summary (upcoming only; blank for past or when it is unknown).
function getInitialReservationCount() {
  if (!liveEditorOwner || liveEditorOwner.isNew || liveEditorOwner.category !== 'upcoming') return '';
  if (reservationSummary.status !== 'ready') return '';
  return reservationSummary.byLiveId[String(liveEditorOwner.id)]?.seats ?? 0;
}

// JSONダウンロード
function downloadJson() {
  const snapshot = window.MusicData.clearDanglingMusicReferences(siteData);
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'site-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  releaseDateBaseline = structuredClone(snapshot);
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

// ===== Issue #46: confirmation surface, unsaved judgement, scoped save, Ticket Page settings ===========================

// Text shown by the Live / Ticket Page settings flows (design §10.2). Tests check the literal strings, not this table.
const LIVE_UI_TEXT = {
  statusSaved: '保存済み',
  statusUnsaved: '未保存',
  statusSaving: '保存しています…',
  statusFailed: '保存できませんでした',
  unsavedTitle: '保存していない変更があります。',
  unsavedDiscard: '破棄して移動',
  unsavedStay: '編集を続ける',
  deleteTitle: 'このライブを削除しますか。',
  deleteCancel: 'やめる',
  deleteConfirm: '削除する',
  deleteBodyNone: '削除すると公開画面からも消えます。',
  deleteBodyUnknown: '予約の件数を確認できませんでした。削除すると公開画面からも消えます。',
  authFailed: '認証できませんでした。',
  summaryFailed: '予約の数を読み込めませんでした。',
  saveFirst: '保存すると使えます。',
  savePublish: '保存して公開',
  taskPublic: '公開内容',
  taskAnnouncement: '告知',
  taskReservation: '予約',
  sourceLabel: '元情報',
  sourceRebuild: '元情報から作り直す',
  draftButton: '下書きを作る',
  draftRunning: '下書きを作っています…',
  draftFailed: '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。',
  draftStale: '入力が変更されたため反映しませんでした。もう一度下書きを作ってください。',
  draftLocal: '下書きの作成はAPI Modeで利用できます。元情報は変更されていません。',
  manualEntry: '手入力で作る',
  newLive: '新しいライブ',
  linksLabel: '予約先・リンクなど',
  categoryLabel: '区分',
  categoryUpcoming: '開催予定',
  categoryPast: '公演終了',
  deleteLink: 'このライブを削除',
  flyerLabel: 'フライヤー',
  flyerNone: '未選択',
  flyerChoose: '画像を選ぶ',
  flyerChange: '画像を変える',
  flyerRemove: '画像を外す',
  flyerUploading: 'アップロードしています…',
  flyerUploadFailed: '画像をアップロードできませんでした',
  announceX: 'Xで告知する',
  copyPost: '投稿文をコピー',
  copyLink: 'リンクをコピー',
  copied: 'コピーしました。',
  copyFailed: 'コピーできませんでした',
  postSaveTitle: '保存して公開しました。',
  later: 'あとで',
  manualTitle: '取り置きを追加',
  manualSubmit: '追加する',
  addReservation: '+ 取り置きを追加',
  noReservations: 'まだ予約はありません。',
  backList: '‹ 一覧',
  backReservation: '‹ 予約',
  backReservations: '‹ 予約管理',
};

const LIVE_EDITOR_DIRTY_FIELD_IDS = [
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
  'edit-image',
  'edit-ticketUrl',
  'edit-link',
  'edit-reservationClosed',
  'edit-isPast',
  'edit-xComment',
];

// --- confirmation surface (role="alertdialog") ---------------------------------------------------------------------
// openLiveDialog({ title, body, actions: [{ id, label, safe, tone }] }) resolves with the id of the chosen action.
// While it is open everything behind it is inert (it cannot be reached by tap, click or Tab); closing it restores the page.
// Escape and the backdrop choose the safe action (the one marked safe, else the first).
// A text body is one paragraph (the Live dialogs). A list of lines is one paragraph each (the delete confirmation of #47 adds a line).
function liveDialogBodyHtml(body) {
  if (Array.isArray(body)) {
    const lines = body.filter(Boolean);
    if (lines.length === 0) return '';
    return `<div id="live-dialog-body" class="occ-dialog-lines">${lines.map((line) => `<p class="live-dialog-body">${escapeHtml(line)}</p>`).join('')}</div>`;
  }
  return body ? `<p id="live-dialog-body" class="live-dialog-body">${escapeHtml(body)}</p>` : '';
}

function openLiveDialog({ title = '', body = '', actions = [] } = {}) {
  const overlay = document.getElementById('live-dialog-overlay');
  const dialog = document.getElementById('live-dialog');
  const safeAction = actions.find((action) => action.safe) || actions[0];
  if (!overlay || !dialog || !safeAction) return Promise.resolve(safeAction ? safeAction.id : null);
  if (liveDialog) closeLiveDialog(liveDialog.safeId);
  if (overlay.dataset.liveDialogBound !== 'true') {
    overlay.dataset.liveDialogBound = 'true';
    overlay.addEventListener('click', (event) => {
      if (liveDialog && event.target === overlay) closeLiveDialog(liveDialog.safeId);
    });
  }
  return new Promise((resolve) => {
    const returnFocus = document.activeElement || null;
    liveDialog = { resolve, safeId: safeAction.id, returnFocus, actionIds: actions.map((action) => action.id) };
    dialog.innerHTML = `
      <h3 id="live-dialog-title" class="live-dialog-title">${escapeHtml(title)}</h3>
      ${liveDialogBodyHtml(body)}
      <div class="live-dialog-actions">
        ${actions.map((action) => {
          const tone = action.tone ? `btn-${action.tone}` : (action.danger ? 'btn-danger' : (action.safe ? 'btn-secondary' : 'btn-primary'));
          return `<button type="button" class="btn ${tone}" id="live-dialog-action-${escapeHtml(action.id)}" data-live-dialog-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`;
        }).join('')}
      </div>`;
    actions.forEach((action) => {
      document.getElementById(`live-dialog-action-${action.id}`)?.addEventListener('click', () => closeLiveDialog(action.id));
    });
    overlay.hidden = false;
    setLiveDialogBackdropInert(true);
    document.getElementById(`live-dialog-action-${safeAction.id}`)?.focus?.();
  });
}

// Everything in #app except the confirmation surface (and the toast) is made inert while the surface is open.
function setLiveDialogBackdropInert(on) {
  const children = document.getElementById('app')?.children;
  if (!children) return;
  Array.from(children).forEach((child) => {
    if (child.id === 'live-dialog-overlay' || child.id === 'toast') return;
    if (on) child.setAttribute('inert', '');
    else child.removeAttribute('inert');
  });
}

function closeLiveDialog(choice) {
  const current = liveDialog;
  if (!current) return false;
  liveDialog = null;
  const overlay = document.getElementById('live-dialog-overlay');
  const dialog = document.getElementById('live-dialog');
  if (overlay) overlay.hidden = true;
  if (dialog) dialog.innerHTML = '';
  setLiveDialogBackdropInert(false);
  const { returnFocus } = current;
  if (returnFocus && typeof returnFocus.focus === 'function' && returnFocus.isConnected !== false) returnFocus.focus();
  current.resolve(choice);
  return true;
}

document.addEventListener('keydown', (event) => {
  if (!liveDialog) return;
  if (event.key === 'Escape') {
    event.preventDefault?.();
    closeLiveDialog(liveDialog.safeId);
    return;
  }
  if (event.key !== 'Tab') return;
  const ids = liveDialog.actionIds;
  const buttons = ids.map((id) => document.getElementById(`live-dialog-action-${id}`)).filter(Boolean);
  if (!buttons.length) return;
  event.preventDefault?.();
  const current = buttons.indexOf(document.activeElement);
  const next = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : (current + 1) % buttons.length;
  buttons[next].focus?.();
});

// --- unsaved judgement ---------------------------------------------------------------------------------------------
function snapshotLiveEditor() {
  return JSON.stringify(LIVE_EDITOR_DIRTY_FIELD_IDS.map((id) => {
    const element = document.getElementById(id);
    if (!element) return null;
    if (id === 'edit-date') return readLiveDateFromEditor();
    if (id === 'edit-reservationClosed' || id === 'edit-isPast') return Boolean(element.checked);
    return String(element.value ?? '');
  }));
}

function getSelectedLiveEditorTask() {
  const selected = Array.from(document.querySelectorAll('[data-live-editor-task]'))
    .find((tab) => tab.getAttribute('aria-selected') === 'true');
  return selected?.dataset.liveEditorTask || 'public';
}

function setLiveEditorSaveError(message) {
  const target = document.getElementById('live-editor-save-error');
  if (target) target.textContent = String(message || '');
}

// --- scoped save ----------------------------------------------------------------------------------------------------
// The PUT body is a copy of the last content that was loaded or saved (the baseline) with only this operation's target
// layered on, so unsaved changes in the other tabs (the header "保存" is still waiting for them) are never published.
function applyLiveSlice(data, item, category) {
  const id = String(item.id);
  data.live.upcoming = data.live.upcoming.filter((live) => String(live.id) !== id);
  data.live.past = data.live.past.filter((live) => String(live.id) !== id);
  (category === 'past' ? data.live.past : data.live.upcoming).unshift(structuredClone(item));
  return data;
}

function applyDeleteSlice(data, liveId) {
  const id = String(liveId);
  data.live.upcoming = data.live.upcoming.filter((live) => String(live.id) !== id);
  data.live.past = data.live.past.filter((live) => String(live.id) !== id);
  return data;
}

function applyTicketSlice(data, ticket) {
  data.ticket = structuredClone(ticket);
  return data;
}

function normalizeScopedSaveError(error) {
  const message = String(error?.message || '');
  if (message === '管理トークン未設定') return new Error(LIVE_UI_TEXT.authFailed);
  return error instanceof Error ? error : new Error(message || 'API保存に失敗しました');
}

async function saveScoped(applySlice, options = {}) {
  if (rejectApiFallbackMutation()) throw new Error('読み取り専用のため保存できません。');
  const base = structuredClone(releaseDateBaseline || options.fallbackBase || siteData);
  applySlice(base);
  const payload = window.MusicData.clearDanglingMusicReferences(base);
  const duplicateLiveIds = findDuplicateLiveIds(payload);
  if (duplicateLiveIds.length > 0) throw new Error(`Live IDが重複しています: ${duplicateLiveIds.join(', ')}`);
  if (isSaving) throw new Error('別の保存が進行中です。');
  isSaving = true;
  try {
    await saveToApi(payload, { authReason: true });
  } catch (error) {
    throw normalizeScopedSaveError(error);
  } finally {
    isSaving = false;
  }
  return payload;
}

function getSavedBaseline() {
  return releaseDateBaseline;
}

// --- delete confirmation ----------------------------------------------------------------------------------------------
// The number of active reservations: the ledger total when this Live's ledger is already loaded, else one read of the
// ledger. null means it could not be determined (the delete is still allowed). Local Mode has no reservation data.
async function resolveLiveReservationCount(liveId) {
  if (!IS_API_MODE) return 0;
  if (liveLedgerSummary && liveLedgerSummary.liveId === String(liveId)) return liveLedgerSummary.records;
  try {
    const params = new URLSearchParams({ liveId: String(liveId), limit: '200' });
    const response = await adminFetch(`/api/admin/ticket-reservations?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload.reservations)) return null;
    return calculateActiveReservationTotals(payload.reservations).records;
  } catch (error) {
    return null;
  }
}

function getLiveDeleteDialogBody(reservationCount) {
  if (reservationCount === null) return LIVE_UI_TEXT.deleteBodyUnknown;
  if (reservationCount > 0) return `予約が${reservationCount}件あります。${LIVE_UI_TEXT.deleteBodyNone}`;
  return LIVE_UI_TEXT.deleteBodyNone;
}

// --- Ticket Page common settings: draft, unsaved judgement and its own save --------------------------------------------
const TICKET_SETTINGS_INPUT_IDS = [
  'ticket-complete-text',
  'ticket-field-quantity',
  'ticket-field-message',
  'ticket-field-label-quantity',
  'ticket-field-label-message',
  'ticket-field-placeholder-message',
  'ticket-field-submit-label',
];

function readTicketSettingsDraft() {
  const read = (id) => document.getElementById(id);
  return {
    completeText: String(read('ticket-complete-text')?.value ?? ''),
    fields: {
      showQuantity: Boolean(read('ticket-field-quantity')?.checked),
      showMessage: Boolean(read('ticket-field-message')?.checked),
      labelQuantity: String(read('ticket-field-label-quantity')?.value ?? ''),
      labelMessage: String(read('ticket-field-label-message')?.value ?? ''),
      placeholderMessage: String(read('ticket-field-placeholder-message')?.value ?? ''),
      submitLabel: String(read('ticket-field-submit-label')?.value ?? ''),
    },
  };
}

function writeTicketSettingsInputs(ticket) {
  const write = (id, apply) => { const element = document.getElementById(id); if (element) apply(element); };
  write('ticket-complete-text', (element) => { element.value = ticket.completeText || ''; });
  write('ticket-field-quantity', (element) => { element.checked = Boolean(ticket.fields?.showQuantity); });
  write('ticket-field-message', (element) => { element.checked = Boolean(ticket.fields?.showMessage); });
  write('ticket-field-label-quantity', (element) => { element.value = ticket.fields?.labelQuantity || ''; });
  write('ticket-field-label-message', (element) => { element.value = ticket.fields?.labelMessage || ''; });
  write('ticket-field-placeholder-message', (element) => { element.value = ticket.fields?.placeholderMessage || ''; });
  write('ticket-field-submit-label', (element) => { element.value = ticket.fields?.submitLabel || ''; });
}

function snapshotTicketSettings(ticket) {
  const fields = ticket?.fields || {};
  return JSON.stringify([
    String(ticket?.completeText ?? ''),
    Boolean(fields.showQuantity),
    Boolean(fields.showMessage),
    String(fields.labelQuantity ?? ''),
    String(fields.labelMessage ?? ''),
    String(fields.placeholderMessage ?? ''),
    String(fields.submitLabel ?? ''),
  ]);
}

function isTicketSettingsDirty() {
  return Boolean(ticketSettingsDraft) && snapshotTicketSettings(ticketSettingsDraft) !== ticketSettingsBaseline;
}

function setTicketSettingsStatus(text) {
  const status = document.getElementById('ticket-settings-status');
  if (status) status.textContent = String(text || '');
}

function setTicketSettingsError(message) {
  const target = document.getElementById('ticket-settings-error');
  if (target) target.textContent = String(message || '');
}

function recomputeTicketDirty() {
  if (!ticketSettingsDraft) return false;
  ticketSettingsDraft = readTicketSettingsDraft();
  const dirty = isTicketSettingsDirty();
  syncTicketSettingsActions();
  if (!ticketSettingsSaving) setTicketSettingsStatus(dirty ? LIVE_UI_TEXT.statusUnsaved : LIVE_UI_TEXT.statusSaved);
  return dirty;
}

// Opening the settings (or reloading the data) starts from what is saved; edits stay in the draft until "保存して公開".
function resetTicketSettingsDraft() {
  if (!siteData?.ticket) return;
  writeTicketSettingsInputs(siteData.ticket);
  ticketSettingsDraft = readTicketSettingsDraft();
  ticketSettingsBaseline = snapshotTicketSettings(ticketSettingsDraft);
  setTicketSettingsError('');
  recomputeTicketDirty();
}

function discardTicketSettingsDraft() {
  resetTicketSettingsDraft();
}

function onTicketSettingsInput(control) {
  if (ticketSettingsSaving) return false;
  if (rejectApiFallbackMutation()) {
    if (ticketSettingsDraft) writeTicketSettingsInputs(ticketSettingsDraft);
    return false;
  }
  if (!ticketSettingsDraft) ticketSettingsDraft = readTicketSettingsDraft();
  setTicketSettingsError('');
  recomputeTicketDirty();
  return true;
}

async function saveTicketSettings() {
  if (ticketSettingsSaving || liveWorkspaceSaveOperation) return false;
  if (rejectApiFallbackMutation('読み取り専用のため保存できません。')) return false;
  if (!isTicketSettingsDirty()) return true;
  const draft = readTicketSettingsDraft();
  const previousTicket = structuredClone(siteData.ticket);
  ticketSettingsSaving = true;
  setTicketSettingsError('');
  setTicketSettingsStatus(LIVE_UI_TEXT.statusSaving);
  const controls = [...TICKET_SETTINGS_INPUT_IDS, 'ticket-settings-save-btn', 'live-ticket-settings-close']
    .map((id) => document.getElementById(id)).filter(Boolean);
  const priorDisabled = controls.map((control) => Boolean(control.disabled));
  controls.forEach((control) => { control.disabled = true; control.setAttribute('aria-disabled', 'true'); });
  const unlock = () => controls.forEach((control, index) => {
    control.disabled = priorDisabled[index];
    control.setAttribute('aria-disabled', priorDisabled[index] ? 'true' : 'false');
  });
  try {
    if (IS_API_MODE) {
      await saveScoped((data) => applyTicketSlice(data, draft), { fallbackBase: siteData });
      siteData.ticket = structuredClone(draft);
    } else {
      siteData.ticket = structuredClone(draft);
      markChanged();
    }
    ticketSettingsDraft = draft;
    ticketSettingsBaseline = snapshotTicketSettings(draft);
    ticketSettingsSaving = false;
    unlock();
    setTicketSettingsStatus(IS_API_MODE ? LIVE_UI_TEXT.statusSaved : 'JSON書き出し待ち');
    syncTicketSettingsActions();
    showToast(IS_API_MODE ? '保存しました' : '編集内容を反映しました。右上の「JSONを書き出す」で確定します', 'success');
    return true;
  } catch (error) {
    siteData.ticket = previousTicket;
    ticketSettingsSaving = false;
    unlock();
    setTicketSettingsStatus(LIVE_UI_TEXT.statusFailed);
    setTicketSettingsError(error.message);
    showToast(`保存に失敗しました: ${error.message}`, 'error');
    return false;
  }
}

function setupTicketSettingsSave() {
  const saveButton = document.getElementById('ticket-settings-save-btn');
  if (saveButton && saveButton.dataset.ticketSaveBound !== 'true') {
    saveButton.dataset.ticketSaveBound = 'true';
    saveButton.addEventListener('click', () => saveTicketSettings());
  }
}


// ===== Issue #47: the edit surfaces of the occasional updates (News, Music, Site, Profile) =====================================
// A surface is a list and an edit (News, Music works and videos) or one screen (Site, Profile, the Channel URL of the videos). What is
// typed lives in the inputs of the surface only; siteData is written when a save succeeds.
// occPanels holds, per surface, what the unsaved judgement needs: read() the inputs, the baseline they were opened with (or last
// saved with), dirty and saving. A save is a saveScoped(): the last saved content with only this surface's target layered on.
//   key 'item'    the open News / work / video      (occActiveItem says which)
//   key 'channel' the Channel URL of the videos
//   key 'site'    the Site screen
//   key 'profile' the Profile screen

const OCC_UI = {
  newsHeadingEdit: 'お知らせを編集',
  newsHeadingNew: '新しいお知らせ',
  releaseHeadingEdit: '作品を編集',
  releaseHeadingNew: '新しい作品',
  videoHeadingEdit: '映像を編集',
  videoHeadingNew: '新しい映像',
  untitled: '（題なし）',
  emptyList: 'まだ登録がありません。',
  deleteNews: 'このお知らせを削除',
  deleteRelease: 'この作品を削除',
  deleteVideo: 'この映像を削除',
  deleteTitleNews: 'このお知らせを削除しますか。',
  deleteTitleRelease: 'この作品を削除しますか。',
  deleteTitleVideo: 'この映像を削除しますか。',
  deleteBody: '削除すると公開画面からも消えます。',
  featuredResets: '顔にする作品は「自動（最新のリリース）」に戻ります。',
  playbackResets: (count) => `再生する映像に選んでいる作品が${count}件あります。「選ばない」に戻り、公開画面では「聴く」が出なくなります。`,
  invalidYouTube: 'YouTube URL / ID が不正です（IDは11文字）',
  localWaiting: 'JSON書き出し待ち',
  localSaved: '編集内容を反映しました。右上の「JSONを書き出す」で確定します',
  localDeleted: '削除内容を反映しました。右上の「JSONを書き出す」で確定します',
  musicTitleWorks: '作品',
  musicTitleVideos: '映像',
  digital: 'Digital Release',
  demo: '宅録Demo',
  musicVideos: 'Music Video',
  liveMovies: 'Live Movie',
  demos: 'Demo',
};

const OCC_NEWS_FIELDS = ['date', 'title', 'description', 'image', 'link', 'linkText'];
const OCC_RELEASE_FIELDS = ['category', 'title', 'releaseDate', 'description', 'image', 'link', 'releaseType', 'playbackVideoId'];
const OCC_VIDEO_FIELDS = ['category', 'title', 'youtube'];
const OCC_SITE_FIELDS = ['featuredReleaseId', 'heroImage', 'bandcamp', 'youtube', 'x', 'instagram', 'note', 'footerText', 'contactIntro', 'contactAction'];
// Where each Site field lives in the data (the keys a Site save layers onto the baseline).
const OCC_SITE_PATHS = {
  featuredReleaseId: ['site', 'featuredReleaseId'],
  heroImage: ['site', 'heroImage'],
  bandcamp: ['site', 'links', 'bandcamp'],
  youtube: ['site', 'links', 'youtube'],
  x: ['site', 'links', 'x'],
  instagram: ['site', 'links', 'instagram'],
  note: ['site', 'links', 'note'],
  footerText: ['site', 'footerText'],
  contactIntro: ['contact', 'introText'],
  contactAction: ['contact', 'formAction'],
};
// The input of each Site field.
const OCC_SITE_INPUT_IDS = {
  featuredReleaseId: 'site-featured-release-id',
  heroImage: 'site-hero-image',
  bandcamp: 'site-link-bandcamp',
  youtube: 'site-link-youtube',
  x: 'site-link-x',
  instagram: 'site-link-instagram',
  note: 'site-link-note',
  footerText: 'site-footer-text',
  contactIntro: 'contact-intro-text',
  contactAction: 'contact-form-action',
};
// The pictures of the screens that are not item edits: the input that holds the path → the panel it belongs to.
const OCC_PAGE_IMAGE_PANELS = { 'site-hero-image': 'site', 'profile-image': 'profile' };

function occElement(id) {
  return document.getElementById(id);
}

function occString(id) {
  return String(occElement(id)?.value ?? '');
}

// The surface (its ids start with this) an item kind is edited on.
function occPrefixOf(kind) {
  return kind === 'news' ? 'news' : 'music';
}

function occItemPrefix() {
  return occPrefixOf(occActiveItem?.kind || 'news');
}

// The prefix of the ids of a panel's status / error / actions / save button.
function occPanelPrefix(key) {
  return key === 'item' ? occItemPrefix() : key;
}

// --- slices: what a save layers onto the saved baseline -------------------------------------------------------------------
// An existing item is replaced where it stands; an item the baseline does not have (a new one) goes to the head. Ids are compared
// as text, because the list hands an id over as text and production's ids are not all strings.
function applyNewsSlice(data, item) {
  const id = String(item.id);
  const index = data.news.findIndex((candidate) => String(candidate.id) === id);
  if (index === -1) data.news.unshift(structuredClone(item));
  else data.news[index] = structuredClone(item);
  return data;
}

// A work / a video leaves the category it was edited from and goes to the head of the category it is saved to (also when that is the
// same one: a save moves the item to the head, as it always has).
function applyReleaseSlice(data, item, category, originalCategory) {
  const id = String(item.id);
  const original = originalCategory === 'digital' ? data.discography.digital : data.discography.demo;
  const index = original.findIndex((candidate) => String(candidate.id) === id);
  if (index !== -1) original.splice(index, 1);
  (category === 'digital' ? data.discography.digital : data.discography.demo).unshift(structuredClone(item));
  return data;
}

function applyVideoSlice(data, item, category, originalCategory) {
  const id = String(item.id);
  const original = data.youtube[originalCategory] || [];
  const index = original.findIndex((candidate) => String(candidate.id) === id);
  if (index !== -1) original.splice(index, 1);
  if (!data.youtube[category]) data.youtube[category] = [];
  data.youtube[category].unshift(structuredClone(item));
  return data;
}

// A delete removes one item. For a work / a video the category it was opened from may be given (then only that list is touched, as the
// old delete did); without it every list is.
function applyOccDeleteSlice(data, kind, id, category = null) {
  const target = String(id);
  const keep = (candidate) => String(candidate.id) !== target;
  if (kind === 'news') data.news = data.news.filter(keep);
  if (kind === 'release') {
    (category ? [category] : ['digital', 'demo']).forEach((name) => {
      if (Array.isArray(data.discography[name])) data.discography[name] = data.discography[name].filter(keep);
    });
  }
  if (kind === 'video') {
    (category ? [category] : ['musicVideos', 'liveMovies', 'demos']).forEach((name) => {
      if (Array.isArray(data.youtube[name])) data.youtube[name] = data.youtube[name].filter(keep);
    });
  }
  return data;
}

function setOccPath(data, path, value) {
  let target = data;
  path.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  });
  target[path[path.length - 1]] = value;
}

// Site, Profile and the Channel URL layer only the fields that differ from what the screen was opened (or last saved) with: a field that
// was not touched is not written (so a key the data never had is not added, and the order of the keys is the data's own).
function applySiteSlice(data, draft) {
  Object.entries(draft.changes).forEach(([field, value]) => setOccPath(data, OCC_SITE_PATHS[field], value));
  return data;
}

function applyProfileSlice(data, draft) {
  if (!data.profile || typeof data.profile !== 'object') data.profile = {};
  Object.entries(draft.changes).forEach(([field, value]) => { data.profile[field] = structuredClone(value); });
  return data;
}

function applyChannelSlice(data, draft) {
  if (!data.youtube || typeof data.youtube !== 'object') data.youtube = {};
  if (Object.prototype.hasOwnProperty.call(draft.changes, 'channelUrl')) data.youtube.channelUrl = draft.changes.channelUrl;
  return data;
}

// --- News: the inputs ------------------------------------------------------------------------------------------------
function readNewsFields() {
  const read = (id) => String(occElement(`edit-${id}`)?.value ?? '');
  return Object.fromEntries(OCC_NEWS_FIELDS.map((field) => [field, read(field)]));
}

// The body of a save: the seven keys of a News item, in the order they have always been saved in.
function readNewsDraft() {
  const fields = readNewsFields();
  return {
    id: occActiveItem.id,
    date: fields.date,
    title: fields.title,
    description: fields.description,
    image: fields.image,
    link: fields.link,
    linkText: fields.linkText,
  };
}

function snapshotFields(order, fields) {
  return JSON.stringify(order.map((field) => String(fields[field] ?? '')));
}

function snapshotNewsFields(fields) {
  return snapshotFields(OCC_NEWS_FIELDS, fields);
}

function writeNewsFields(fields) {
  ['date', 'title', 'description', 'link', 'linkText'].forEach((field) => {
    const control = occElement(`edit-${field}`);
    if (control) control.value = String(fields[field] ?? '');
  });
  setOccImageValue('edit-image', fields.image);
}

function buildNewsEditorHtml(item, isNew) {
  const value = (raw) => escapeHtml(String(raw ?? ''));
  return `
    <div class="form-group occ-field">
      <label for="edit-date">日付</label>
      <input type="text" id="edit-date" class="text-input" data-admin-mutation="" value="${value(item.date)}" placeholder="2025/1/1(Mon.)">
    </div>
    <div class="form-group occ-field">
      <label for="edit-title">タイトル</label>
      <input type="text" id="edit-title" class="text-input" data-admin-mutation="" value="${value(item.title)}" placeholder="ニュースタイトル">
    </div>
    <div class="form-group occ-field">
      <label for="edit-description">説明</label>
      <textarea id="edit-description" class="textarea" data-admin-mutation="" rows="3" placeholder="詳細説明">${value(item.description)}</textarea>
    </div>
    ${getOccImageFormHtml(item.image || '', 'edit-image')}
    <div class="form-group occ-field">
      <label for="edit-link">詳細リンクURL</label>
      <input type="url" id="edit-link" class="text-input" data-admin-mutation="" value="${value(item.link)}" placeholder="https://...">
    </div>
    <div class="form-group occ-field">
      <label for="edit-linkText">リンクテキスト</label>
      <input type="text" id="edit-linkText" class="text-input" data-admin-mutation="" value="${value(item.linkText)}" placeholder="view...">
    </div>
    ${isNew ? '' : `<div class="occ-editor-ops"><button type="button" class="occ-delete" id="news-delete-btn" data-admin-mutation="">${OCC_UI.deleteNews}</button></div>`}
  `;
}

// --- Music: the inputs of a work and of a video -------------------------------------------------------------------------
function readReleaseFields() {
  return Object.fromEntries(OCC_RELEASE_FIELDS.map((field) => [field, occString(field === 'category' ? 'edit-category' : `edit-${field}`)]));
}

// The body of a save of a work: the eight keys it has always been saved with, in that order. A date that was not a text (or was missing)
// and was not touched stays as it was (a work without a date is saved without the key, as before).
function readReleaseDraft() {
  const fields = readReleaseFields();
  const item = {
    id: occActiveItem.id,
    title: fields.title,
    releaseDate: fields.releaseDate,
    description: fields.description,
    image: fields.image,
    link: fields.link,
    releaseType: fields.releaseType,
    playbackVideoId: fields.playbackVideoId,
  };
  const previous = musicReleases(siteData).find((old) => String(old.id) === String(item.id));
  if (previous && typeof previous.releaseDate !== 'string' && item.releaseDate === String(previous.releaseDate ?? '')) item.releaseDate = previous.releaseDate;
  return { item, category: fields.category === 'demo' ? 'demo' : 'digital', originalCategory: occActiveItem.category || 'digital' };
}

function readVideoFields() {
  return Object.fromEntries(OCC_VIDEO_FIELDS.map((field) => [field, occString(field === 'category' ? 'edit-category' : `edit-${field}`)]));
}

// The body of a save of a video: id, title and the 11 characters of the YouTube id (a URL typed in is turned into it).
function readVideoDraft() {
  const fields = readVideoFields();
  const category = ['musicVideos', 'liveMovies', 'demos'].includes(fields.category) ? fields.category : 'musicVideos';
  return {
    item: { id: occActiveItem.id, title: fields.title, youtubeId: getYouTubeVideoId(fields.youtube) },
    category,
    originalCategory: occActiveItem.category || 'musicVideos',
  };
}

function writeReleaseFields(fields) {
  ['category', 'title', 'releaseDate', 'description', 'link', 'releaseType'].forEach((field) => {
    const control = occElement(field === 'category' ? 'edit-category' : `edit-${field}`);
    if (control) control.value = String(fields[field] ?? '');
  });
  const playback = occElement('edit-playbackVideoId');
  if (playback) playback.value = String(fields.playbackVideoId ?? '');
  setOccImageValue('edit-image', fields.image);
  clearReleaseDateError();
}

function writeVideoFields(fields) {
  ['category', 'title'].forEach((field) => {
    const control = occElement(field === 'category' ? 'edit-category' : `edit-${field}`);
    if (control) control.value = String(fields[field] ?? '');
  });
  const youtube = occElement('edit-youtube');
  if (youtube) youtube.value = String(fields.youtube ?? '');
  clearVideoIdError();
}

function clearReleaseDateError() {
  const field = occElement('edit-releaseDate');
  const error = occElement('edit-releaseDate-error');
  if (field) field.setAttribute('aria-invalid', 'false');
  if (error) error.textContent = '';
}

function clearVideoIdError() {
  const field = occElement('edit-youtube');
  const error = occElement('edit-youtube-error');
  if (field) field.setAttribute('aria-invalid', 'false');
  if (error) error.textContent = '';
}

function showVideoIdError(message = OCC_UI.invalidYouTube) {
  const field = occElement('edit-youtube');
  const error = occElement('edit-youtube-error');
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', 'edit-youtube-error');
    field.focus?.();
  }
  if (error) error.textContent = message;
}

function occCategoryOptions(options, selected) {
  return options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
}

function buildReleaseEditorHtml(item, category, isNew) {
  const value = (raw) => escapeHtml(String(raw ?? ''));
  const releaseDate = String(item.releaseDate ?? '');
  return `
    <div class="form-group occ-field">
      <label for="edit-category">カテゴリ</label>
      <select id="edit-category" class="select" data-admin-mutation="">${occCategoryOptions([['digital', OCC_UI.digital], ['demo', OCC_UI.demo]], category)}</select>
    </div>
    <div class="form-group occ-field">
      <label for="edit-title">タイトル</label>
      <input type="text" id="edit-title" class="text-input" data-admin-mutation="" value="${value(item.title)}" placeholder='1st.Single "xxx"'>
    </div>
    <div class="form-group occ-field">
      <label for="edit-releaseDate">リリース日</label>
      <input type="text" id="edit-releaseDate" class="text-input" data-admin-mutation="" value="${value(releaseDate)}" placeholder="2025.05.05" aria-invalid="false" aria-describedby="edit-releaseDate-error">
      <div id="edit-releaseDate-error" class="form-error" role="alert"></div>
    </div>
    <div class="form-group occ-field">
      <label for="edit-description">説明（曲リスト等）</label>
      <textarea id="edit-description" class="textarea" data-admin-mutation="" rows="4" placeholder="1. xxx&#10;2. yyy">${value(item.description)}</textarea>
    </div>
    ${getOccImageFormHtml(item.image || '', 'edit-image', { label: '画像（ジャケット）', variant: 'square' })}
    <div class="form-group occ-field">
      <label for="edit-link">リンクURL</label>
      <input type="url" id="edit-link" class="text-input" data-admin-mutation="" value="${value(item.link)}" placeholder="https://...">
    </div>
    <div class="form-group occ-field">
      <label for="edit-releaseType">種別</label>
      <input type="text" id="edit-releaseType" class="text-input" data-admin-mutation="" placeholder="2nd Single" value="${value(item.releaseType)}">
    </div>
    <div class="form-group occ-field">
      <label for="edit-playbackVideoId">その場で再生する映像</label>
      <select id="edit-playbackVideoId" class="select" data-admin-mutation="">${playbackVideoOptions(item.playbackVideoId || '')}</select>
    </div>
    ${isNew ? '' : `<div class="occ-editor-ops"><button type="button" class="occ-delete" id="music-delete-btn" data-admin-mutation="">${OCC_UI.deleteRelease}</button></div>`}
  `;
}

function buildVideoEditorHtml(item, category, isNew) {
  const value = (raw) => escapeHtml(String(raw ?? ''));
  return `
    <div class="form-group occ-field">
      <label for="edit-category">カテゴリ</label>
      <select id="edit-category" class="select" data-admin-mutation="">${occCategoryOptions([['musicVideos', OCC_UI.musicVideos], ['liveMovies', OCC_UI.liveMovies], ['demos', OCC_UI.demos]], category)}</select>
    </div>
    <div class="form-group occ-field">
      <label for="edit-title">タイトル</label>
      <input type="text" id="edit-title" class="text-input" data-admin-mutation="" value="${value(item.title)}" placeholder="例: - 月を待って -">
    </div>
    <div class="form-group occ-field">
      <label for="edit-youtube">YouTube URL / ID</label>
      <input type="text" id="edit-youtube" class="text-input" data-admin-mutation="" value="${value(item.youtubeId)}" placeholder="https://youtu.be/... または 11文字のID" aria-invalid="false" aria-describedby="edit-youtube-error">
      <div id="edit-youtube-error" class="form-error" role="alert"></div>
    </div>
    ${isNew ? '' : `<div class="occ-editor-ops"><button type="button" class="occ-delete" id="music-delete-btn" data-admin-mutation="">${OCC_UI.deleteVideo}</button></div>`}
  `;
}

// What each kind of item is: how its inputs are read and written, what a save of it layers onto the baseline, and what a successful save
// leaves in siteData.
const OCC_ITEM_KINDS = {
  news: {
    order: OCC_NEWS_FIELDS,
    read: readNewsFields,
    write: writeNewsFields,
    draft: readNewsDraft,
    slice: (data, draft) => applyNewsSlice(data, draft),
    controlIds: ['edit-date', 'edit-title', 'edit-description', 'edit-link', 'edit-linkText'],
    firstFocus: 'edit-date',
    deleteId: 'news-delete-btn',
  },
  release: {
    order: OCC_RELEASE_FIELDS,
    read: readReleaseFields,
    write: writeReleaseFields,
    draft: readReleaseDraft,
    slice: (data, draft) => applyReleaseSlice(data, draft.item, draft.category, draft.originalCategory),
    controlIds: ['edit-category', 'edit-title', 'edit-releaseDate', 'edit-description', 'edit-link', 'edit-releaseType', 'edit-playbackVideoId'],
    firstFocus: 'edit-category',
    deleteId: 'music-delete-btn',
    validate: (draft) => {
      if (releaseDateIsAllowed(draft.item)) return true;
      showReleaseDateError();
      return false;
    },
  },
  video: {
    order: OCC_VIDEO_FIELDS,
    read: readVideoFields,
    write: writeVideoFields,
    draft: readVideoDraft,
    slice: (data, draft) => applyVideoSlice(data, draft.item, draft.category, draft.originalCategory),
    controlIds: ['edit-category', 'edit-title', 'edit-youtube'],
    firstFocus: 'edit-category',
    deleteId: 'music-delete-btn',
    validate: (draft) => {
      if (draft.item.youtubeId) return true;
      showVideoIdError();
      return false;
    },
  },
};

function makeOccPanel(key, spec) {
  const values = spec.read();
  return {
    key,
    kind: spec.kind,
    order: spec.order,
    read: spec.read,
    write: spec.write,
    draft: spec.draft,
    slice: spec.slice,
    commit: spec.commit,
    lockables: spec.lockables,
    snapshot: () => spec.snapshot(spec.read()),
    baselineValues: spec.clone ? spec.clone(values) : { ...values },
    baseline: spec.snapshot(values),
    clone: spec.clone,
    snapshotOf: spec.snapshot,
    dirty: false,
    saving: false,
    localWaiting: false,
    imageInputIds: spec.imageInputIds || [],
    extra: spec.extra || null,
  };
}

function makeOccItemPanel(kind) {
  const item = OCC_ITEM_KINDS[kind];
  const lockables = () => {
    const prefix = occPrefixOf(kind);
    const body = occElement(`${prefix}-editor-body`);
    return [
      ...[`${prefix}-editor-back`, `${prefix}-add-btn`, `${prefix}-save-btn`].map(occElement).filter(Boolean),
      ...Array.from(body?.querySelectorAll?.('button, input, textarea, select') || []),
    ];
  };
  return makeOccPanel('item', {
    kind,
    order: item.order,
    read: item.read,
    write: item.write,
    draft: item.draft,
    slice: item.slice,
    commit: (draft) => commitOccItemToSiteData(kind, draft),
    snapshot: (fields) => snapshotFields(item.order, fields),
    lockables,
    imageInputIds: ['edit-image'],
  });
}

// What a successful save of an item leaves behind: the saved item is in siteData (through the same reconciliation as every save).
// siteData holds nothing of what was typed before this.
function commitOccItemToSiteData(kind, draft) {
  const next = structuredClone(siteData);
  OCC_ITEM_KINDS[kind].slice(next, draft);
  siteData = window.MusicData.clearDanglingMusicReferences(next);
}

function commitNewsToSiteData(draft) {
  commitOccItemToSiteData('news', draft);
}

// --- Site, Profile and the Channel URL: one screen each --------------------------------------------------------------------
let occProfileLinkSources = [];

function readSiteFields() {
  return Object.fromEntries(OCC_SITE_FIELDS.map((field) => [field, occString(OCC_SITE_INPUT_IDS[field])]));
}

function writeSiteFields(fields) {
  OCC_SITE_FIELDS.forEach((field) => {
    if (field === 'heroImage') return;
    const control = occElement(OCC_SITE_INPUT_IDS[field]);
    if (control) control.value = String(fields[field] ?? '');
  });
  setOccImageValue('site-hero-image', fields.heroImage);
}

// What differs from the values the screen was opened (or last saved) with, in the order of the fields. Only this is layered onto the baseline.
function draftOfChangedFields(order, fields, baselineValues) {
  const changes = {};
  order.forEach((field) => {
    if (String(fields[field] ?? '') !== String(baselineValues[field] ?? '')) changes[field] = String(fields[field] ?? '');
  });
  return { changes };
}

function makeSitePanel() {
  const panel = makeOccPanel('site', {
    kind: 'site',
    order: OCC_SITE_FIELDS,
    read: readSiteFields,
    write: writeSiteFields,
    snapshot: (fields) => snapshotFields(OCC_SITE_FIELDS, fields),
    draft: (self) => draftOfChangedFields(OCC_SITE_FIELDS, readSiteFields(), self.baselineValues),
    slice: (data, draft) => applySiteSlice(data, draft),
    commit: (draft) => commitOccPageToSiteData('site', draft),
    lockables: () => [
      ...Object.values(OCC_SITE_INPUT_IDS).map(occElement).filter(Boolean),
      occElement('site-save-btn'),
      ...Array.from(occElement('site-hero-image-form')?.querySelectorAll?.('button, input, textarea, select') || []),
    ].filter(Boolean),
    imageInputIds: ['site-hero-image'],
  });
  return panel;
}

function readProfileFields() {
  return {
    text: occString('profile-text'),
    image: occString('profile-image'),
    links: occProfileLinkSources.map((source, index) => ({
      name: occString(`profile-link-${index}-name`),
      url: occString(`profile-link-${index}-url`),
      source,
    })),
  };
}

function snapshotProfileFields(fields) {
  return JSON.stringify([String(fields.text ?? ''), String(fields.image ?? ''), (fields.links || []).map((link) => [String(link.name ?? ''), String(link.url ?? '')])]);
}

function cloneProfileFields(fields) {
  return { text: fields.text, image: fields.image, links: (fields.links || []).map((link) => ({ ...link })) };
}

function writeProfileFields(fields) {
  const text = occElement('profile-text');
  if (text) text.value = String(fields.text ?? '');
  setOccImageValue('profile-image', fields.image);
  const rows = (fields.links || []).map((link) => ({ ...link }));
  const sameRows = rows.length === occProfileLinkSources.length && rows.every((row, index) => row.source === occProfileLinkSources[index]);
  if (!sameRows) {
    renderProfileLinkRows(rows);
    return;
  }
  // the same rows: the inputs take the values, they are not drawn again
  rows.forEach((row, index) => {
    const name = occElement(`profile-link-${index}-name`);
    const url = occElement(`profile-link-${index}-url`);
    if (name) name.value = String(row.name ?? '');
    if (url) url.value = String(row.url ?? '');
  });
}

function makeProfilePanel() {
  const panel = makeOccPanel('profile', {
    kind: 'profile',
    order: ['text', 'image', 'links'],
    read: readProfileFields,
    write: writeProfileFields,
    snapshot: snapshotProfileFields,
    clone: cloneProfileFields,
    draft: (self) => {
      const fields = readProfileFields();
      const changes = {};
      if (fields.text !== self.baselineValues.text) changes.text = fields.text;
      if (fields.image !== self.baselineValues.image) changes.image = fields.image;
      if (JSON.stringify(fields.links.map((link) => [link.name, link.url])) !== JSON.stringify(self.baselineValues.links.map((link) => [link.name, link.url]))) {
        // A row that was there keeps the keys it had besides name and url; a new row is { name, url }.
        changes.links = fields.links.map((link) => (link.source >= 0 && self.extra.sourceLinks[link.source]
          ? { ...self.extra.sourceLinks[link.source], name: link.name, url: link.url }
          : { name: link.name, url: link.url }));
      }
      return { changes };
    },
    slice: (data, draft) => applyProfileSlice(data, draft),
    commit: (draft) => commitOccPageToSiteData('profile', draft),
    lockables: () => [
      occElement('profile-text'),
      occElement('profile-link-add-btn'),
      occElement('profile-save-btn'),
      ...Array.from(occElement('profile-image-form')?.querySelectorAll?.('button, input, textarea, select') || []),
      ...Array.from(occElement('profile-links-list')?.querySelectorAll?.('button, input, textarea, select') || []),
    ].filter(Boolean),
    imageInputIds: ['profile-image'],
    extra: { sourceLinks: structuredClone(Array.isArray(siteData?.profile?.links) ? siteData.profile.links : []) },
  });
  return panel;
}

function makeChannelPanel() {
  return makeOccPanel('channel', {
    kind: 'channel',
    order: ['channelUrl'],
    read: () => ({ channelUrl: occString('youtube-channel-url') }),
    write: (fields) => { const control = occElement('youtube-channel-url'); if (control) control.value = String(fields.channelUrl ?? ''); },
    snapshot: (fields) => snapshotFields(['channelUrl'], fields),
    draft: (self) => draftOfChangedFields(['channelUrl'], { channelUrl: occString('youtube-channel-url') }, self.baselineValues),
    slice: (data, draft) => applyChannelSlice(data, draft),
    commit: (draft) => commitOccPageToSiteData('channel', draft),
    lockables: () => [occElement('youtube-channel-url'), occElement('channel-save-btn')].filter(Boolean),
  });
}

const OCC_PAGE_SLICES = {
  site: applySiteSlice,
  profile: applyProfileSlice,
  channel: applyChannelSlice,
};

function commitOccPageToSiteData(key, draft) {
  const next = structuredClone(siteData);
  OCC_PAGE_SLICES[key](next, draft);
  siteData = window.MusicData.clearDanglingMusicReferences(next);
}

// A picture of Site or Profile is held by an input of the screen (hidden); nothing of it goes to siteData until the screen is saved.
function setImagePathForInputId(inputId, value) {
  const key = OCC_PAGE_IMAGE_PANELS[inputId];
  if (key) recomputeOccDirty(key);
}

function renderProfileLinkRows(rows) {
  const list = occElement('profile-links-list');
  occProfileLinkSources = rows.map((row) => (Number.isInteger(row.source) ? row.source : -1));
  if (!list) return;
  if (rows.length === 0) {
    list.innerHTML = '<p class="occ-empty occ-empty-inline">リンクがありません。</p>';
    return;
  }
  list.innerHTML = rows.map((row, index) => `
    <div class="occ-link-row">
      <div class="form-group occ-field occ-link-name">
        <label for="profile-link-${index}-name">名前</label>
        <input type="text" id="profile-link-${index}-name" class="text-input" data-admin-mutation="" placeholder="名前" value="${escapeHtml(String(row.name ?? ''))}" oninput="onOccPageInput('profile')" onchange="onOccPageInput('profile')">
      </div>
      <div class="form-group occ-field occ-link-url">
        <label for="profile-link-${index}-url">URL</label>
        <input type="url" id="profile-link-${index}-url" class="text-input" data-admin-mutation="" placeholder="URL" value="${escapeHtml(String(row.url ?? ''))}" oninput="onOccPageInput('profile')" onchange="onOccPageInput('profile')">
      </div>
      <button type="button" class="occ-link-delete" id="profile-link-${index}-delete-btn" data-admin-mutation="" onclick="deleteProfileLink(${index})">削除</button>
    </div>
  `).join('');
  applyApiFallbackReadOnlyState();
}

// プロフィールリンク更新: the row's input takes the value (the same as typing it); nothing reaches siteData before the save
function updateProfileLink(index, field, value) {
  if (rejectApiFallbackMutation()) {
    const panel = occPanels.get('profile');
    if (panel) panel.write(panel.baselineValues);
    return false;
  }
  const control = occElement(`profile-link-${index}-${field}`);
  if (!control) return false;
  control.value = String(value ?? '');
  return onOccPageInput('profile');
}

function addProfileLink() {
  if (rejectApiFallbackMutation()) return false;
  if (occSaveOperation) return false;
  const fields = readProfileFields();
  renderProfileLinkRows([...fields.links, { name: '', url: '', source: -1 }]);
  recomputeOccDirty('profile');
  occElement(`profile-link-${occProfileLinkSources.length - 1}-name`)?.focus?.();
  return true;
}

function deleteProfileLink(index) {
  if (rejectApiFallbackMutation()) return false;
  if (occSaveOperation) return false;
  const fields = readProfileFields();
  renderProfileLinkRows(fields.links.filter((_, position) => position !== index));
  recomputeOccDirty('profile');
  return true;
}

// The input of a screen was typed in
function onOccPageInput(key) {
  if (occSaveOperation) return false;
  const panel = occPanels.get(key);
  if (!panel) return false;
  if (isApiFallbackReadOnly) {
    panel.write(panel.baselineValues);
    return false;
  }
  setOccError('', key);
  recomputeOccDirty(key);
  return true;
}

function bindOccPageInputs(key, ids) {
  ids.forEach((id) => {
    const control = occElement(id);
    if (!control || control.dataset.occBound === 'true') return;
    control.dataset.occBound = 'true';
    control.addEventListener('input', () => onOccPageInput(key));
    control.addEventListener('change', () => onOccPageInput(key));
  });
}

// --- unsaved judgement --------------------------------------------------------------------------------------------------
function isOccPanelDirty(panel) {
  return Boolean(panel) && panel.snapshot() !== panel.baseline;
}

// A picture still uploading into the screen counts as unsaved.
function hasActiveImageUploadForOccPage(key) {
  return Array.from(imageUploadOwners.values()).some((owner) => owner.ownerKind === 'page' && OCC_PAGE_IMAGE_PANELS[owner.inputElement?.id] === key);
}

function occPanelUploading(panel) {
  if (!panel) return false;
  return panel.key === 'item' ? hasActiveImageUploadForOccEditor() : hasActiveImageUploadForOccPage(panel.key);
}

// Something is unsaved while an input differs from the value the surface was opened (or last saved) with, and while a picture is
// still uploading into it. `scope: 'item'` asks about the open News / work / video only.
function isOccDirty(scope = 'all') {
  if (scope === 'item') return isOccPanelDirty(occPanels.get('item')) || hasActiveImageUploadForOccEditor();
  return [...occPanels.values()].some((panel) => isOccPanelDirty(panel)) || hasActiveImageUploadForOccEditor() || ['site', 'profile'].some(hasActiveImageUploadForOccPage);
}

function occStatusIds(key) {
  const prefix = occPanelPrefix(key);
  return [`${prefix}-editor-status`, `${prefix}-editor-status-wide`];
}

function setOccStatus(text, key = 'item') {
  const message = String(text || '');
  occStatusIds(key).forEach((id) => {
    const target = occElement(id);
    if (target) target.textContent = message;
  });
}

function setOccError(message, key = 'item') {
  const target = occElement(`${occPanelPrefix(key)}-editor-error`);
  if (target) target.textContent = String(message || '');
}

function recomputeOccDirty(key) {
  if (key === undefined) {
    let any = false;
    [...occPanels.keys()].forEach((panelKey) => { any = recomputeOccDirty(panelKey) || any; });
    return any;
  }
  const panel = occPanels.get(key);
  if (!panel) return false;
  if (key === 'item' && !occActiveItem) return false;
  const dirty = isOccPanelDirty(panel) || occPanelUploading(panel);
  panel.dirty = dirty;
  if (!occSaveOperation) {
    setOccStatus(dirty ? LIVE_UI_TEXT.statusUnsaved : (panel.localWaiting ? OCC_UI.localWaiting : LIVE_UI_TEXT.statusSaved), key);
  }
  syncOccSaveActions(key);
  return dirty;
}

function onOccInput() {
  if (occSaveOperation) return false;
  const panel = occPanels.get('item');
  if (!panel) return false;
  if (isApiFallbackReadOnly) {
    panel.write(panel.baselineValues);
    return false;
  }
  setOccError('');
  recomputeOccDirty('item');
  return true;
}

// 保存して公開. Width 899px and below: a bar at the bottom of the screen, only while there is something to save (unsaved, saving, or a
// failure to show). Width 900px and above: always in the heading of the edit, dimmed and not pressable while nothing is unsaved.
function syncOccSaveActions(key) {
  if (key === undefined) {
    ['news', 'music'].forEach((prefix) => syncOccActionsOf('item', prefix));
    ['channel', 'site', 'profile'].forEach((panelKey) => syncOccActionsOf(panelKey, panelKey));
    return;
  }
  syncOccActionsOf(key, occPanelPrefix(key));
}

function syncOccActionsOf(key, prefix) {
  const actions = occElement(`${prefix}-editor-actions`);
  if (!actions) return;
  const panel = occPanels.get(key);
  const open = key === 'item'
    ? Boolean(occActiveItem && panel && occPrefixOf(occActiveItem.kind) === prefix)
    : Boolean(panel);
  const uploading = open && occPanelUploading(panel);
  const dirty = open && (isOccPanelDirty(panel) || uploading);
  const saving = Boolean(occSaveOperation && occSaveOperation.key === key);
  const failed = Boolean(occElement(`${prefix}-editor-error`)?.textContent);
  const wide = isWideLiveLayout();
  actions.hidden = !open || (wide ? false : !(dirty || saving || failed));
  const button = occElement(`${prefix}-save-btn`);
  if (!button) return;
  const disabled = !open || Boolean(occSaveOperation) || uploading || isApiFallbackReadOnly || (wide && !dirty);
  button.disabled = disabled;
  button.setAttribute('aria-disabled', String(disabled));
}

function syncOccEditingClasses() {
  const editing = Boolean(occActiveItem);
  document.body?.classList?.[editing ? 'add' : 'remove']?.('is-occ-editing');
  const newsEditing = Boolean(occActiveItem && occActiveItem.kind === 'news');
  const musicEditing = Boolean(occActiveItem && occActiveItem.kind !== 'news');
  occElement('news-master-detail')?.classList?.[newsEditing ? 'add' : 'remove']?.('has-occ-selection');
  occElement('music-master-detail')?.classList?.[musicEditing ? 'add' : 'remove']?.('has-occ-selection');
}

// The width crossed 900px: the other arrangement of the same surface (nothing is reset, nothing takes the focus).
function syncOccLayout() {
  syncOccEditingClasses();
  syncOccSaveActions();
  return isWideLiveLayout();
}

function bindOccLayoutListener() {
  if (occLayoutListenerBound) return false;
  const query = window.matchMedia?.(LIVE_WIDE_QUERY);
  if (!query || typeof query.addEventListener !== 'function') return false;
  occLayoutListenerBound = true;
  query.addEventListener('change', syncOccLayout);
  return true;
}

// The buttons that are always in the page (the edit surfaces are drawn into their bodies later; their own controls are bound then).
function bindOccShell() {
  const bindings = [
    ['news-editor-back', () => closeOccEditor()],
    ['news-save-btn', () => { void saveOccPanel('item'); }],
    ['music-editor-back', () => closeOccEditor()],
    ['music-save-btn', () => { void saveOccPanel('item'); }],
    ['channel-save-btn', () => { void saveOccPanel('channel'); }],
    ['site-save-btn', () => { void saveOccPanel('site'); }],
    ['profile-save-btn', () => { void saveOccPanel('profile'); }],
  ];
  bindings.forEach(([id, handler]) => {
    const button = occElement(id);
    if (button && button.dataset.occBound !== 'true') {
      button.dataset.occBound = 'true';
      button.addEventListener('click', handler);
    }
  });
  bindOccLayoutListener();
}

// --- the lists -----------------------------------------------------------------------------------------------------------
function occRowSelected(kind, id) {
  return Boolean(occActiveItem && occActiveItem.kind === kind && !occActiveItem.isNew && String(occActiveItem.id) === String(id));
}

function newsRowHtml(item) {
  const selected = occRowSelected('news', item.id);
  const title = String(item.title ?? '') || OCC_UI.untitled;
  return `<button type="button" class="occ-row" data-occ-open="news" data-occ-id="${escapeHtml(String(item.id))}"${selected ? ' aria-current="true"' : ''}>`
    + `<span class="occ-row-meta">${escapeHtml(String(item.date ?? ''))}</span>`
    + `<span class="occ-row-title">${escapeHtml(title)}</span>`
    + '</button>';
}

function renderNews() {
  const list = occElement('news-list');
  if (!list) return;
  const items = Array.isArray(siteData?.news) ? siteData.news : [];
  list.innerHTML = items.length === 0
    ? `<p class="occ-empty">${OCC_UI.emptyList}</p>`
    : items.map(newsRowHtml).join('');
  bindOccShell();
}

// A work: its jacket, its title and its release date. A video: its title only.
function releaseRowHtml(item, category) {
  const title = String(item.title ?? '') || OCC_UI.untitled;
  return `<button type="button" class="occ-row occ-row-release" data-occ-open="release" data-occ-id="${escapeHtml(String(item.id))}" data-occ-category="${category}"${occRowSelected('release', item.id) ? ' aria-current="true"' : ''}>`
    + `<img class="occ-row-thumb" src="${escapeHtml(getImageSrc(String(item.image || '')))}" alt="" onerror="this.style.visibility='hidden'">`
    + '<span class="occ-row-text">'
    + `<span class="occ-row-title">${escapeHtml(title)}</span>`
    + `<span class="occ-row-meta">${escapeHtml(String(item.releaseDate ?? ''))}</span>`
    + '</span></button>';
}

function videoRowHtml(item, category) {
  const title = String(item.title ?? '') || OCC_UI.untitled;
  return `<button type="button" class="occ-row occ-row-video" data-occ-open="video" data-occ-id="${escapeHtml(String(item.id))}" data-occ-category="${category}"${occRowSelected('video', item.id) ? ' aria-current="true"' : ''}>`
    + `<span class="occ-row-title">${escapeHtml(title)}</span></button>`;
}

// Groups with a heading each; a group with nothing in it is not drawn, and nothing at all shows the empty line (no headings).
function groupedListHtml(groups, rowHtml) {
  const filled = groups.filter(([, , items]) => Array.isArray(items) && items.length > 0);
  if (filled.length === 0) return `<p class="occ-empty">${OCC_UI.emptyList}</p>`;
  return filled.map(([category, label, items]) => `<p class="occ-group-title">${label}</p>${items.map((item) => rowHtml(item, category)).join('')}`).join('');
}

// 作品の一覧
function renderDiscography() {
  const list = occElement('music-works-list');
  if (!list) return;
  list.innerHTML = groupedListHtml([
    ['digital', OCC_UI.digital, siteData?.discography?.digital],
    ['demo', OCC_UI.demo, siteData?.discography?.demo],
  ], releaseRowHtml);
  bindOccShell();
  bindMusicSwitch();
  applyMusicView(musicView);
}

// 映像の一覧
function renderVideoList() {
  const list = occElement('music-videos-list');
  if (!list) return;
  list.innerHTML = groupedListHtml([
    ['musicVideos', OCC_UI.musicVideos, siteData?.youtube?.musicVideos],
    ['liveMovies', OCC_UI.liveMovies, siteData?.youtube?.liveMovies],
    ['demos', OCC_UI.demos, siteData?.youtube?.demos],
  ], videoRowHtml);
  bindOccShell();
}

// The Channel URL of the videos: its input is held by its own screen, not by siteData.
function renderChannelPanel() {
  const input = occElement('youtube-channel-url');
  if (input) input.value = String(siteData?.youtube?.channelUrl || '');
  bindOccPageInputs('channel', ['youtube-channel-url']);
  occPanels.set('channel', makeChannelPanel());
  recomputeOccDirty('channel');
}

function renderYouTube() {
  renderChannelPanel();
  renderVideoList();
}

function renderOccLists(kind) {
  if (kind === 'news') renderNews();
  if (kind === 'release') renderDiscography();
  if (kind === 'video') renderVideoList();
}

// A click on a row of a list (the rows carry what to open in data attributes).
function handleOccAction(event) {
  const trigger = event?.target?.closest?.('[data-occ-open]');
  if (!trigger) return;
  event.preventDefault?.();
  const kind = trigger.dataset?.occOpen;
  if (kind === 'news') editNews(trigger.dataset.occId);
  if (kind === 'release') editDiscography(trigger.dataset.occId, trigger.dataset.occCategory);
  if (kind === 'video') editYouTubeVideo(trigger.dataset.occId, trigger.dataset.occCategory);
}

function focusOccRow(id) {
  if (!id) return;
  const row = Array.from(document.querySelectorAll('[data-occ-open]')).find((candidate) => String(candidate.dataset?.occId || '') === String(id));
  row?.focus?.();
}

// --- Music: 作品 / 映像 ------------------------------------------------------------------------------------------------------
function applyMusicView(view) {
  musicView = view === 'videos' ? 'videos' : 'works';
  const videos = musicView === 'videos';
  const tabs = [['music-switch-works', 'works'], ['music-switch-videos', 'videos']];
  tabs.forEach(([id, name]) => {
    const tab = occElement(id);
    if (!tab) return;
    const selected = name === musicView;
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('tabindex', selected ? '0' : '-1');
    tab.classList[selected ? 'add' : 'remove']('is-active');
  });
  const works = occElement('music-works-list');
  const videosList = occElement('music-videos-list');
  if (works) works.hidden = videos;
  if (videosList) videosList.hidden = !videos;
  const channel = occElement('music-channel-panel');
  if (channel) channel.hidden = !videos;
  const title = occElement('music-list-title');
  if (title) title.textContent = videos ? OCC_UI.musicTitleVideos : OCC_UI.musicTitleWorks;
  return true;
}

// The switch asks first when something is unsaved (the open work or video, the Channel URL); the open item is closed behind it.
function setMusicView(view) {
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  const target = view === 'videos' ? 'videos' : 'works';
  if (target === musicView) return applyMusicView(target);
  return requestLiveEditorTransition(() => {
    if (occActiveItem) closeOccEditorImmediately();
    return applyMusicView(target);
  });
}

function bindMusicSwitch() {
  const tabs = ['music-switch-works', 'music-switch-videos'].map(occElement).filter(Boolean);
  if (tabs.length) bindLiveTablist(tabs, 'musicView', setMusicView);
}

// --- Site and Profile: what the screen shows -------------------------------------------------------------------------------
function renderSiteSettings() {
  const site = siteData.site || {};
  const links = site.links || {};
  const contact = siteData.contact || {};
  const featured = occElement('site-featured-release-id');
  if (featured) {
    featured.innerHTML = musicOptions([[OCC_UI.digital, siteData.discography.digital], [OCC_UI.demo, siteData.discography.demo]], site.featuredReleaseId, '自動（最新のリリース）', true);
    featured.value = site.featuredReleaseId || '';
  }

  const heroForm = occElement('site-hero-image-form');
  if (heroForm) {
    // the label and the explanation of 共有時の画像 are in the page itself (admin/index.html)
    heroForm.innerHTML = getImageFormHtml(site.heroImage || '', 'site-hero-image', { omitLabel: true });
    const previewContainer = occElement('site-hero-image-preview-container');
    if (previewContainer) {
      previewContainer.setAttribute('data-admin-mutation', '');
      previewContainer.onclick = () => occElement('site-hero-image-file')?.click();
    }
  }

  const values = {
    'site-link-bandcamp': links.bandcamp,
    'site-link-youtube': links.youtube,
    'site-link-x': links.x,
    'site-link-instagram': links.instagram,
    'site-link-note': links.note,
    'site-footer-text': site.footerText,
    'contact-intro-text': contact.introText,
    'contact-form-action': contact.formAction,
  };
  Object.entries(values).forEach(([id, value]) => {
    const control = occElement(id);
    if (control) control.value = value || '';
  });
  bindOccPageInputs('site', Object.values(OCC_SITE_INPUT_IDS).filter((id) => id !== 'site-hero-image'));
  bindOccShell();
  occPanels.set('site', makeSitePanel());
  recomputeOccDirty('site');
}

function renderProfile() {
  const profile = siteData.profile || {};
  const imageForm = occElement('profile-image-form');
  if (imageForm) {
    imageForm.innerHTML = getImageFormHtml(profile.image || '', 'profile-image', { label: '写真', variant: 'portrait' });
    const previewContainer = occElement('profile-image-preview-container');
    if (previewContainer) {
      previewContainer.setAttribute('data-admin-mutation', '');
      previewContainer.onclick = () => occElement('profile-image-file')?.click();
    }
  }
  const text = occElement('profile-text');
  if (text) text.value = profile.text || '';
  bindOccPageInputs('profile', ['profile-text']);
  renderProfileLinks();
  bindOccShell();
  occPanels.set('profile', makeProfilePanel());
  recomputeOccDirty('profile');
}

// SNSリンク: one row each, from the saved links
function renderProfileLinks() {
  const links = Array.isArray(siteData?.profile?.links) ? siteData.profile.links : [];
  renderProfileLinkRows(links.map((link, index) => ({ name: link?.name, url: link?.url, source: index })));
}

// The options of 顔にする作品 (Site) and その場で再生する映像 (a work being edited) are drawn again from the saved data after a work or a
// video was saved or deleted. What was chosen stays chosen; a choice that is no longer in the options (a work / a video that was
// deleted) goes back to the empty one. The saved side of that choice follows the data (the saved reference is already empty).
function rebaseOccDrafts() {
  const site = occPanels.get('site');
  const featured = occElement('site-featured-release-id');
  if (featured && site) {
    const wanted = String(featured.value || '');
    const stays = wanted === '' || musicReleases(siteData).some((release) => String(release.id) === wanted);
    featured.innerHTML = musicOptions([[OCC_UI.digital, siteData.discography.digital], [OCC_UI.demo, siteData.discography.demo]], stays ? wanted : '', '自動（最新のリリース）', true);
    featured.value = stays ? wanted : '';
    site.baselineValues.featuredReleaseId = String(siteData.site?.featuredReleaseId || '');
    site.baseline = site.snapshotOf(site.baselineValues);
  }
  const item = occPanels.get('item');
  const playback = occElement('edit-playbackVideoId');
  if (item && item.kind === 'release' && playback) {
    const wanted = String(playback.value || '');
    const stays = wanted === '' || ['musicVideos', 'liveMovies', 'demos'].some((name) => (siteData.youtube?.[name] || []).some((video) => String(video.id) === wanted));
    playback.innerHTML = playbackVideoOptions(stays ? wanted : '');
    playback.value = stays ? wanted : '';
    const saved = !occActiveItem.isNew ? musicReleases(siteData).find((release) => String(release.id) === String(occActiveItem.id)) : null;
    if (saved) {
      item.baselineValues.playbackVideoId = String(saved.playbackVideoId || '');
      item.baseline = item.snapshotOf(item.baselineValues);
    }
  }
  recomputeOccDirty();
  return true;
}

// --- opening and closing an item -------------------------------------------------------------------------------------------------
function buildOccEditorHtml(kind, item, isNew, category) {
  if (kind === 'release') return buildReleaseEditorHtml(item, category, isNew);
  if (kind === 'video') return buildVideoEditorHtml(item, category, isNew);
  return buildNewsEditorHtml(item, isNew);
}

function occEditType(kind, category) {
  if (kind === 'release') return `discography-${category}`;
  if (kind === 'video') return `youtube-${category}`;
  return 'news';
}

function occHeadings(kind) {
  if (kind === 'release') return { edit: OCC_UI.releaseHeadingEdit, fresh: OCC_UI.releaseHeadingNew };
  if (kind === 'video') return { edit: OCC_UI.videoHeadingEdit, fresh: OCC_UI.videoHeadingNew };
  return { edit: OCC_UI.newsHeadingEdit, fresh: OCC_UI.newsHeadingNew };
}

function openOccItemEditorNow(kind, item, isNew, category = null) {
  const prefix = occPrefixOf(kind);
  const body = occElement(`${prefix}-editor-body`);
  if (!body) return false;
  // an edit of the other surface (News ↔ Music) is closed first; the unsaved one was already asked about
  if (occActiveItem && occPrefixOf(occActiveItem.kind) !== prefix) closeOccEditorImmediately();
  const active = document.activeElement;
  occReturnFocusId = !isNew && active?.dataset?.occId ? String(active.dataset.occId) : '';

  releaseImageUploadsForModalGeneration(modalGeneration);
  modalGeneration += 1;
  currentEditType = occEditType(kind, category);
  currentEditId = item.id;
  isNewItem = Boolean(isNew);
  occActiveItem = { kind, id: item.id, category, isNew: Boolean(isNew) };

  body.innerHTML = buildOccEditorHtml(kind, item, isNew, category);
  occPanels.delete('item');
  occPanels.set('item', makeOccItemPanel(kind));
  bindOccEditorControls(kind);
  const headings = occHeadings(kind);
  setOccEditorHeading(isNew ? headings.fresh : headings.edit, isNew ? headings.fresh : (String(item.title ?? '') || OCC_UI.untitled));
  setOccError('');
  renderOccLists(kind);
  syncOccEditingClasses();
  recomputeOccDirty('item');
  applyApiFallbackReadOnlyState();
  occElement(OCC_ITEM_KINDS[kind].firstFocus)?.focus?.();
  return true;
}

function openNewsEditorNow(item, isNew) {
  return openOccItemEditorNow('news', item, isNew);
}

function bindOccEditorControls(kind = occActiveItem?.kind || 'news') {
  const spec = OCC_ITEM_KINDS[kind];
  spec.controlIds.forEach((id) => {
    const control = occElement(id);
    control?.addEventListener('input', onOccInput);
    control?.addEventListener('change', onOccInput);
  });
  if (kind === 'release') bindReleaseDateError();
  if (kind === 'video') occElement('edit-youtube')?.addEventListener('input', clearVideoIdError);
  occElement(spec.deleteId)?.addEventListener('click', () => { void deleteOccItem(); });
}

function setOccEditorHeading(heading, title, prefix = occItemPrefix()) {
  const headingElement = occElement(`${prefix}-editor-heading`);
  if (headingElement) headingElement.textContent = heading;
  const titleElement = occElement(`${prefix}-editor-title`);
  if (titleElement) {
    titleElement.textContent = title;
    titleElement.setAttribute('title', title);
  }
}

function addNews() {
  if (rejectApiFallbackMutation()) return false;
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  return requestLiveEditorTransition(() => {
    if (liveEditorOwner) closeLiveEditorImmediately();
    return openNewsEditorNow({ id: 'news-' + Date.now(), date: '', title: '', description: '', image: '', link: '', linkText: 'view...' }, true);
  }, { scope: 'item' });
}

function editNews(id) {
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  const item = (Array.isArray(siteData?.news) ? siteData.news : []).find((candidate) => String(candidate.id) === String(id));
  if (!item) return false;
  if (occActiveItem?.kind === 'news' && !occActiveItem.isNew && String(occActiveItem.id) === String(item.id)) return true;
  return requestLiveEditorTransition(() => {
    if (liveEditorOwner) closeLiveEditorImmediately();
    return openNewsEditorNow(item, false);
  }, { scope: 'item' });
}

// 作品を追加: an empty work (the category starts at Digital Release)
function addDiscography() {
  if (rejectApiFallbackMutation()) return false;
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  return requestLiveEditorTransition(() => {
    if (liveEditorOwner) closeLiveEditorImmediately();
    applyMusicView('works');
    return openOccItemEditorNow('release', { id: 'disc-' + Date.now(), title: '', releaseDate: '', description: '', image: '', link: '', releaseType: '', playbackVideoId: '' }, true, 'digital');
  }, { scope: 'item' });
}

function editDiscography(id, category) {
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  const list = category === 'digital' ? siteData.discography.digital : siteData.discography.demo;
  const item = list.find((candidate) => String(candidate.id) === String(id));
  if (!item) return false;
  if (occActiveItem?.kind === 'release' && !occActiveItem.isNew && String(occActiveItem.id) === String(item.id)) return true;
  return requestLiveEditorTransition(() => {
    if (liveEditorOwner) closeLiveEditorImmediately();
    applyMusicView('works');
    return openOccItemEditorNow('release', item, false, category);
  }, { scope: 'item' });
}

// 映像を追加: an empty video (the category starts at the one the add was pressed for)
function addYouTubeVideo(category = 'musicVideos') {
  if (rejectApiFallbackMutation()) return false;
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  return requestLiveEditorTransition(() => {
    if (liveEditorOwner) closeLiveEditorImmediately();
    applyMusicView('videos');
    return openOccItemEditorNow('video', { id: 'yt-' + Date.now(), title: '', youtubeId: '' }, true, category);
  }, { scope: 'item' });
}

function editYouTubeVideo(id, category) {
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  const item = (siteData.youtube[category] || []).find((candidate) => String(candidate.id) === String(id));
  if (!item) return false;
  if (occActiveItem?.kind === 'video' && !occActiveItem.isNew && String(occActiveItem.id) === String(item.id)) return true;
  return requestLiveEditorTransition(() => {
    if (liveEditorOwner) closeLiveEditorImmediately();
    applyMusicView('videos');
    return openOccItemEditorNow('video', item, false, category);
  }, { scope: 'item' });
}

// + 追加 of the list that is shown
function addMusicItem() {
  return musicView === 'videos' ? addYouTubeVideo('musicVideos') : addDiscography();
}

function closeOccEditor() {
  if (occSaveOperation) return false;
  return requestLiveEditorTransition(closeOccEditorImmediately, { scope: 'item' });
}

function closeOccEditorImmediately() {
  const closing = occActiveItem;
  const prefix = occItemPrefix();
  const returnFocusId = occReturnFocusId;
  occReturnFocusId = '';
  releaseImageUploadsForModalGeneration(modalGeneration);
  modalGeneration += 1;
  occPanels.delete('item');
  occActiveItem = null;
  const body = occElement(`${prefix}-editor-body`);
  if (body) body.innerHTML = '';
  setOccEditorHeading('', '', prefix);
  setOccStatus('', 'item');
  setOccError('', 'item');
  if (closing && String(currentEditId) === String(closing.id) && (currentEditType === 'news' || /^(discography|youtube)-/.test(String(currentEditType)))) {
    currentEditType = null;
    currentEditId = null;
    isNewItem = false;
  }
  if (closing) renderOccLists(closing.kind);
  syncOccEditingClasses();
  syncOccSaveActions();
  focusOccRow(returnFocusId);
  return true;
}

// 破棄して移動: what was typed goes back to what is saved, and a picture still uploading is let go. `scope: 'item'` is the open item only.
function discardOccPanels(scope = 'all') {
  releaseImageUploadsForModalGeneration(modalGeneration);
  const keys = [...occPanels.keys()].filter((key) => scope !== 'item' || key === 'item');
  if (keys.includes('item') && !occActiveItem) keys.splice(keys.indexOf('item'), 1);
  releaseImageOperations((owner) => owner.ownerKind === 'page' && keys.includes(OCC_PAGE_IMAGE_PANELS[owner.inputElement?.id]));
  if (keys.length === 0) return false;
  keys.forEach((key) => {
    const panel = occPanels.get(key);
    panel.write(panel.baselineValues);
    panel.dirty = false;
    setOccError('', key);
    setOccStatus(panel.localWaiting ? OCC_UI.localWaiting : LIVE_UI_TEXT.statusSaved, key);
    syncOccSaveActions(key);
  });
  return true;
}

// --- saving and deleting --------------------------------------------------------------------------------------------------
// While a save or a delete runs the inputs, the moves, the add and the delete are locked; the lock is released with what was there.
function setOccInteractionLocked(locked, priorState = [], panel = occPanels.get('item')) {
  const busyId = panel?.key === 'item' ? `${occItemPrefix()}-editor-pane` : (panel?.key === 'channel' ? 'music-channel-panel' : `${panel?.key}-tab`);
  if (locked) {
    const controls = [
      ...(panel?.lockables?.() || []),
      ...['music-switch-works', 'music-switch-videos'].map(occElement).filter(Boolean),
      ...Array.from(document.querySelectorAll('.tab-btn')),
    ];
    const tracked = new Set(priorState.map(({ element }) => element));
    [...new Set(controls)].forEach((element) => {
      if (!tracked.has(element)) priorState.push({ element, disabled: Boolean(element.disabled) });
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
    });
    occElement(busyId)?.setAttribute('aria-busy', 'true');
    return priorState;
  }
  priorState.forEach(({ element, disabled }) => {
    if (element?.isConnected === false) return;
    element.disabled = disabled;
    element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
  occElement(busyId)?.setAttribute('aria-busy', 'false');
  return [];
}

function beginOccOperation(panel) {
  const operation = { token: ++occSaveSequence, key: panel.key, ownerId: panel.key === 'item' ? String(occActiveItem.id) : panel.key, generation: modalGeneration, lockedControls: [], panel };
  occSaveOperation = operation;
  panel.saving = true;
  setOccError('', panel.key);
  setOccStatus(LIVE_UI_TEXT.statusSaving, panel.key);
  operation.lockedControls = setOccInteractionLocked(true, operation.lockedControls, panel);
  syncOccSaveActions(panel.key);
  return operation;
}

function endOccOperation(operation, panel) {
  if (occSaveOperation !== operation) return false;
  setOccInteractionLocked(false, operation.lockedControls, panel);
  operation.lockedControls = [];
  occSaveOperation = null;
  if (panel) panel.saving = false;
  return true;
}

// 保存して公開. The body is the last saved content with this surface's target layered on (saveScoped); siteData follows only when it
// succeeded, so that a failure leaves the data, the surface and what was typed as they were.
async function saveOccPanel(key = 'item', options = {}) {
  if (occSaveOperation) return false;
  const panel = occPanels.get(key);
  if (!panel) return false;
  if (key === 'item' && !occActiveItem) return false;
  if (rejectApiFallbackMutation('読み取り専用のため保存できません。')) {
    panel.write(panel.baselineValues);
    return false;
  }
  if (!ensureNoActiveImageUploads()) return false;
  // Nothing differs from what is saved: nothing to send. (`force` is for the comparison with the app before #47, which saved anyway.)
  if (!options.force && !isOccPanelDirty(panel)) return true;

  const draft = panel.draft(panel);
  const itemKind = key === 'item' ? OCC_ITEM_KINDS[occActiveItem.kind] : null;
  // The date of a work and the id of a video are checked before anything is sent; the reason is drawn right under the input.
  if (itemKind?.validate && !itemKind.validate(draft)) return false;
  const wasNew = key === 'item' ? occActiveItem.isNew : false;
  const kind = key === 'item' ? occActiveItem.kind : null;
  const operation = beginOccOperation(panel);
  try {
    if (IS_API_MODE) {
      await saveScoped((data) => panel.slice(data, draft), { fallbackBase: siteData });
    }
    if (occSaveOperation !== operation) return false;
    panel.commit(draft);
    if (!IS_API_MODE) {
      markChanged();
      panel.localWaiting = true;
    }
  } catch (error) {
    if (!endOccOperation(operation, panel)) return false;
    setOccStatus(LIVE_UI_TEXT.statusFailed, key);
    setOccError(error.message, key);
    syncOccSaveActions(key);
    showToast(`保存に失敗しました: ${error.message}`, 'error');
    return false;
  }

  finishOccSave(panel, draft, { wasNew, kind });
  endOccOperation(operation, panel);
  setOccError('', key);
  if (key === 'item') renderOccLists(kind);
  rebaseOccDrafts();
  recomputeOccDirty(key);
  setOccStatus(IS_API_MODE ? LIVE_UI_TEXT.statusSaved : OCC_UI.localWaiting, key);
  showToast(IS_API_MODE ? '保存しました' : OCC_UI.localSaved, 'success');
  return true;
}

// What the surface looks like after its save went through: the saved values are the new baseline.
function finishOccSave(panel, draft, { wasNew, kind }) {
  if (panel.key === 'item') {
    const item = draft.item || draft;
    const category = draft.category || null;
    occActiveItem.isNew = false;
    isNewItem = false;
    if (kind !== 'news') {
      occActiveItem.category = category;
      currentEditType = occEditType(kind, category);
    }
    if (wasNew) {
      // The saved item can now be deleted: the edit is drawn again from what was saved (the inputs hold exactly that).
      const body = occElement(`${occPrefixOf(kind)}-editor-body`);
      if (body) body.innerHTML = buildOccEditorHtml(kind, item, false, category);
      bindOccEditorControls(kind);
      applyApiFallbackReadOnlyState();
    }
    const headings = occHeadings(kind);
    setOccEditorHeading(headings.edit, String(item.title ?? '') || OCC_UI.untitled);
  } else if (panel.key === 'profile' && draft.changes.links) {
    panel.extra.sourceLinks = structuredClone(draft.changes.links);
    occProfileLinkSources = draft.changes.links.map((_, index) => index);
  }
  panel.baselineValues = panel.clone ? panel.clone(panel.read()) : { ...panel.read() };
  panel.baseline = panel.snapshotOf(panel.baselineValues);
}

// 削除. The confirmation says what else changes (a work that was the face of the site, videos that works play), the delete is then saved
// on the spot: the baseline without the item, with the references to it back to empty in the same one request.
async function deleteOccItem() {
  if (occSaveOperation || liveWorkspaceSaveOperation) return false;
  const active = occActiveItem;
  if (!active || active.isNew) return false;
  if (rejectApiFallbackMutation('読み取り専用のため削除できません。')) return false;
  const saved = findSavedOccItem(active);
  const title = String(saved?.title ?? '');
  const fallbackTitle = active.kind === 'release' ? OCC_UI.deleteTitleRelease : (active.kind === 'video' ? OCC_UI.deleteTitleVideo : OCC_UI.deleteTitleNews);
  const choice = await openLiveDialog({
    title: title ? `「${title}」を削除しますか。` : fallbackTitle,
    body: occDeleteDialogBody(active),
    actions: [
      { id: 'cancel', label: LIVE_UI_TEXT.deleteCancel, safe: true, tone: 'secondary' },
      { id: 'delete', label: LIVE_UI_TEXT.deleteConfirm, tone: 'primary' },
    ],
  });
  if (choice !== 'delete') return false;
  if (occSaveOperation || occActiveItem !== active) return false;

  const panel = occPanels.get('item');
  const operation = beginOccOperation(panel);
  try {
    if (IS_API_MODE) {
      await saveScoped((data) => applyOccDeleteSlice(data, active.kind, active.id, active.category), { fallbackBase: siteData });
    }
    if (occSaveOperation !== operation) return false;
    const next = structuredClone(siteData);
    applyOccDeleteSlice(next, active.kind, active.id, active.category);
    siteData = window.MusicData.clearDanglingMusicReferences(next);
    if (!IS_API_MODE) markChanged();
  } catch (error) {
    // Nothing was removed from siteData or from the list: the item, the surface and what was typed stay as they were.
    if (!endOccOperation(operation, panel)) return false;
    setOccStatus(LIVE_UI_TEXT.statusFailed);
    setOccError(error.message);
    syncOccSaveActions('item');
    showToast(`削除に失敗しました: ${error.message}`, 'error');
    return false;
  }
  endOccOperation(operation, panel);
  closeOccEditorImmediately();
  rebaseOccDrafts();
  showToast(IS_API_MODE ? '削除しました' : OCC_UI.localDeleted, 'success');
  return true;
}

function findSavedOccItem(active) {
  const same = (candidate) => String(candidate.id) === String(active.id);
  if (active.kind === 'news') return (Array.isArray(siteData?.news) ? siteData.news : []).find(same);
  if (active.kind === 'release') return musicReleases(siteData).find(same);
  return (siteData?.youtube?.[active.category] || []).find(same);
}

// What the confirmation adds to 「削除すると公開画面からも消えます。」: a reference that goes back to empty.
function occDeleteDialogBody(active) {
  const lines = [OCC_UI.deleteBody];
  if (active.kind === 'release' && String(siteData?.site?.featuredReleaseId || '') === String(active.id)) lines.push(OCC_UI.featuredResets);
  if (active.kind === 'video') {
    const count = musicReleases(siteData).filter((release) => String(release.playbackVideoId || '') === String(active.id)).length;
    if (count > 0) lines.push(OCC_UI.playbackResets(count));
  }
  return lines;
}

// ページ離脱時の警告
window.addEventListener('beforeunload', (e) => {
  if (hasChanges || liveEditorDirty || isTicketSettingsDirty() || ticketSettingsSaving || liveWorkspaceSaveOperation || isOccDirty() || occSaveOperation || activeImageUploads.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
