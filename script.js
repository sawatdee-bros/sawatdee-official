// サワディ兄弟 公式サイト Phase 1.5
// タブ切替 + 営業時間判定 + Firebase メニュー連携

const FIREBASE_DB_URL = 'https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app';

// ===== タブ切替（スクロール式） =====
const PAGE_NAMES = ['home', 'concept', 'menu', 'interior', 'info'];
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
// fallback: Firebase 未投入時用。Firebase の store_config/business_hours_by_dow が
// 取得できれば上書きされる
const FALLBACK_HOURS = {
  0: { open: 14.0, close: 23.0 },         // 日
  1: null,                                // 月 定休
  2: null,                                // 火 定休
  3: { open: 17.5, close: 24.0 },         // 水
  4: { open: 17.5, close: 24.0 },         // 木
  5: { open: 17.5, close: 26.0 },         // 金（翌2時=26時）
  6: { open: 17.5, close: 26.0 },         // 土
};
let HOURS = Object.assign({}, FALLBACK_HOURS);

// 'HH:MM' を時分小数（24時間超え対応）に変換: '17:30' → 17.5, '26:00' → 26.0
function timeStrToDecimal(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
}

// business_hours_by_dow ({ '0': [{start,end}], '1': [], ... }) を HOURS 形式に変換
// 複数 range には対応せず、最初の range だけ採用（公式サイト用途では十分）
// end < start なら翌日扱い（深夜営業）→ close = end_decimal + 24
function applyBusinessHours(byDow) {
  if (!byDow || typeof byDow !== 'object') return;
  const next = {};
  for (let d = 0; d < 7; d++) {
    const key = String(d);
    const ranges = byDow[key];
    if (!Array.isArray(ranges) || ranges.length === 0) {
      next[d] = null;
      continue;
    }
    const r = ranges[0];
    const open = timeStrToDecimal(r.start);
    let close = timeStrToDecimal(r.end);
    if (isNaN(open) || isNaN(close)) { next[d] = null; continue; }
    // end <= start なら翌日扱い（深夜営業）。ただし end が 24+ の表記なら既に翌日扱い済み
    if (close <= open) close += 24;
    next[d] = { open: open, close: close };
  }
  HOURS = next;
}

// 住所/電話/地図リンクを描画
function applyStoreInfo(address, phone) {
  if (address) {
    const addrEl = document.getElementById('store-address');
    if (addrEl) addrEl.textContent = address;
    const enc = encodeURIComponent(address);
    const linkEl = document.getElementById('store-map-link');
    if (linkEl) linkEl.href = 'https://www.google.com/maps/search/?api=1&query=' + enc;
    const ifr = document.getElementById('store-map-iframe');
    if (ifr) ifr.src = 'https://maps.google.com/maps?q=' + enc + '&output=embed';
  }
  if (phone) {
    const phoneEl = document.getElementById('store-phone');
    if (phoneEl) {
      phoneEl.textContent = phone;
      phoneEl.href = 'tel:' + phone.replace(/[^\d+]/g, '');
    }
  }
}

// Firebase から店舗基本情報（営業時間・住所・電話）を取得（失敗時は HTML 既定値のまま）
async function loadStoreInfo() {
  try {
    const r = await fetch(FIREBASE_DB_URL + '/store_config.json');
    if (!r.ok) return;
    const cfg = await r.json();
    if (!cfg) return;
    if (cfg.business_hours_by_dow) {
      applyBusinessHours(cfg.business_hours_by_dow);
      updateOpenStatus();
      renderHoursTable();
    }
    applyStoreInfo(cfg.store_address, cfg.store_phone);
  } catch (e) {
    console.warn('Failed to load store_config:', e);
  }
}

const CLOSING_SOON_HOURS = 1.5; // 閉店何時間前から「閉店間近」表示にするか

