// 1212 HP Admin - App.js

const DEFAULT_SITE_DATA = {
  news: [],
  live: { ticketLink: '', upcoming: [], past: [] },
  discography: { digital: [], demo: [] },
  profile: { image: '', text: '', links: [] }
};

const ADMIN_CONFIG = window.ADMIN_CONFIG || {};
const API_BASE_URL = (ADMIN_CONFIG.apiBaseUrl || '').replace(/\/+$/, '');
const IS_API_MODE = Boolean(API_BASE_URL);
const ADMIN_TOKEN_STORAGE_KEY = '1212hp_admin_token';
let adminToken = (ADMIN_CONFIG.adminToken || localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '').trim();

let siteData = null;
let currentEditType = null;
let currentEditId = null;
let isNewItem = false;
let hasChanges = false;
let isSaving = false;
let xPostStatusMap = {};
let postingLiveIds = new Set();

// 新規追加した画像を保存（{filename: base64data}）
let pendingImages = {};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  renderModeBadge();
  await loadData();
  setupTabs();
  renderAll();
});

function renderModeBadge() {
  const modeBadge = document.getElementById('modeBadge');
  const banner = document.getElementById('connectionBanner');
  if (!modeBadge || !banner) return;

  if (IS_API_MODE) {
    modeBadge.textContent = 'API Mode';
    banner.textContent = 'Cloudflare APIへ接続中...';
    banner.classList.add('is-api');
    banner.classList.remove('is-error');
    return;
  }

  modeBadge.textContent = 'Local Mode';
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
  return normalized;
}

function getErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (payload.error) return payload.error;
  if (payload.message) return payload.message;
  return fallback;
}

async function ensureAdminToken() {
  if (!IS_API_MODE) return true;
  if (adminToken) return true;
  const entered = window.prompt('管理トークンを入力してください（初回のみ）', '');
  if (!entered) return false;
  adminToken = String(entered).trim();
  if (!adminToken) return false;
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
  return true;
}

async function adminFetch(path, options = {}) {
  if (!(await ensureAdminToken())) {
    throw new Error('管理トークン未設定');
  }
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }
  // Let the browser set Content-Type for FormData.
  if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

