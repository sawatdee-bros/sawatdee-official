// サワディ兄弟 公式サイト Phase 1.5
// タブ切替 + 営業時間判定 + Firebase メニュー連携

const FIREBASE_DB_URL = 'https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app';

// ===== タブ切替（スクロール式） =====
const PAGE_NAMES = ['home', 'menu', 'concept', 'interior', 'info'];
let _suppressObserver = false;

function setActiveTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  if (location.hash !== '#' + name) {
    history.replaceState(null, '', '#' + name);
  }
  if (name === 'menu' && !window._menuLoaded) {
    loadMenu();
    window._menuLoaded = true;
  }
}

function switchTab(name) {
  const target = document.getElementById('page-' + name);
  if (!target) return;
  // ホームのときはページ最上部、それ以外はセクション先頭へ
  _suppressObserver = true;
  setActiveTab(name);
  if (name === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // smooth scroll 完了後に Observer を再開
  setTimeout(() => { _suppressObserver = false; }, 700);
}
window.switchTab = switchTab;

document.addEventListener('DOMContentLoaded', () => {
  // タブボタンのクリック
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  // 初期表示（URL hash があれば該当セクションへスクロール）
  const initial = (location.hash || '').replace('#', '');
  if (PAGE_NAMES.includes(initial) && initial !== 'home') {
    // 初回ロード時は instant でジャンプ
    requestAnimationFrame(() => {
      const target = document.getElementById('page-' + initial);
      if (target) {
        _suppressObserver = true;
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        setActiveTab(initial);
        setTimeout(() => { _suppressObserver = false; }, 200);
      }
    });
  } else {
    setActiveTab('home');
  }

  // スクロール位置に応じて active タブを更新
  // 画面中央近辺にあるセクションを active 扱い
  const observer = new IntersectionObserver(entries => {
    if (_suppressObserver) return;
    // 表示中のセクションのうち、画面上端から最も近いものを active に
    const visible = entries
      .filter(e => e.isIntersecting)
      .map(e => ({
        name: e.target.id.replace('page-', ''),
        top: e.boundingClientRect.top
      }))
      .sort((a, b) => Math.abs(a.top - 56) - Math.abs(b.top - 56));
    if (visible[0]) setActiveTab(visible[0].name);
  }, {
    rootMargin: '-56px 0px -55% 0px',
    threshold: [0, 0.25, 0.5, 0.75, 1]
  });
  PAGE_NAMES.forEach(n => {
    const el = document.getElementById('page-' + n);
    if (el) observer.observe(el);
  });

  // menu セクションが画面に近づいたら preload
  const menuPreload = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !window._menuLoaded) {
        loadMenu();
        window._menuLoaded = true;
      }
    });
  }, { rootMargin: '200px 0px' });
  const menuSec = document.getElementById('page-menu');
  if (menuSec) menuPreload.observe(menuSec);
});

// ===== 営業時間判定 (深夜営業対応・JST) =====
const HOURS = {
  0: { open: 14.0, close: 23.0 },         // 日
  1: null,                                // 月 定休
  2: null,                                // 火 定休
  3: { open: 17.5, close: 24.0 },         // 水
  4: { open: 17.5, close: 24.0 },         // 木
  5: { open: 17.5, close: 26.0 },         // 金（翌2時=26時）
  6: { open: 17.5, close: 26.0 },         // 土
};

function getOpenStatus() {
  const nowUTC = new Date();
  const utcDay = nowUTC.getUTCDay();
  const utcH = nowUTC.getUTCHours();
  const utcMin = nowUTC.getUTCMinutes();
  let jstTotalMin = utcH * 60 + utcMin + 9 * 60;
  let jstDay = utcDay;
  if (jstTotalMin >= 24 * 60) {
    jstTotalMin -= 24 * 60;
    jstDay = (jstDay + 1) % 7;
  }
  const jstHourDecimal = jstTotalMin / 60;
  const todayHours = HOURS[jstDay];
  const yesterdayHours = HOURS[(jstDay + 6) % 7];

  if (yesterdayHours && yesterdayHours.close > 24) {
    const extendedEnd = yesterdayHours.close - 24;
    if (jstHourDecimal < extendedEnd) {
      return { isOpen: true, message: '🟢 ただいま営業中' };
    }
  }
  if (todayHours) {
    const effectiveClose = todayHours.close > 24 ? 24 : todayHours.close;
    if (jstHourDecimal >= todayHours.open && jstHourDecimal < effectiveClose) {
      return { isOpen: true, message: '🟢 ただいま営業中' };
    }
    if (jstHourDecimal < todayHours.open) {
      const oh = Math.floor(todayHours.open);
      const om = Math.round((todayHours.open - oh) * 60);
      return { isOpen: false, message: '🔴 本日 ' + oh + ':' + ('0' + om).slice(-2) + ' 開店予定' };
    }
    return { isOpen: false, message: '🔴 本日の営業は終了しました' };
  }
  return { isOpen: false, message: '🔴 本日は定休日です' };
}

function updateOpenStatus() {
  const el = document.getElementById('open-now');
  if (!el) return;
  const s = getOpenStatus();
  el.textContent = s.message;
  el.classList.remove('open', 'closed');
  el.classList.add(s.isOpen ? 'open' : 'closed');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateOpenStatus);
} else {
  updateOpenStatus();
}
setInterval(updateOpenStatus, 60 * 1000);

