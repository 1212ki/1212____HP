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
let xPreviewDirty = false;
let xPreviewLastAutoText = '';


// 新規追加した画像を保存（{filename: base64data}）
let pendingImages = {};
// APIモードの画像アップロード中ガード
let activeImageUploads = new Set();

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  refreshAdminRuntimeConfig();
  renderModeBadge();
  await loadData();
  setupTabs();
  renderAll();
});

function renderModeBadge() {
  const modeBadge = document.getElementById('modeBadge');
  const banner = document.getElementById('connectionBanner');
  if (!modeBadge || !banner) return;

  const build = window.ADMIN_BUILD_ID ? ' (' + window.ADMIN_BUILD_ID + ')' : '';

  if (IS_API_MODE) {
    modeBadge.textContent = 'API Mode' + build;
    banner.textContent = 'Cloudflare APIへ接続中...';
    banner.classList.add('is-api');
    banner.classList.remove('is-error');
    return;
  }

  modeBadge.textContent = 'Local Mode' + build;
  banner.textContent = 'ローカルJSONモード（従来運用）';
  banner.classList.remove('is-api', 'is-error');
}

function setConnectionBanner(text, state = 'normal') {
  const banner = document.getElementById('connectionBanner');
  if (!banner) return;
  banner.textContent = text;
  banner.classList.remove('is-api', 'is-error');
  if (state === 'api') banner.classList.add('is-api');
  if (state === 'error') banner.classList.add('is-error');
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

async function adminFetch(path, options = {}) {
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
  if (!bases.includes(CANONICAL_API_BASE_URL)) bases.push(CANONICAL_API_BASE_URL);

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

  const liveId = document.getElementById('tickets-live-filter')?.value || '';
  const status = document.getElementById('tickets-status-filter')?.value || '';
  const params = new URLSearchParams();
  if (liveId) params.set('liveId', liveId);
  if (status) params.set('status', status);
  params.set('limit', '200');

  listEl.innerHTML = '<div class="empty-state"><p>読み込み中...</p></div>';
  try {
    const res = await adminFetch(`/api/admin/ticket-reservations?${params.toString()}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(payload, '予約一覧を取得できませんでした'));
    const reservations = Array.isArray(payload.reservations) ? payload.reservations : [];
    if (reservations.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>予約がありません</p></div>';
      return;
    }
    listEl.innerHTML = reservations.map(r => renderTicketRow(r)).join('');
  } catch (e) {
    listEl.innerHTML = `<div class="empty-state"><p>取得失敗: ${escapeHtml(e.message)}</p></div>`;
  }
}

function renderTicketRow(r) {
  const status = r.status || 'unknown';
  const statusLabel = status === 'pending' ? '未対応' : status === 'handled' ? '対応済み' : status === 'cancelled' ? 'キャンセル' : status;
  const statusClass = status === 'pending' ? 'is-pending' : status === 'handled' ? 'is-handled' : status === 'cancelled' ? 'is-cancelled' : '';
  const title = `${r.liveDate || ''} ${r.liveVenue || ''}`.trim();
  const meta = `${r.name || ''} / ${r.quantity || 1}枚 / ${r.email || ''}`.trim();
  const msg = r.message ? `<div class="meta ticket-message">${escapeHtml(r.message)}</div>` : '';
  const actions = status === 'pending'
    ? `<button class="x-test-btn" onclick="markTicketStatus('${escapeHtml(r.id)}','handled')">対応済み</button>
       <button class="x-post-btn" onclick="markTicketStatus('${escapeHtml(r.id)}','cancelled')">キャンセル</button>`
    : `<button class="x-test-btn" onclick="markTicketStatus('${escapeHtml(r.id)}','pending')">未対応に戻す</button>`;

  return `
    <div class="item-card ticket-row">
      <div class="info">
        <div class="ticket-top">
          <div class="title">${escapeHtml(title || r.liveId || '')}</div>
          <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="meta">${escapeHtml(meta)}</div>
        ${msg}
        <div class="meta mt-2">${escapeHtml(r.createdAt || '')}</div>
        <div class="ticket-actions">
          ${actions}
        </div>
      </div>
    </div>
  `;
}

async function markTicketStatus(id, status) {
  if (!IS_API_MODE) return;
  try {
    const res = await adminFetch(`/api/admin/ticket-reservations/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(payload, 'ステータス更新に失敗しました'));
    await loadTickets();
  } catch (e) {
    showToast(`更新失敗: ${e.message}`, 'error');
  }
}

async function downloadTicketsCsv() {
  if (!IS_API_MODE) {
    showToast('CSVはAPIモードでのみ利用できます', 'error');
    return;
  }
  try {
    const liveId = document.getElementById('tickets-live-filter')?.value || '';
    const status = document.getElementById('tickets-status-filter')?.value || '';
    const params = new URLSearchParams();
    if (liveId) params.set('liveId', liveId);
    if (status) params.set('status', status);
    params.set('limit', '200');
    const url = `${API_BASE_URL}/api/admin/ticket-reservations.csv?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ticket_reservations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    showToast(`CSV失敗: ${e.message}`, 'error');
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
      setConnectionBanner('Cloudflare API接続中', 'api');
      await loadTickets();
      return;
    } catch (error) {
      console.error('APIデータ読み込みエラー:', error);
      setConnectionBanner(`API接続失敗: ${error.message}（ローカルJSONへフォールバック）`, 'error');
    }
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
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });
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
  const options = [
    { value: '', label: '全ライブ' },
    ...((siteData?.live?.upcoming || []).map(l => ({ value: l.id, label: `${l.date || ''} ${l.venue || ''}`.trim() }))),
    ...((siteData?.live?.past || []).map(l => ({ value: l.id, label: `${l.date || ''} ${l.venue || ''}`.trim() }))),
  ];
  liveSelect.innerHTML = options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
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

function renderLiveItem(item, category) {
  return `
    <div class="item-card ${category === 'past' ? 'past' : ''}" onclick="editLive('${item.id}', '${category}')">
      <img class="thumbnail" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="title">${escapeHtml((item.title || '').trim() || item.venue)}</div>
        <div class="meta">${escapeHtml([item.date, (item.title || '').trim() ? item.venue : ''].filter(Boolean).join(' '))}</div>
      </div>
      <span class="arrow">›</span>
    </div>
  `;
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
    upcomingList.innerHTML = siteData.live.upcoming.map(item => renderLiveItem(item, 'upcoming')).join('');
  }

  if (siteData.live.past.length === 0) {
    pastList.innerHTML = '<div class="empty-state"><p>終了したライブはありません</p></div>';
  } else {
    pastList.innerHTML = siteData.live.past.map(item => renderLiveItem(item, 'past')).join('');
  }
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

// 画像選択フォームHTML生成
function getImageFormHtml(currentImage, inputId = 'edit-image') {
  const previewSrc = currentImage ? getImageSrc(currentImage) : '';
  return `
    <div class="form-group">
      <label>画像</label>
      <div class="image-upload-area" id="image-upload-area">
        <input type="file" id="${inputId}-file" accept="image/*" onchange="handleImageSelect(this, '${inputId}')" style="display:none">
        <input type="hidden" id="${inputId}" value="${escapeHtml(currentImage || '')}">
        <div class="image-preview-container" id="${inputId}-preview-container">
          ${previewSrc ? `<img class="image-preview-large" id="${inputId}-preview" src="${previewSrc}" alt="">` : `<div class="image-placeholder" id="${inputId}-placeholder">タップして画像を選択</div>`}
        </div>
        <div class="image-actions">
          <button type="button" class="btn-image-select" onclick="document.getElementById('${inputId}-file').click()">画像を選択</button>
          ${currentImage ? `<button type="button" class="btn-image-clear" onclick="clearImage('${inputId}')">削除</button>` : ''}
        </div>
        <p class="image-path-display" id="${inputId}-path">${currentImage ? `パス: ${currentImage}` : ''}</p>
      </div>
    </div>
  `;
}

// 画像選択処理
function handleImageSelect(input, inputId) {
  const file = input.files[0];
  if (!file) return;

  const pathEl = document.getElementById(`${inputId}-path`);
  if (pathEl) pathEl.textContent = IS_API_MODE ? 'アップロード中...' : '';

  // FileReaderでBase64に変換
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;

    // プレビュー更新
    const container = document.getElementById(`${inputId}-preview-container`);
    container.innerHTML = `<img class="image-preview-large" id="${inputId}-preview" src="${base64}" alt="">`;

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
      document.getElementById(inputId).value = imagePath;
      if (pathEl) pathEl.textContent = `パス: ${imagePath}`;

      setImagePathForInputId(inputId, imagePath);

      markChanged();
      return;
    }

    // API運用: Cloudflare(R2)へアップロードしてURLを保存
    activeImageUploads.add(inputId);
    uploadImageToApi(file)
      .then((result) => {
        document.getElementById(inputId).value = result.url;
        if (pathEl) pathEl.textContent = `URL: ${result.url}`;
        setImagePathForInputId(inputId, result.url);
        markChanged();
      })
      .catch((err) => {
        if (pathEl) pathEl.textContent = '';
        showToast(`画像アップロード失敗: ${err.message}`, 'error');
      })
      .finally(() => {
        activeImageUploads.delete(inputId);
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
  reader.readAsDataURL(file);
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
  document.getElementById(`${inputId}-path`).textContent = '';

  // クリアボタンを削除
  const clearBtn = container.parentElement.querySelector('.btn-image-clear');
  if (clearBtn) clearBtn.remove();

  setImagePathForInputId(inputId, '');
  if (inputId === 'profile-image' || inputId === 'site-hero-image') {
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

// Live追加
function addLive() {
  isNewItem = true;
  currentEditType = 'live-upcoming';
  currentEditId = 'live-' + Date.now();

  showModal('新規Live', `
    <div class="form-group">
      <label>日付</label>
      <input type="text" id="edit-date" class="text-input" placeholder="2025.01.01">
    </div>
    <div class="form-group">
      <label>ライブ名（任意）</label>
      <input type="text" id="edit-title" class="text-input" placeholder="例: 〇〇企画 / 〇〇 presents...">
    </div>
    <div class="form-group">
      <label>会場</label>
      <input type="text" id="edit-venue" class="text-input" placeholder="下北沢XXX">
    </div>
    <div class="form-group">
      <label>詳細</label>
      <textarea id="edit-description" class="textarea" rows="3">open/start &#10;adv/door &#10;w.</textarea>
    </div>
    ${getImageFormHtml('')}
    <div class="form-group">
      <label>リンクURL</label>
      <input type="url" id="edit-link" class="text-input" placeholder="https://...">
    </div>
    <div class="checkbox-group">
      <input type="checkbox" id="edit-isPast">
      <label for="edit-isPast">公演終了</label>
    </div>
    <div class="subsection" style="margin-top: 16px;">
      <h3>告知文</h3>
      <div class="form-group">
        <label>テキスト</label>
        <textarea id="x-preview-text" class="textarea" rows="6" placeholder="ここに告知文が入ります（必要なら編集）"></textarea>
        <p class="field-hint">「告知文を生成」で作成し、必要なら手入力で調整して「Xに反映」を押してください（フライヤー画像のOGP付きリンクを付けます）。※APIモードなら自動保存してから開きます。※ブラウザでログイン中のアカウントで開きます。</p>
      </div>
      <div class="field-row">
        <button type="button" class="btn btn-secondary btn-compact" id="x-preview-refresh-btn">告知文を生成</button>
        <button type="button" class="btn btn-primary btn-compact" id="x-apply-btn">Xに反映</button>
        <button type="button" class="btn btn-secondary btn-compact btn-mini" id="x-share-copy-btn" title="インスタストーリー等に貼るリンクをコピー">リンクコピー</button>
      </div>
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'none';

  wireXPreviewInModal();
}

// Live編集
function editLive(id, category) {
  const list = category === 'upcoming' ? siteData.live.upcoming : siteData.live.past;
  const item = list.find(l => l.id === id);
  if (!item) return;

  isNewItem = false;
  currentEditType = `live-${category}`;
  currentEditId = id;

  showModal('Live編集', `
    <div class="form-group">
      <label>日付</label>
      <input type="text" id="edit-date" class="text-input" value="${escapeHtml(item.date)}">
    </div>
    <div class="form-group">
      <label>ライブ名（任意）</label>
      <input type="text" id="edit-title" class="text-input" value="${escapeHtml(item.title || '')}" placeholder="例: 〇〇企画 / 〇〇 presents...">
    </div>
    <div class="form-group">
      <label>会場</label>
      <input type="text" id="edit-venue" class="text-input" value="${escapeHtml(item.venue)}">
    </div>
    <div class="form-group">
      <label>詳細</label>
      <textarea id="edit-description" class="textarea" rows="3">${escapeHtml(item.description)}</textarea>
    </div>
    ${getImageFormHtml(item.image)}
    <div class="form-group">
      <label>詳細リンクURL（instagramなど/任意）</label>
      <input type="url" id="edit-link" class="text-input" value="${escapeHtml(item.link)}">
    </div>
    <div class="checkbox-group">
      <input type="checkbox" id="edit-isPast" ${category === 'past' ? 'checked' : ''}>
      <label for="edit-isPast">公演終了</label>
    </div>
    <div class="subsection" style="margin-top: 16px;">
      <h3>告知文</h3>
      <div class="form-group">
        <label>テキスト</label>
        <textarea id="x-preview-text" class="textarea" rows="6" placeholder="ここに告知文が入ります（必要なら編集）"></textarea>
        <p class="field-hint">「告知文を生成」で作成し、必要なら手入力で調整して「Xに反映」を押してください（フライヤー画像のOGP付きリンクを付けます）。※APIモードなら自動保存してから開きます。※ブラウザでログイン中のアカウントで開きます。</p>
      </div>
      <div class="field-row">
        <button type="button" class="btn btn-secondary btn-compact" id="x-preview-refresh-btn">告知文を生成</button>
        <button type="button" class="btn btn-primary btn-compact" id="x-apply-btn">Xに反映</button>
        <button type="button" class="btn btn-secondary btn-compact btn-mini" id="x-share-copy-btn" title="インスタストーリー等に貼るリンクをコピー">リンクコピー</button>
      </div>
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'block';

  wireXPreviewInModal();
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
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// モーダル閉じる
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('modal').classList.remove('active');
  document.body.style.overflow = '';
  currentEditType = null;
  currentEditId = null;
  isNewItem = false;
}

// モーダル保存
async function saveModal() {
  let ok = true;
  if (!ensureNoActiveImageUploads()) return;
  if (currentEditType === 'news') {
    saveNewsItem();
  } else if (currentEditType.startsWith('live')) {
    saveLiveItem();
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
  const item = {
    id: currentEditId,
    date: document.getElementById('edit-date').value,
    title: document.getElementById('edit-title')?.value || '',
    venue: document.getElementById('edit-venue').value,
    description: document.getElementById('edit-description').value,
    image: document.getElementById('edit-image').value,
    link: document.getElementById('edit-link').value
  };

  // 元のカテゴリから削除
  const originalCategory = currentEditType.split('-')[1];
  const originalList = originalCategory === 'upcoming' ? siteData.live.upcoming : siteData.live.past;
  const originalIndex = originalList.findIndex(l => l.id === currentEditId);
  if (originalIndex !== -1) {
    originalList.splice(originalIndex, 1);
  }

  // 新しいカテゴリに追加
  if (isPast) {
    siteData.live.past.unshift(item);
  } else {
    siteData.live.upcoming.unshift(item);
  }

  renderLive();
  return { liveId: item.id, postToX: false };
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
  if (!confirm('削除しますか？')) return;

  if (currentEditType === 'news') {
    siteData.news = siteData.news.filter(n => n.id !== currentEditId);
    renderNews();
  } else if (currentEditType.startsWith('live')) {
    const category = currentEditType.split('-')[1];
    if (category === 'upcoming') {
      siteData.live.upcoming = siteData.live.upcoming.filter(l => l.id !== currentEditId);
    } else {
      siteData.live.past = siteData.live.past.filter(l => l.id !== currentEditId);
    }
    renderLive();
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
  saveBtn.textContent = '保存 *';
  saveBtn.classList.remove('saved');
}

function setSaveStateSaved(silent = false) {
  hasChanges = false;
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.textContent = '保存済';
  saveBtn.classList.add('saved');

  if (!silent) {
    showToast('保存しました', 'success');
  }
  setTimeout(() => {
    saveBtn.textContent = '保存';
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
  if (isSaving) return false;
  if (!ensureNoActiveImageUploads()) return false;
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

function buildTweetTextForAdmin(live) {
  const rawDescription = String((live && live.description) || '').replace(/<br\s*\/?>/gi, '\n');
  const descLines = rawDescription
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const header = '【LIVE】';
  const eventTitle = String(live?.title || '').trim();
  const heading = `${String(live?.date || '日付未設定').trim()} ${String(live?.venue || '').trim()}`.trim();

  const blocks = [header];
  if (eventTitle) blocks.push(eventTitle);
  if (heading) blocks.push(heading);
  if (descLines.length > 0) {
    blocks.push('');
    blocks.push(...descLines);
  }

  let text = blocks.join('\n').trim();
  if (text.length <= 280) return text;

  // 1) Remove blank line separation.
  text = [header, eventTitle, heading, ...descLines].filter(Boolean).join('\n').trim();
  if (text.length <= 280) return text;

  // 2) Compact description and truncate.
  const compact = descLines.join(' / ');
  const shortened = compact ? compact.slice(0, 120) + '…' : '';
  text = [header, eventTitle, heading, shortened].filter(Boolean).join('\n').trim();
  if (text.length <= 280) return text;

  // 3) Last resort.
  text = [header, eventTitle, heading].filter(Boolean).join('\n').trim();
  return text.slice(0, 280);
}

function readLiveFromModal() {
  return {
    id: currentEditId,
    date: document.getElementById('edit-date')?.value || '',
    title: document.getElementById('edit-title')?.value || '',
    venue: document.getElementById('edit-venue')?.value || '',
    description: document.getElementById('edit-description')?.value || '',
    link: document.getElementById('edit-link')?.value || ''
  };
}

function updateXPreviewInModal(options = {}) {
  const previewEl = document.getElementById('x-preview-text');
  if (!previewEl) return;

  const force = options && typeof options === 'object' && options.force === true;

  const live = readLiveFromModal();
  const autoText = buildTweetTextForAdmin(live);

  if (force || !xPreviewDirty || previewEl.value === xPreviewLastAutoText) {
    previewEl.value = autoText;
    xPreviewDirty = false;
  }

  xPreviewLastAutoText = autoText;
}

function wireXPreviewInModal() {
  const previewEl = document.getElementById('x-preview-text');
  if (!previewEl) return;

  xPreviewDirty = false;
  xPreviewLastAutoText = '';

  updateXPreviewInModal({ force: true });

  document.getElementById('x-preview-refresh-btn')?.addEventListener('click', () => {
    xPreviewDirty = false;
    updateXPreviewInModal({ force: true });
  });

  document.getElementById('x-share-copy-btn')?.addEventListener('click', async () => {
    const live = readLiveFromModal();
    const ogUrl = buildLiveOgUrl(live.id);
    const fallbackUrl = `https://1212hp.com/live/detail/?liveId=${encodeURIComponent(String(live.id || ''))}`;
    const url = ogUrl || fallbackUrl;
    if (!url) {
      showToast('リンクを生成できませんでした', 'error');
      return;
    }
    const ok = await copyToClipboard(url);
    if (!ok) {
      showToast('クリップボードにコピーできませんでした', 'error');
      return;
    }
    showToast('リンクをコピーしました', 'success');
  });

  document.getElementById('x-apply-btn')?.addEventListener('click', async () => {
    // Open a window synchronously to avoid popup blockers.
    // If it fails, offer to open in this tab as a fallback.
    const w = window.open('', '_blank');
    const closeW = () => { try { if (w && !w.closed) w.close(); } catch (_e) {} };

    try {
      if (w && w.document) {
        w.document.open();
        const homeUrl = (() => {
          try { return new URL('./', window.location.href).toString(); } catch (_e) { return (window.location && window.location.origin ? window.location.origin + '/' : '/'); }
        })();
        const homeUrlJs = JSON.stringify(homeUrl);

        // Some mobile browsers may keep this tab blank if they block navigation after async work.
        // If X doesn't open quickly, fall back to the home so the user isn't left on a white page.
        w.document.write(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening X...</title>
    <style>
      body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; padding: 18px; margin: 0; }
      p { margin: 0 0 12px; color: #111; line-height: 1.6; }
      a { color: #111; }
    </style>
  </head>
  <body>
    <p>X投稿画面を開いています...</p>
    <p>もしこの画面のままなら、数秒後にホームへ戻ります。</p>
    <p><a href="${homeUrl}" rel="noopener">ホームへ戻る</a></p>
    <script>
      try { setTimeout(function () { location.replace(${homeUrlJs}); }, 2500); } catch (e) {}
    </script>
  </body>
</html>`);
        w.document.close();
      }

      if (!ensureNoActiveImageUploads()) { closeW(); return; }

      // Determine if the modal edits differ from current siteData.
      const draft = {
        id: currentEditId,
        date: document.getElementById('edit-date')?.value || '',
        title: document.getElementById('edit-title')?.value || '',
        venue: document.getElementById('edit-venue')?.value || '',
        description: document.getElementById('edit-description')?.value || '',
        image: document.getElementById('edit-image')?.value || '',
        link: document.getElementById('edit-link')?.value || '',
        isPast: Boolean(document.getElementById('edit-isPast')?.checked)
      };

      const upcoming = Array.isArray(siteData?.live?.upcoming) ? siteData.live.upcoming : [];
      const past = Array.isArray(siteData?.live?.past) ? siteData.live.past : [];
      const storedUpcoming = upcoming.find((v) => String(v.id) === String(draft.id)) || null;
      const storedPast = past.find((v) => String(v.id) === String(draft.id)) || null;
      const stored = storedUpcoming || storedPast;
      const storedIsPast = Boolean(storedPast);

      const norm = (v) => String(v || '').trim();
      const isDirty = !stored
        || storedIsPast !== Boolean(draft.isPast)
        || norm(stored.date) !== norm(draft.date)
        || norm(stored.title) !== norm(draft.title)
        || norm(stored.venue) !== norm(draft.venue)
        || norm(stored.description) !== norm(draft.description)
        || norm(stored.image) !== norm(draft.image)
        || norm(stored.link) !== norm(draft.link);

      // Persist current modal edits so the OGP page can resolve live data.
      if (isDirty) {
        saveLiveItem();
        markChanged();

        if (IS_API_MODE) {
          const saved = await saveData({ silent: true });
          if (!saved) {
            const proceed = confirm('保存に失敗しました。保存せずにXを開きますか？');
            if (!proceed) { closeW(); return; }
          }
        }
      }

      const live = readLiveFromModal();
      const rawText = String(previewEl.value || '').trim() || buildTweetTextForAdmin(live);
      const baseText = stripUrlsFromTweetText(rawText);
      if (!baseText) { closeW(); return; }

      const ogBase = buildLiveOgUrl(live.id);
      const ogUrl = ogBase ? `${ogBase}${ogBase.includes('?') ? '&' : '?'}v=${Date.now().toString(36)}` : '';
      const fallbackUrl = `https://1212hp.com/live/detail/?liveId=${encodeURIComponent(String(live.id || ''))}`;
      const url = ogUrl || fallbackUrl;

      // Put URL in text to ensure it is attached even if the 'url=' param is ignored by client.
      const intentText = `${baseText}\n${url}`;
      const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(intentText)}`;

      if (w && !w.closed) {
        w.location.href = intentUrl;
        try { w.opener = null; } catch (_e) {}
        try {
          const returnHomeUrl = (() => {
            try { return new URL('./', window.location.href).toString(); } catch (_e) { return (window.location && window.location.origin ? window.location.origin + '/' : '/'); }
          })();
          setTimeout(() => {
            try { if (w && !w.closed) w.location.replace(returnHomeUrl); } catch (_e2) {}
          }, 90000);
        } catch (_e) {}
        return;
      }

      const sameTab = confirm('ポップアップがブロックされています。このタブでX投稿画面を開きますか？');
      if (sameTab) window.location.href = intentUrl;
      else showToast('ポップアップを許可してから再度お試しください', 'error');
    } catch (e) {
      console.error('X intent failed', e);
      closeW();
      showToast('Xを開けませんでした。ポップアップ設定を確認して再度お試しください', 'error');
    }
  });

  previewEl.addEventListener('input', () => {
    xPreviewDirty = true;
  });

  ['edit-date', 'edit-title', 'edit-venue', 'edit-description', 'edit-link'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateXPreviewInModal);
    document.getElementById(id)?.addEventListener('change', updateXPreviewInModal);
  });
}

function stripUrlsFromTweetText(text) {
  const raw = String(text || '');
  // Remove URLs so the OGP URL is the only one in the intent.
  const urlRe = /https?:\/\/\S+/g;
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => String(line).replace(urlRe, '').trim())
    .filter(Boolean);
  return lines.join('\n').trim();
}

function buildLiveOgUrl(liveId) {
  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return '';
  const id = String(liveId || '').trim();
  if (!id) return '';
  return `${base}/og/live/${encodeURIComponent(id)}`;
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
  if (!IS_API_MODE) return '';

  const live = readLiveFromModal();
  const ogUrlBase = buildLiveOgUrl(live.id);
  if (!ogUrlBase) return '';
  // Cache-bust for X card preview; X may cache earlier failures for the same URL.
  const ogUrl = `${ogUrlBase}${ogUrlBase.includes('?') ? '&' : '?'}v=${Date.now().toString(36)}`;

  const preview = String(document.getElementById('x-preview-text')?.value || '').trim() || buildTweetTextForAdmin(live);
  const text = stripUrlsFromTweetText(preview) || '【LIVE】';

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(ogUrl)}`;
}

function openXIntentFromModal() {
  if (!IS_API_MODE) {
    showToast('Web IntentはAPIモードでのみ利用できます', 'error');
    return;
  }

  const intentUrl = buildXIntentUrlFromModal();
  if (!intentUrl) {
    showToast('Intent URLを生成できませんでした', 'error');
    return;
  }

  window.open(intentUrl, '_blank', 'noopener');
}

async function scheduleLiveToXFromModal() {
  showToast('予約投稿（X API）はこの運用では使いません。Web Intentで投稿してください', 'error');
}

async function cancelXSchedule(postId) {
  void postId;
  showToast('予約投稿（X API）はこの運用では使いません', 'error');
}

async function postLiveToX(liveId, options = {}) {
  void liveId;
  void options;
  showToast('自動投稿（X API）はこの運用では使いません。Web Intentで投稿してください', 'error');
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