function buildOpenMessage(closeDecimal, hoursRemaining) {
  const closeStr = fmtTime(closeDecimal);
  if (hoursRemaining <= CLOSING_SOON_HOURS) {
    return {
      isOpen: true,
      closingSoon: true,
      message: '🟡 本日 ' + closeStr + ' まで営業\n閉店間近の場合はお電話でご確認ください'
    };
  }
  return {
    isOpen: true,
    closingSoon: false,
    message: '🟢 本日 ' + closeStr + ' まで営業'
  };
}

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

  // 前日からの深夜営業（例: 土曜の翌2:00まで → 日曜0:00〜2:00 もまだ営業中）
  if (yesterdayHours && yesterdayHours.close > 24) {
    const extendedEnd = yesterdayHours.close - 24;
    if (jstHourDecimal < extendedEnd) {
      return buildOpenMessage(extendedEnd, extendedEnd - jstHourDecimal);
    }
  }
  if (todayHours) {
    const effectiveClose = todayHours.close > 24 ? 24 : todayHours.close;
    if (jstHourDecimal >= todayHours.open && jstHourDecimal < effectiveClose) {
      return buildOpenMessage(todayHours.close, todayHours.close - jstHourDecimal);
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
  el.classList.remove('open', 'closed', 'soon');
  el.classList.add(s.isOpen ? 'open' : 'closed');
  if (s.closingSoon) el.classList.add('soon');
}

// 営業時間テーブルを HOURS から動的描画
// 連続する同一営業時間の曜日をグループ化（水・木 / 金・土 / 日 / 月・火）
const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function fmtTime(decimalHours) {
  // 24:00 ジャストは「24:00」、それを超える場合は「翌H:MM」表記
  if (decimalHours > 24) {
    const adj = decimalHours - 24;
    const h = Math.floor(adj);
    const m = Math.round((adj - h) * 60);
    return '翌' + h + ':' + ('0' + m).slice(-2);
  }
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return h + ':' + ('0' + m).slice(-2);
}

function renderHoursTable() {
  const ul = document.querySelector('.hours-list');
  if (!ul) return;
  // 営業時間ハッシュごとにグループ化（出力順: 水木 → 金土 → 日 → 月火）
  // 元の順序: [3,4,5,6,0,1,2] で並べて、同じ営業内容を連結
  const order = [3, 4, 5, 6, 0, 1, 2];
  const groups = [];
  let cur = null;
  order.forEach(d => {
    const h = HOURS[d];
    const sig = h ? h.open + '-' + h.close : 'CLOSED';
    if (cur && cur.sig === sig) {
      cur.dows.push(d);
    } else {
      cur = { sig, dows: [d], hours: h };
      groups.push(cur);
    }
  });
  let html = '';
  groups.forEach(g => {
    const dowStr = g.dows.map(d => DOW_LABELS[d]).join('・');
    if (!g.hours) {
      html += '<li class="closed"><span class="dow">' + dowStr + '</span><span class="time">定休日</span></li>';
    } else {
      html += '<li><span class="dow">' + dowStr + '</span><span class="time">' + fmtTime(g.hours.open) + ' – ' + fmtTime(g.hours.close) + '</span></li>';
    }
  });
  ul.innerHTML = html;
}

function bootHours() {
  updateOpenStatus();
  renderHoursTable();
  // Firebase から動的取得（取れたら上書き）
  loadStoreInfo();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootHours);
} else {
  bootHours();
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
    html += '<div class="menu-cat-block" id="menu-cat-' + cat.key + '">'
      + '<h4 class="menu-cat-heading"><span class="menu-cat-icon">' + cat.icon + '</span>' + escapeHtml(cat.label) + '</h4>'
      + inner
      + '</div>';
  });
  body.innerHTML = html || '<div class="menu-empty">表示できる商品がありません。</div>';
  setupMenuCatTabs();
}

let _suppressMenuObserver = false;
function setupMenuCatTabs() {
  const btns = document.querySelectorAll('.menu-cat-btn');
  if (!btns.length) return;
  // sticky 2層 (tab-nav 49px + sub-tabs ~50px) → scroll-margin 99px
  const SUB_NAV_H = 99;
  btns.forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.cat;
      const target = document.getElementById('menu-cat-' + cat);
      if (!target) return;
      _suppressMenuObserver = true;
      btns.forEach(b => b.classList.toggle('active', b === btn));
      const y = target.getBoundingClientRect().top + window.scrollY - SUB_NAV_H;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setTimeout(() => { _suppressMenuObserver = false; }, 700);
    };
  });
  // スクロール位置に応じて active サブタブを更新
  const obs = new IntersectionObserver(entries => {
    if (_suppressMenuObserver) return;
    const visible = entries
      .filter(e => e.isIntersecting)
      .map(e => ({ key: e.target.id.replace('menu-cat-', ''), top: e.boundingClientRect.top }))
      .sort((a, b) => Math.abs(a.top - 99) - Math.abs(b.top - 99));
    if (visible[0]) {
      btns.forEach(b => b.classList.toggle('active', b.dataset.cat === visible[0].key));
    }
  }, { rootMargin: '-99px 0px -55% 0px', threshold: [0, 0.25, 0.5] });
  MENU_CATS.forEach(c => {
    const el = document.getElementById('menu-cat-' + c.key);
    if (el) obs.observe(el);
  });
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
