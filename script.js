// サワディ兄弟 公式サイト Phase 1
// 営業時間の動的判定（深夜営業対応・JST 前提）

(function() {
  // 営業時間定義 (memory: project_store_hours.md - 2026-05-09 確認)
  // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  // openHour: 開始時刻 (24h), closeHour: 終了時刻 (24h、25 以上は翌日扱い)
  const HOURS = {
    0: { open: 14.0, close: 23.0 },         // 日 14:00 – 23:00
    1: null,                                // 月 定休
    2: null,                                // 火 定休
    3: { open: 17.5, close: 24.0 },         // 水 17:30 – 24:00
    4: { open: 17.5, close: 24.0 },         // 木 17:30 – 24:00
    5: { open: 17.5, close: 26.0 },         // 金 17:30 – 翌2:00 (=26時)
    6: { open: 17.5, close: 26.0 },         // 土 17:30 – 翌2:00
  };

  // 現在の日本時間で営業中か判定
  function getOpenStatus() {
    const nowUTC = new Date();
    // JST offset = +9h
    const jstOffsetMin = 9 * 60;
    const nowJst = new Date(nowUTC.getTime() + (jstOffsetMin - nowUTC.getTimezoneOffset()) * -60000 + jstOffsetMin * 60000);
    // 上式は煩雑なので、シンプルに UTC からの分計算で書き直す:
    // ブラウザ依存を避けるため getUTC* を使う
    const utcDay = nowUTC.getUTCDay();
    const utcH = nowUTC.getUTCHours();
    const utcMin = nowUTC.getUTCMinutes();
    // JST = UTC + 9h
    let jstTotalMin = utcH * 60 + utcMin + 9 * 60;
    let jstDay = utcDay;
    if (jstTotalMin >= 24 * 60) {
      jstTotalMin -= 24 * 60;
      jstDay = (jstDay + 1) % 7;
    }
    const jstH = Math.floor(jstTotalMin / 60);
    const jstMin = jstTotalMin % 60;
    const jstHourDecimal = jstH + jstMin / 60;

    // 今日の営業時間 (今日が定休でも、昨日の深夜営業が今日に被ってる場合あり)
    const todayHours = HOURS[jstDay];
    const yesterdayDay = (jstDay + 6) % 7;
    const yesterdayHours = HOURS[yesterdayDay];

    // ケース1: 昨日が深夜営業 (close > 24) で、今日の早朝 (jstH < close - 24) なら営業中
    if (yesterdayHours && yesterdayHours.close > 24) {
      const extendedEnd = yesterdayHours.close - 24;
      if (jstHourDecimal < extendedEnd) {
        return { isOpen: true, message: '🟢 ただいま営業中' };
      }
    }

    // ケース2: 今日の通常営業時間内か
    if (todayHours) {
      const effectiveClose = todayHours.close > 24 ? 24 : todayHours.close;
      if (jstHourDecimal >= todayHours.open && jstHourDecimal < effectiveClose) {
        return { isOpen: true, message: '🟢 ただいま営業中' };
      }
      // 開店前
      if (jstHourDecimal < todayHours.open) {
        const oh = Math.floor(todayHours.open);
        const om = Math.round((todayHours.open - oh) * 60);
        return { isOpen: false, message: '🔴 本日 ' + oh + ':' + ('0' + om).slice(-2) + ' 開店予定' };
      }
      // 閉店後（深夜営業のオーバーフロー部分はケース1で処理済）
      return { isOpen: false, message: '🔴 本日の営業は終了しました' };
    }

    // 今日が定休日
    return { isOpen: false, message: '🔴 本日は定休日です' };
  }

  function updateOpenStatus() {
    const el = document.getElementById('open-now');
    if (!el) return;
    const status = getOpenStatus();
    el.textContent = status.message;
    el.classList.remove('open', 'closed');
    el.classList.add(status.isOpen ? 'open' : 'closed');
  }

  // 初期表示 + 1分ごとに更新
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateOpenStatus);
  } else {
    updateOpenStatus();
  }
  setInterval(updateOpenStatus, 60 * 1000);
})();