// ===== Firebase メニュー連携 =====
let _menuData = null;
let _menuOverrides = null;
const MENU_CATS = [
  { key: 'drink', label: 'ドリンク', icon: '🍺' },
  { key: 'food',  label: 'フード',   icon: '🍽' },
  { key: 'set',   label: 'コース',   icon: '🎁' }
];

async function loadMenu() {
  const body = document.getElementById('menu-body');
  if (!body) return;
  body.innerHTML = '<div class="menu-loading">読み込み中...</div>';
  try {
    const [menuRes, ovRes] = await Promise.all([
      fetch(FIREBASE_DB_URL + '/menu.json'),
      fetch(FIREBASE_DB_URL + '/menu_overrides.json')
    ]);
    _menuData = await menuRes.json() || {};
    _menuOverrides = await ovRes.json() || {};
    renderAllMenus();
  } catch (e) {
    body.innerHTML = '<div class="menu-empty">メニューの読み込みに失敗しました。<br>少し時間をおいて再度お試しください。</div>';
    console.error('Menu load failed:', e);
  }
}

function renderAllMenus() {
  const body = document.getElementById('menu-body');
  if (!body || !_menuData) return;
  let html = '';
  MENU_CATS.forEach(cat => {
    const inner = renderMenuCat(cat.key);
    if (!inner) return;
    html += '<div class="menu-cat-block">'
      + '<h4 class="menu-cat-heading"><span class="menu-cat-icon">' + cat.icon + '</span>' + escapeHtml(cat.label) + '</h4>'
      + inner
      + '</div>';
  });
  body.innerHTML = html || '<div class="menu-empty">表示できる商品がありません。</div>';
}

function renderMenuCat(catKey) {
  const catData = _menuData[catKey] || {};
  const order = (_menuData.subcatOrder || {})[catKey] || [];
  const all = Object.keys(catData);
  const sortedSubcats = order.filter(s => all.includes(s)).concat(all.filter(s => !order.includes(s)));

  let html = '';
  let visibleCount = 0;

  sortedSubcats.forEach((sub, idx) => {
    const itemsRaw = catData[sub];
    const items = Array.isArray(itemsRaw) ? itemsRaw : Object.values(itemsRaw || {});
    // active && !hidden && !charge_exempt（お冷など）の商品のみ表示
    const visibleItems = items.filter(it => it && it.active && !it.hidden);
    if (visibleItems.length === 0) return;
    visibleCount += visibleItems.length;

    html += '<div class="menu-subcat">';
    html += '<div class="menu-subcat-title"><span class="num">' + (idx + 1) + '</span><span class="label">' + escapeHtml(sub) + '</span></div>';
    html += '<div class="menu-grid">';
    visibleItems.forEach(it => {
      // menu_overrides マージ
      const ov = (it.id && _menuOverrides[it.id]) ? _menuOverrides[it.id] : {};
      const merged = Object.assign({}, it, ov);
      html += renderMenuCard(merged);
    });
    html += '</div></div>';
  });

  return visibleCount > 0 ? html : '';
}

// img URL を正規化（Firebase に保存された相対パス /img/xxx.jpg は
// POS リポにファイルがあるので sawatdee-pos.pages.dev を起点に変換）
function normalizeImgUrl(img) {
  if (!img) return null;
  const s = String(img).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) return 'https://sawatdee-pos.pages.dev' + s;
  return 'https://sawatdee-pos.pages.dev/' + s;
}

function renderMenuCard(it) {
  const imgUrl = normalizeImgUrl(it.img);
  const img = imgUrl ? `style="background-image:url('${escapeAttr(imgUrl)}')"` : '';
  const imgCls = imgUrl ? '' : ' no-img';
  const priceLabel = it.price_type === 'inclusive' ? '税込' : '税抜';
  const price = (typeof it.price === 'number') ? it.price.toLocaleString() : '?';

  // バッジ
  let badges = '';
  if (it.popular) badges += '<span class="menu-badge badge-popular">🔥 ' + escapeHtml(String(it.popular)) + '</span>';
  if (it.sake) badges += '<span class="menu-badge badge-sake">🍺 酒に合う</span>';
  if (it.pakchi) badges += '<span class="menu-badge badge-pakchi">🌿 パクチー</span>';
  if (it.spicy && it.spicy > 0) {
    const peppers = '🌶️'.repeat(Math.min(Number(it.spicy), 5));
    badges += '<span class="menu-badge badge-spicy">' + peppers + '</span>';
  }

  const thai = it.thai ? '<div class="menu-card-thai">' + escapeHtml(it.thai) + '</div>' : '';
  const desc = it.desc ? '<div class="menu-card-desc">' + escapeHtml(it.desc) + '</div>' : '';
  const badgesBlock = badges ? '<div class="menu-card-badges">' + badges + '</div>' : '';

  return '<article class="menu-card">'
    + '<div class="menu-card-img' + imgCls + '" ' + img + '></div>'
    + '<div class="menu-card-body">'
    + '<div class="menu-card-name">' + escapeHtml(it.name || '?') + '</div>'
    + thai
    + '<div class="menu-card-price">¥' + price + ' <span style="font-size:10px;color:#9CA3AF;font-weight:400;">(' + priceLabel + ')</span></div>'
    + desc
    + badgesBlock
    + '</div>'
    + '</article>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
