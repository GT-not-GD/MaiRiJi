/* ================================================================
 * 麦日记官网 · 站内预定插件（信箱系统前端）
 * 引入方式：在 index.html 的 main.js 之后加
 *   <script src="assets/js/mairiji-mailbox-addon.js"></script>
 * main.js 只需一处小改（见部署说明）
 * ================================================================ */
(function () {
  'use strict';

  var MAILBOX_URL = 'https://script.google.com/macros/s/AKfycbzCjQC5-fo5C3s_C2qas-9k56jVvSG4WE9jBqJCZyH2TXlh0yYXvG_ok13hjlkenm1R/exec';

  /* ---------- token：顾客的随机钥匙（存本机） ---------- */
  function getToken() {
    var t = localStorage.getItem('mrj_web_token');
    if (!t) {
      t = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('mrj_web_token', t);
    }
    return t;
  }

  function post(payload) {
    return fetch(MAILBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  var STATUS_STEPS = ['pending', 'confirmed', 'baking', 'ready', 'delivered'];
  var STATUS_ZH = { pending: '待确认', 'new': '待确认', confirmed: '已确认', baking: '制作中',
    ready: '已完成', delivered: '已送达', cancelled: '已取消', cancelled_by_customer: '已取消' };

  /* 快捷提问（FAQ 机器人）：点选 → 发出提问 → 自动回复 */
  var FAQ = [
    { q: '我的面包什么时候好？', a: '您可以看上方的进度条哦～「制作中」表示面团已经在制作流程里，「已完成」就代表出炉啦。具体交付时间以订单预定时间为准 😊' },
    { q: '可以修改订单吗？', a: '订单确认前可以直接取消重新下单；确认后请在下方留言告诉我们想改什么，师傅会尽快回复您～' },
    { q: '配送范围和费用？', a: '目前配送以 Setia Alam 附近区域为主，其他区域建议选择自取。具体请留言您的地址，我们确认后回复～' },
    { q: '面包如何保存？', a: '欧包常温密封可放 2 天；切片冷冻可保存 2 周，吃前 180°C 回烤 5 分钟风味最佳。芝士蛋糕请冷藏并在 3 天内享用～' },
  ];

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent = '\
#mrj-orders-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99990;background:rgba(45,35,25,.5);display:none;align-items:flex-end;justify-content:center}\
#mrj-orders-modal.show{display:flex}\
#mrj-orders-panel{background:#fffdf9;width:100%;max-width:560px;max-height:88vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;font-family:inherit}\
@media(min-width:700px){#mrj-orders-modal{align-items:center;padding:2rem}#mrj-orders-panel{border-radius:18px}}\
.mrj-oh{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #e8dccc}\
.mrj-oh h3{margin:0;font-size:16px;color:#3e2f23}\
.mrj-oh button{background:none;border:none;font-size:18px;cursor:pointer;color:#8a7563}\
.mrj-ob{overflow-y:auto;padding:14px 18px;flex:1;overscroll-behavior:contain}\
.mrj-card{border:1px solid #e8dccc;border-radius:12px;padding:12px;margin-bottom:12px;background:#fff}\
.mrj-steps{display:flex;justify-content:space-between;margin:10px 0 4px;position:relative}\
.mrj-steps:before{content:"";position:absolute;left:10%;right:10%;top:9px;height:2px;background:#e8dccc}\
.mrj-step{position:relative;z-index:1;text-align:center;flex:1;font-size:10px;color:#a8977f}\
.mrj-step i{display:block;width:20px;height:20px;border-radius:50%;background:#f0e5d3;margin:0 auto 3px;font-style:normal;line-height:20px;font-size:11px}\
.mrj-step.done i{background:#5f8d4e;color:#fff}.mrj-step.done{color:#5f8d4e}\
.mrj-step.cur i{background:#b07d4f;color:#fff;box-shadow:0 0 0 3px rgba(176,125,79,.25)}.mrj-step.cur{color:#8a5a32;font-weight:700}\
.mrj-cancelled{color:#c05b4d;font-weight:700;font-size:13px;margin:8px 0}\
.mrj-items{font-size:12.5px;color:#5c4a38;margin:6px 0;line-height:1.6}\
.mrj-chat{background:#f6efe3;border-radius:10px;padding:10px;max-height:220px;overflow-y:auto;margin-top:10px;overscroll-behavior:contain}\
.mrj-bb{max-width:85%;padding:7px 10px;border-radius:10px;font-size:12.5px;margin-bottom:6px;line-height:1.5}\
.mrj-bb.c{background:#b07d4f;color:#fff;margin-left:auto;border-bottom-right-radius:3px}\
.mrj-bb.s{background:#fff;color:#3e2f23;border-bottom-left-radius:3px}\
.mrj-bb small{display:block;font-size:10px;opacity:.6;margin-top:2px}\
.mrj-inrow{display:flex;gap:6px;margin-top:8px}\
.mrj-inrow input{flex:1;border:1px solid #e8dccc;border-radius:8px;padding:8px 10px;font-size:13px}\
.mrj-inrow button{border:none;background:#b07d4f;color:#fff;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer}\
.mrj-faq{width:100%;margin-top:8px;border:1px solid #e8dccc;border-radius:8px;padding:8px;font-size:12.5px;color:#5c4a38;background:#fff}\
.mrj-cxl{width:100%;margin-top:8px;border:1px solid #c05b4d;color:#c05b4d;background:none;border-radius:8px;padding:8px;font-size:12.5px;cursor:pointer}\
.mrj-empty{text-align:center;color:#a8977f;padding:30px 10px;font-size:13px}\
#mrj-my-orders-link{display:block;text-align:center;margin:10px 0 4px;font-size:13px;color:#8a5a32;text-decoration:underline;cursor:pointer}\
.mrj-ask{margin-top:12px;padding:12px;background:#fff8ef;border:1px solid #eabf8f;border-radius:10px;font-size:13px;color:#5c4a38;text-align:center}\
.mrj-ask button{margin:8px 4px 0;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer}\
.mrj-ask .y{background:#25D366;color:#fff}.mrj-ask .n{background:#eee;color:#666}';
  document.head.appendChild(css);

  /* ---------- 订单窗 ---------- */
  var modal = document.createElement('div');
  modal.id = 'mrj-orders-modal';
  modal.innerHTML = '<div id="mrj-orders-panel"><div class="mrj-oh"><h3>我的订单</h3><button id="mrj-oclose">✕</button></div><div class="mrj-ob" id="mrj-obody"><div class="mrj-empty">加载中…</div></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) hideOrders(); });
  document.getElementById('mrj-oclose').addEventListener('click', hideOrders);

  var pollTimer = null;
  function showOrders() { modal.classList.add('show'); refresh(); pollTimer = setInterval(refresh, 15000); }
  function hideOrders() { modal.classList.remove('show'); clearInterval(pollTimer); }

  var localFaqLog = JSON.parse(localStorage.getItem('mrj_faq_log') || '[]');

  function refresh() {
    post({ action: 'my_status', token: getToken() }).then(function (r) {
      if (!r.ok) return;
      var body = document.getElementById('mrj-obody');
      if (!r.orders.length) {
        body.innerHTML = '<div class="mrj-empty">还没有订单记录<br>去菜单挑选喜欢的面包吧 🍞</div>';
        return;
      }
      r.orders.sort(function (a, b) { return (b.order.at || 0) - (a.order.at || 0); });
      body.innerHTML = r.orders.map(function (w) {
        var o = w.order;
        var cancelled = w.status.indexOf('cancelled') === 0;
        var stepIdx = STATUS_STEPS.indexOf(w.status === 'new' ? 'pending' : w.status);
        var steps = cancelled ? '<div class="mrj-cancelled">✕ ' + (STATUS_ZH[w.status] || '已取消') + '</div>'
          : '<div class="mrj-steps">' + ['待确认', '已确认', '制作中', '已完成', '已送达'].map(function (n, i) {
              var cls = i < stepIdx ? 'done' : i === stepIdx ? 'cur' : '';
              return '<div class="mrj-step ' + cls + '"><i>' + (i < stepIdx ? '✓' : i + 1) + '</i>' + n + '</div>';
            }).join('') + '</div>';
        var items = o.items.map(function (it) { return it.name + ' × ' + it.qty; }).join('、');
        /* 该订单的对话（含本地FAQ问答） */
        var msgs = (r.msgs || []).filter(function (m) { return !m.orderId || m.orderId === w.orderId; });
        localFaqLog.forEach(function (f) { if (f.orderId === w.orderId) msgs.push(f); });
        msgs.sort(function (a, b) { return a.at - b.at; });
        var chat = msgs.map(function (m) {
          var mine = m.from === 'customer';
          return '<div class="mrj-bb ' + (mine ? 'c' : 's') + '">' + escB(m.text) + '<small>' + fmtT(m.at) + (mine ? '' : ' · 麦日记') + '</small></div>';
        }).join('') || '<div style="text-align:center;color:#a8977f;font-size:12px">有问题可以在下面留言～</div>';
        var faqOpts = '<option value="">💡 常见问题（点选即问）</option>' + FAQ.map(function (f, i) { return '<option value="' + i + '">' + f.q + '</option>'; }).join('');
        return '<div class="mrj-card" data-oid="' + w.orderId + '">' +
          '<div style="font-size:13px;font-weight:700;color:#3e2f23">' + items + '</div>' +
          '<div class="mrj-items">合计 RM ' + (o.total || 0).toFixed(2) + ' · ' + (o.method === 'delivery' ? '配送' : '自取') + (o.timeRaw ? ' · ' + o.timeRaw.replace('T', ' ') : '') + '</div>' +
          steps +
          '<div class="mrj-chat" id="mrj-chat-' + w.orderId + '">' + chat + '</div>' +
          '<select class="mrj-faq" data-faq="' + w.orderId + '">' + faqOpts + '</select>' +
          '<div class="mrj-inrow"><input type="text" maxlength="300" placeholder="给店家留言…" data-inp="' + w.orderId + '"><button data-send="' + w.orderId + '">发送</button></div>' +
          ((w.status === 'pending' || w.status === 'new') && !cancelled ? '<button class="mrj-cxl" data-cxl="' + w.orderId + '">取消这笔订单</button>' : '') +
          '</div>';
      }).join('');

      /* 事件 */
      body.querySelectorAll('[data-send]').forEach(function (b) {
        b.addEventListener('click', function () {
          var inp = body.querySelector('[data-inp="' + b.dataset.send + '"]');
          var text = (inp.value || '').trim();
          if (!text) return;
          inp.value = '';
          post({ action: 'customer_msg', token: getToken(), orderId: b.dataset.send, text: text }).then(refresh);
        });
      });
      body.querySelectorAll('[data-faq]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (sel.value === '') return;
          var f = FAQ[+sel.value];
          var now = Date.now();
          localFaqLog.push({ orderId: sel.dataset.faq, from: 'customer', text: f.q, at: now });
          localFaqLog.push({ orderId: sel.dataset.faq, from: 'shop', text: f.a, at: now + 1 });
          if (localFaqLog.length > 40) localFaqLog = localFaqLog.slice(-40);
          localStorage.setItem('mrj_faq_log', JSON.stringify(localFaqLog));
          sel.value = '';
          refresh();
        });
      });
      body.querySelectorAll('[data-cxl]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!window.confirm('确定取消这笔订单吗？')) return;
          post({ action: 'customer_cancel', token: getToken(), orderId: b.dataset.cxl }).then(function (r2) {
            if (!r2.ok) alert(r2.error || '取消失败');
            refresh();
          });
        });
      });
    }).catch(function () {});
  }

  function escB(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtT(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  /* ---------- 「我的订单」入口：购物车抽屉底部（无悬浮球） ---------- */
  function injectEntry() {
    var drawer = document.getElementById('cart-drawer-panel');
    if (drawer && !document.getElementById('mrj-my-orders-link')) {
      var a = document.createElement('a');
      a.id = 'mrj-my-orders-link';
      a.textContent = '查看我的订单 / 订单进度 ›';
      a.addEventListener('click', function () { showOrders(); });
      drawer.appendChild(a);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectEntry);
  else injectEntry();
  setTimeout(injectEntry, 2000); /* 兜底：抽屉晚渲染 */

  /* ---------- 站内下单（main.js 调用入口） ---------- */
  window.MRJMailbox = {
    /* app = 官网主对象(this)；data = {name,phone,address,date,deliveryZone} */
    placeOrder: function (app, data) {
      var isEn = app.getCurrentLanguage && app.getCurrentLanguage() === 'en';
      var cart = app.cart || [];
      if (!cart.length) return;
      var items = cart.map(function (it) {
        return { id: it.id, name: app.getItemDisplayName ? app.getItemDisplayName(it) : it.name, price: it.price, qty: it.qty };
      });
      var total = cart.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
      var zoneVal = document.getElementById('cust-delivery-zone') ? document.getElementById('cust-delivery-zone').value : '';

      /* 先查营业状态 */
      post({ action: 'shop_status' }).then(function (st) {
        if (st.ok && st.paused) {
          alert(isEn ? 'Sorry, we are not taking orders right now. Please try again later or WhatsApp us.' : '不好意思，我们暂时停止接单，请稍后再试或通过 WhatsApp 联系我们～');
          return;
        }
        return post({
          action: 'place_order', token: getToken(),
          order: {
            name: data.name, phone: data.phone,
            method: zoneVal === 'pickup' ? 'pickup' : 'delivery',
            timeRaw: data.date || '', address: data.address || '',
            note: (data.deliveryZone ? '[' + data.deliveryZone + '] ' : ''),
            items: items, total: Math.round(total * 100) / 100,
          },
        }).then(function (r) {
          if (!r || !r.ok) { alert((r && r.error) || (isEn ? 'Failed, please try WhatsApp.' : '提交失败，请改用 WhatsApp 下单')); return; }
          /* 成功：清空购物车 + 感谢弹窗 + 询问是否也发 WhatsApp */
          app.cart = []; app.saveCart(); app.updateCartUI();
          var ty = document.getElementById('thankyou-modal');
          if (ty) {
            document.getElementById('thankyou-modal-backdrop').classList.add('show');
            ty.classList.add('show');
            if (!ty.querySelector('.mrj-ask')) {
              var ask = document.createElement('div');
              ask.className = 'mrj-ask';
              ask.innerHTML = (isEn ? 'Order received! We will confirm with you here.<br>Also send a copy via WhatsApp?' : '订单已收到！我们确认后会在「我的订单」里回复您。<br>需要同时发送一份到 WhatsApp 吗？') +
                '<br><button class="y">' + (isEn ? 'Yes, WhatsApp too' : '好，也发 WhatsApp') + '</button>' +
                '<button class="n">' + (isEn ? 'No need' : '不用了') + '</button>' +
                '<a id="mrj-ty-track" style="display:block;margin-top:8px;font-size:12px;color:#8a5a32;text-decoration:underline;cursor:pointer">' + (isEn ? 'Track my order ›' : '查看订单进度 ›') + '</a>';
              ty.appendChild(ask);
              ask.querySelector('.y').addEventListener('click', function () { app.checkoutWhatsApp(data); ask.remove(); });
              ask.querySelector('.n').addEventListener('click', function () { ask.remove(); });
              ask.querySelector('#mrj-ty-track').addEventListener('click', function () {
                document.getElementById('close-thankyou-btn') && document.getElementById('close-thankyou-btn').click();
                showOrders();
              });
            }
          }
        });
      }).catch(function () {
        alert(isEn ? 'Network error, please try WhatsApp.' : '网络异常，请改用 WhatsApp 下单');
      });
    },
    showOrders: showOrders,
  };
})();