async function loadXPostStatuses() {
  if (!IS_API_MODE) return;
  try {
    const response = await adminFetch('/api/admin/x-posts');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'X投稿履歴を取得できませんでした'));
    }
    const posts = Array.isArray(payload.posts) ? payload.posts : [];
    const map = {};
    for (const post of posts) {
      const liveId = post.liveId || post.live_id;
      if (!liveId || map[liveId]) continue;
      map[liveId] = {
        status: post.status || 'unknown',
        tweetUrl: post.tweetUrl || post.tweet_url || '',
        createdAt: post.createdAt || post.created_at || ''
      };
    }
    xPostStatusMap = map;
  } catch (error) {
    console.error('X投稿履歴読み込みエラー:', error);
  }
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
  const badgeColor = status === 'pending' ? 'var(--danger)' : status === 'handled' ? 'var(--success)' : 'var(--gray-500)';
  const title = `${r.liveDate || ''} ${r.liveVenue || ''}`.trim();
  const meta = `${r.name || ''} / ${r.quantity || 1}枚 / ${r.email || ''}`.trim();
  const msg = r.message ? `<div class="meta" style="margin-top:6px; white-space:pre-wrap;">${escapeHtml(r.message)}</div>` : '';
  const actions = status === 'pending'
    ? `<button class="x-test-btn" onclick="markTicketStatus('${escapeHtml(r.id)}','handled')">対応済み</button>
       <button class="x-post-btn" onclick="markTicketStatus('${escapeHtml(r.id)}','cancelled')">キャンセル</button>`
    : `<button class="x-test-btn" onclick="markTicketStatus('${escapeHtml(r.id)}','pending')">未対応に戻す</button>`;

  return `
    <div class="item-card" style="cursor: default;">
      <div class="info">
        <div class="title">${escapeHtml(title || r.liveId || '')}</div>
        <div class="meta">${escapeHtml(meta)}</div>
        ${msg}
        <div class="meta" style="margin-top:6px;">${escapeHtml(r.createdAt || '')}</div>
      </div>
      <div class="actions" style="flex-direction: column; align-items: flex-end;">
        <span style="font-size:0.75em; font-weight:bold; color:${badgeColor};">${escapeHtml(statusLabel)}</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
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
      await loadXPostStatuses();
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
  renderNews();
  renderLive();
  renderTicketsUi();
  renderDiscography();
  renderProfile();
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

function getLiveStatus(itemId) {
  return xPostStatusMap[itemId] || null;
}

function renderLiveItem(item, category) {
  const status = getLiveStatus(item.id);
  const isPosting = postingLiveIds.has(item.id);
  const buttonClass = [
    'x-post-btn',
    status && status.status === 'success' ? 'is-posted' : '',
    isPosting ? 'is-busy' : ''
  ].filter(Boolean).join(' ');
  const testButtonClass = [
    'x-test-btn',
    isPosting ? 'is-busy' : ''
  ].filter(Boolean).join(' ');
  const label = isPosting ? '投稿中...' : (status && status.status === 'success' ? '再投稿' : 'X投稿');
  const testLabel = isPosting ? '確認中...' : 'Xテスト';
  const linkHtml = status && status.tweetUrl
    ? `<a class="x-link" href="${escapeHtml(status.tweetUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">投稿を見る</a>`
    : '';

  return `
    <div class="item-card ${category === 'past' ? 'past' : ''}" onclick="editLive('${item.id}', '${category}')">
      <img class="thumbnail" src="${getImageSrc(item.image)}" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="title">${escapeHtml(item.venue)}</div>
        <div class="meta">${escapeHtml(item.date)}</div>
      </div>
      <div class="actions">
        <button class="${testButtonClass}" onclick="event.stopPropagation(); testLivePostToX('${item.id}')">${testLabel}</button>
        <button class="${buttonClass}" onclick="event.stopPropagation(); postLiveToX('${item.id}')">${label}</button>
        ${linkHtml}
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
  const ticketInput = document.getElementById('ticket-link');
  ticketInput.value = siteData.live.ticketLink || '';
  ticketInput.onchange = () => {
    siteData.live.ticketLink = ticketInput.value;
    markChanged();
  };

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

      if (inputId === 'profile-image') {
        siteData.profile.image = imagePath;
      }

      markChanged();
      return;
    }

    // API運用: Cloudflare(R2)へアップロードしてURLを保存
    uploadImageToApi(file)
      .then((result) => {
        document.getElementById(inputId).value = result.url;
        if (pathEl) pathEl.textContent = `URL: ${result.url}`;
        if (inputId === 'profile-image') {
          siteData.profile.image = result.url;
        }
        markChanged();
      })
      .catch((err) => {
        if (pathEl) pathEl.textContent = '';
        showToast(`画像アップロード失敗: ${err.message}`, 'error');
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

  if (inputId === 'profile-image') {
    siteData.profile.image = '';
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
      <label>リンクURL</label>
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
      <label>会場</label>
      <input type="text" id="edit-venue" class="text-input" placeholder="下北沢XXX">
    </div>
    <div class="form-group">
      <label>詳細</label>
      <textarea id="edit-description" class="textarea" rows="3" placeholder="open/start TBA&#10;adv/door ¥2500 (+1d)"></textarea>
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
    <div class="checkbox-group">
      <input type="checkbox" id="edit-postToX">
      <label for="edit-postToX">保存後にXへ投稿（開催予定のみ）</label>
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'none';
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
      <label>会場</label>
      <input type="text" id="edit-venue" class="text-input" value="${escapeHtml(item.venue)}">
    </div>
    <div class="form-group">
      <label>詳細</label>
      <textarea id="edit-description" class="textarea" rows="3">${escapeHtml(item.description)}</textarea>
    </div>
    ${getImageFormHtml(item.image)}
    <div class="form-group">
      <label>リンクURL</label>
      <input type="url" id="edit-link" class="text-input" value="${escapeHtml(item.link)}">
    </div>
    <div class="checkbox-group">
      <input type="checkbox" id="edit-isPast" ${category === 'past' ? 'checked' : ''}>
      <label for="edit-isPast">公演終了</label>
    </div>
    <div class="checkbox-group">
      <input type="checkbox" id="edit-postToX" ${category === 'past' ? 'disabled' : ''}>
      <label for="edit-postToX">保存後にXへ投稿（開催予定のみ）</label>
    </div>
  `);
  document.getElementById('delete-btn').style.display = 'block';
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
  let liveAction = null;
  if (currentEditType === 'news') {
    saveNewsItem();
  } else if (currentEditType.startsWith('live')) {
    liveAction = saveLiveItem();
  } else if (currentEditType.startsWith('discography')) {
    saveDiscographyItem();
  }

  closeModal();
  markChanged();

  if (liveAction && liveAction.postToX) {
    if (!IS_API_MODE) {
      showToast('X投稿はAPIモードでのみ利用できます', 'error');
      return;
    }
    const saved = await saveData({ silent: true });
    if (saved) {
      await postLiveToX(liveAction.liveId, { skipUnsavedCheck: true });
    }
  }
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
  const shouldPostToX = !isPast && document.getElementById('edit-postToX')?.checked;
  const item = {
    id: currentEditId,
    date: document.getElementById('edit-date').value,
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
  return { liveId: item.id, postToX: Boolean(shouldPostToX) };
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

async function testLivePostToX(liveId) {
  return postLiveToX(liveId, { dryRun: true });
}

async function postLiveToX(liveId, options = {}) {
  if (!IS_API_MODE) {
    showToast('X投稿はAPIモードでのみ利用できます', 'error');
    return;
  }
  if (!options.skipUnsavedCheck && hasChanges) {
    showToast('先に保存してからX投稿してください', 'error');
    return;
  }
  if (postingLiveIds.has(liveId)) return;

  postingLiveIds.add(liveId);
  renderLive();
  try {
    const dryRun = Boolean(options.dryRun);
    const query = dryRun ? '?dryRun=1' : '';
    const response = await adminFetch(`/api/admin/live/${encodeURIComponent(liveId)}/post-x${query}`, {
      method: 'POST'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'X投稿に失敗しました'));
    }
    if (dryRun) {
      const account = payload.account || {};
      const accountLabel = account.screenName ? ` @${account.screenName}` : '';
      showToast(`Xテスト成功（投稿なし）${accountLabel}`, 'success');
      return;
    }
    xPostStatusMap[liveId] = {
      status: 'success',
      tweetUrl: payload.tweet?.url || payload.tweetUrl || '',
      createdAt: payload.createdAt || new Date().toISOString()
    };
    showToast('Xへ投稿しました', 'success');
  } catch (error) {
    const label = options.dryRun ? 'Xテスト失敗' : 'X投稿失敗';
    showToast(`${label}: ${error.message}`, 'error');
  } finally {
    postingLiveIds.delete(liveId);
    renderLive();
  }
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
