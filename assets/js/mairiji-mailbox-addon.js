/* ================================================================
 * 麦日记官网 · 站内预定插件 v4
 * v4 改动：
 *  - 修复 FAQ「确认取消订单」链接不渲染（escB 把引号转成 &quot; 导致放行正则匹配失败）
 *  - 取消链接改事件委托：重开窗口/缓存重画后依然可点
 *  - 删除感谢弹窗：下单改为聊天式流程（打开信息框→感谢语→订单气泡「发送中…」）
 *  - WhatsApp 追问改在聊天里出现（成功/失败/超时触发），用下单快照发送——
 *    购物车已清空也能发
 *  - 滚动条常态隐藏，滚动时才显示
 * v3 体验优化：
 *  - 消息增量更新：刷新不重绘/不跳动；不在底部时显示「↓ 新消息」泡泡
 *  - 乐观发送：留言/FAQ 立即上屏，后台慢慢上传（失败标记重发）
 *  - 秒开：本地缓存上次数据，打开即渲染，网络数据到了再增量补
 *  - 店家回复提醒：入口红点 + 页面角落轻提示（订单窗关着也能收到）
 * ================================================================ */
(function () {
  'use strict';

  var MAILBOX_URL = 'https://script.google.com/macros/s/AKfycbzCjQC5-fo5C3s_C2qas-9k56jVvSG4WE9jBqJCZyH2TXlh0yYXvG_ok13hjlkenm1R/exec';

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
  function isEn() {
    try { return (localStorage.getItem('mairiji_lang') || 'zh').indexOf('en') === 0; } catch (e) { return false; }
  }

  var STATUS_STEPS = ['pending', 'confirmed', 'baking', 'ready', 'delivered'];
  var FAQ = [
    { q: '我的面包什么时候好？', a: '您可以看上方的进度条哦～「制作中」表示面团已在发酵制作流程里，「已完成」就代表出炉啦。具体交付时间以订单预定时间为准 😊' },
    { q: '可以修改订单吗？', a: '订单确认前可以直接取消后重新下单；确认后请在下方留言告诉我们想改什么，师傅会尽快回复您～' },
    { q: '配送范围和费用？', a: '目前 Tanjong Sepat 地区送货上门，Banting 需事先沟通安排，其他区域建议到店自提。有疑问请留言您的地址～' },
    { q: '面包如何保存？', a: '欧包常温密封可放 2 天；切片冷冻可保存 2 周，吃前 180°C 回烤 5 分钟风味最佳。芝士蛋糕请冷藏并在 3 天内享用～' },
    { q: '我想取消订单', a: '', cancel: true }, /* 动态回答 */
  ];

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent = [
'#mrj-backdrop{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(60,42,26,.45);backdrop-filter:blur(2px);z-index:100000;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}',
'#mrj-backdrop.show{opacity:1;visibility:visible}',
'#mrj-orders-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-45%);width:94%;max-width:720px;background:#fdf9f3;border-radius:14px;box-shadow:0 12px 36px rgba(60,42,26,.25);z-index:100001;opacity:0;visibility:hidden;transition:transform .3s,opacity .3s,visibility .3s;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden}',
'#mrj-orders-modal.show{opacity:1;visibility:visible;transform:translate(-50%,-50%)}',
'.mrj-oh{display:flex;justify-content:space-between;align-items:center;padding:18px 22px 12px;border-bottom:1px dashed #e0d0bd;flex:none}',
'.mrj-oh h3{margin:0;font-family:"Playfair Display","Noto Serif SC",serif;font-size:19px;font-weight:700;color:#5a3a22}',
'.mrj-oh button{background:none;border:none;font-size:26px;color:#a8977f;cursor:pointer;line-height:1}',
'#mrj-vip-mini{font-size:13px !important;font-weight:700;color:#8b5e3c !important;border:1px dashed #c19a6b !important;border-radius:99px;padding:4px 12px;background:#faf5ec !important}',
'#mrj-vip-mini:hover{background:#f4eae0 !important}',
'.mrj-ob{overflow:hidden;padding:0;flex:1;display:flex;min-height:0}',
/* 左右分栏：左=订单列表，右=详情+聊天 */
'.mrj-split{display:flex;width:100%;min-height:min(420px,70vh)}',
'.mrj-list{width:200px;flex:none;border-right:1px dashed #e0d0bd;overflow-y:auto;padding:12px 10px;background:#faf5ec;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
'.mrj-detail{flex:1;overflow-y:auto;padding:14px 18px 18px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;min-width:0}',
'.mrj-li{position:relative;padding:10px 12px;border-radius:10px;cursor:pointer;margin-bottom:6px;border:1px solid transparent;transition:background .2s}',
'.mrj-li:hover{background:#f4eae0}',
'.mrj-li.sel{background:#fff;border-color:#eadfd0;box-shadow:0 2px 6px rgba(60,42,26,.08)}',
'.mrj-li .li-t{font-size:12.5px;font-weight:700;color:#3d2c1c;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
'.mrj-li .li-s{font-size:11px;color:#8a7563;margin-top:4px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
'.mrj-li .st{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:700;background:#f4eae0;color:#8b5e3c}',
'.mrj-li .st.ok{background:#eaf2e3;color:#7c9d5f}',
'.mrj-li .st.bad{background:#fbeae7;color:#b0503f}',
'.mrj-li.cxl .li-t{text-decoration:line-through;color:#b3a28c;font-weight:400}',
'.mrj-li-ask{border-top:1px dashed #e0d0bd;border-radius:0 0 10px 10px;margin-top:4px;padding-top:12px}',
'.mrj-li-ask .li-t{color:#8b5e3c}',
'.mrj-li-dot{position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;background:#d9534f;display:none;box-shadow:0 0 0 2px #faf5ec}',
'.mrj-back{display:none;align-items:center;gap:4px;font-size:13px;font-weight:700;color:#8b5e3c;cursor:pointer;margin-bottom:10px}',
'@media (max-width:640px){',
' .mrj-list{width:100%;border-right:none}',
' .mrj-detail{display:none}',
' .mrj-split.mob-detail .mrj-list{display:none}',
' .mrj-split.mob-detail .mrj-detail{display:block}',
' .mrj-split.mob-detail .mrj-back{display:flex}',
'}',
'.mrj-card{background:#fff;border:1px solid #eadfd0;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(60,42,26,.05)}',
'.mrj-title{font-size:14px;font-weight:700;color:#3d2c1c;line-height:1.5}',
'.mrj-meta{font-size:12.5px;color:#8a7563;margin-top:4px}',
'.mrj-meta b{color:#8b5e3c}',
'.mrj-steps{display:flex;margin:16px 0 6px;position:relative}',
'.mrj-steps:before{content:"";position:absolute;left:10%;right:10%;top:11px;height:2px;background:#eadfd0}',
'.mrj-step{position:relative;z-index:1;text-align:center;flex:1;font-size:10.5px;color:#b3a28c}',
'.mrj-step i{display:block;width:24px;height:24px;border-radius:50%;background:#f4eae0;margin:0 auto 5px;font-style:normal;line-height:24px;font-size:12px;color:#b3a28c;transition:all .3s}',
'.mrj-step.done i{background:#7c9d5f;color:#fff}.mrj-step.done{color:#7c9d5f}',
'.mrj-step.cur i{background:#8b5e3c;color:#fff;box-shadow:0 0 0 4px rgba(139,94,60,.18)}.mrj-step.cur{color:#5a3a22;font-weight:700}',
'.mrj-cancelled{display:inline-block;margin:12px 0 4px;padding:5px 14px;border-radius:99px;background:#fbeae7;color:#b0503f;font-weight:700;font-size:12.5px}',
'.mrj-chatwrap{position:relative;margin-top:14px}',
/* 聊天框固定高度：不随内容伸缩（内容少留白、内容多滚动），按屏幕高度适配 */
'.mrj-chat{background:#f7f0e6;border-radius:10px;padding:12px;height:clamp(220px,38vh,380px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}',
'.mrj-chat .mrj-spacer{flex:1 0 auto}', /* 消息少时把气泡压到底部（像真聊天软件） */
'.mrj-chat-empty{text-align:center;color:#b3a28c;font-size:12px;padding:6px 0}',
'.mrj-bb{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;margin-bottom:8px;line-height:1.55;box-shadow:0 1px 3px rgba(60,42,26,.08);word-break:break-word}',
'.mrj-bb.c{background:#8b5e3c;color:#fff;margin-left:auto;border-bottom-right-radius:4px}',
'.mrj-bb.s{background:#fff;color:#3d2c1c;border-bottom-left-radius:4px}',
'.mrj-bb small{display:block;font-size:10px;opacity:.65;margin-top:3px}',
'.mrj-bb.pending-up{opacity:.7}',
'.mrj-bb .mrj-retry{color:#ffd7cf;text-decoration:underline;cursor:pointer;font-size:10px}',
/* 新消息泡泡 */
'.mrj-newpill{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:#8b5e3c;color:#fff;font-size:11.5px;padding:5px 14px;border-radius:99px;box-shadow:0 3px 10px rgba(60,42,26,.3);cursor:pointer;display:none;z-index:2;animation:mrjpop .25s ease}',
'@keyframes mrjpop{from{transform:translateX(-50%) translateY(8px);opacity:0}}',
'.mrj-faq{width:100%;margin-top:12px;border:1px solid #d8c8b7;border-radius:8px;padding:9px 10px;font-size:13px;color:#5a3a22;background:#fff;font-family:inherit}',
'.mrj-inrow{display:flex;gap:8px;margin-top:8px}',
'.mrj-inrow input{flex:1;border:1px solid #d8c8b7;border-radius:8px;padding:10px 12px;font-size:13px;font-family:inherit;background:#fff;color:#3d2c1c}',
'.mrj-inrow input:focus{outline:none;border-color:#c19a6b;box-shadow:0 0 0 2px rgba(193,154,107,.15)}',
'.mrj-inrow button{border:none;background:#8b5e3c;color:#fff;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
'.mrj-inrow button:hover{background:#6f4a2f}',
'.mrj-cart-dot{position:absolute;top:2px;right:2px;width:9px;height:9px;border-radius:50%;background:#d9534f;display:block;box-shadow:0 0 0 2px #fdf9f3}',

'.mrj-empty{text-align:center;color:#b3a28c;padding:40px 10px;font-size:13.5px;line-height:1.8;flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center}',
'.mrj-empty span{font-size:34px;display:block;margin-bottom:8px}',
'#mrj-my-orders-link{display:block;text-align:center;margin:14px 16px 10px;padding:10px;font-size:13px;color:#8b5e3c;border:1px dashed #c19a6b;border-radius:8px;cursor:pointer;font-weight:700;position:relative}',
'#mrj-my-orders-link:hover{background:#f4eae0}',
'#mrj-my-orders-link .mrj-dot{position:absolute;top:6px;right:10px;width:9px;height:9px;border-radius:50%;background:#d9534f;display:none}',
/* 页面角落轻提示（店家回复） */
'#mrj-mini-note{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#5a3a22;color:#fff;font-size:13px;padding:10px 18px;border-radius:99px;box-shadow:0 6px 20px rgba(0,0,0,.28);z-index:99999;display:none;cursor:pointer;max-width:86vw;text-align:center}',
/* 下单中的临时卡片（聊天式下单流程） */
'.mrj-sending{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#8b5e3c;font-weight:700;line-height:1.6}',
'.mrj-spin{width:15px;height:15px;border:2px solid #eadfd0;border-top-color:#8b5e3c;border-radius:50%;animation:mrjspin .8s linear infinite;flex:none}',
'@keyframes mrjspin{to{transform:rotate(360deg)}}',
'.mrj-place-note{margin-top:10px;font-size:12.5px;color:#8a7563;line-height:1.7}',
'.mrj-place-actions{display:flex;gap:8px;margin-top:10px}',
'.mrj-place-actions button{flex:1;border:none;border-radius:8px;padding:10px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
'.mrj-place-actions .r{background:#8b5e3c;color:#fff}',
'.mrj-place-actions .w{background:#25D366;color:#fff}',
/* 聊天里的可点文字链接（WhatsApp 补发/确认取消） */
'.mrj-bb .mrj-wa-send,.mrj-bb .mrj-do-cancel{text-decoration:underline;cursor:pointer}',
/* 打字中气泡：三个点轮流跳（模拟店家正在输入） */
'.mrj-typing{display:inline-flex;align-items:center;gap:4px;padding:11px 14px;background:#fff;border-radius:12px;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(60,42,26,.08);margin-bottom:8px;width:fit-content}',
'.mrj-typing i{width:6px;height:6px;border-radius:50%;background:#c4b09a;animation:mrjtyp 1.2s ease-in-out infinite}',
'.mrj-typing i:nth-child(2){animation-delay:.15s}',
'.mrj-typing i:nth-child(3){animation-delay:.3s}',
'@keyframes mrjtyp{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}',
'.mrj-typing-me{margin-left:auto;background:#8b5e3c;border-bottom-right-radius:4px;border-bottom-left-radius:12px}',
'.mrj-typing-me i{background:rgba(255,255,255,.75)}',
/* 滚动条：常态隐身，滚动时才显示 */
'.mrj-ob,.mrj-list,.mrj-detail,.mrj-chat{scrollbar-width:thin;scrollbar-color:transparent transparent}',
'.mrj-ob::-webkit-scrollbar,.mrj-list::-webkit-scrollbar,.mrj-detail::-webkit-scrollbar,.mrj-chat::-webkit-scrollbar{width:5px;height:5px}',
'.mrj-ob::-webkit-scrollbar-track,.mrj-list::-webkit-scrollbar-track,.mrj-detail::-webkit-scrollbar-track,.mrj-chat::-webkit-scrollbar-track{background:transparent}',
'.mrj-ob::-webkit-scrollbar-thumb,.mrj-list::-webkit-scrollbar-thumb,.mrj-detail::-webkit-scrollbar-thumb,.mrj-chat::-webkit-scrollbar-thumb{background:transparent;border-radius:99px}',
'.mrj-scrolling{scrollbar-color:#d5c3ad transparent}',
'.mrj-scrolling::-webkit-scrollbar-thumb{background:#d5c3ad}',
/* 自制确认弹窗（不用系统 confirm——系统弹窗会让自定义鼠标消失） */
'#mrj-cfm-bd{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(60,42,26,.5);z-index:100010;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}',
'#mrj-cfm-bd.show{opacity:1;visibility:visible}',
'#mrj-cfm{position:fixed;top:50%;left:50%;transform:translate(-50%,-42%) scale(.96);width:86%;max-width:340px;background:#fdf9f3;border-radius:14px;box-shadow:0 14px 40px rgba(60,42,26,.35);z-index:100011;padding:24px 22px 18px;text-align:center;opacity:0;visibility:hidden;transition:transform .25s,opacity .25s,visibility .25s}',
'#mrj-cfm.show{opacity:1;visibility:visible;transform:translate(-50%,-50%) scale(1)}',
'#mrj-cfm .t{font-size:15px;font-weight:700;color:#5a3a22;line-height:1.7;margin-bottom:6px}',
'#mrj-cfm .d{font-size:12.5px;color:#8a7563;line-height:1.7;margin-bottom:16px}',
'#mrj-cfm .btns{display:flex;gap:10px}',
'#mrj-cfm .btns button{flex:1;border:none;border-radius:8px;padding:11px 8px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .2s}',
'#mrj-cfm .btns button:hover{filter:brightness(.93)}',
'#mrj-cfm .ok{background:#b0503f;color:#fff}',
'#mrj-cfm .no{background:#fff;color:#8a7563;border:1px solid #d8c8b7 !important}',
/* 已取消订单：缩小卡片，隐藏聊天 */
'.mrj-ob>#mrj-placing-card{margin:16px 20px;flex:1;align-self:flex-start}', /* 无订单时直接放窗体里 */
'.mrj-card.mrj-cxl{padding:12px 16px;opacity:.75}',
'.mrj-card.mrj-cxl .mrj-title{font-size:13px;color:#8a7563;text-decoration:line-through}',
'.mrj-card.mrj-cxl .mrj-meta{font-size:11.5px}',
'.mrj-card.mrj-cxl .mrj-cancelled{margin:8px 0 0;padding:3px 12px;font-size:11.5px}',
/* 官网按钮 hover 文字修复：Send Order!/Add to Basket 太宽被挤换行，
 * 第二行被 overflow:hidden 吃掉。改为不换行 + 居中，
 * 用 clip-path 只裁上下、放行左右（保住上下滑动效果） */
'.btn-text-wrapper{overflow:visible !important;clip-path:inset(0 -200px)}',
'.btn-txt{white-space:nowrap}',
'.btn-txt.hover{left:50% !important;width:auto !important;transform:translateY(20px) translateX(-50%)}',
'.wheat-btn:hover .btn-txt.hover{transform:translateY(0) translateX(-50%)}',
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- DOM ---------- */
  var backdrop = document.createElement('div');
  backdrop.id = 'mrj-backdrop';
  var modal = document.createElement('div');
  modal.id = 'mrj-orders-modal';
  modal.innerHTML = '<div class="mrj-oh"><h3>🌾 我的订单</h3>' +
    '<span style="display:flex;align-items:center;gap:10px">' +
    '<button id="mrj-vip-mini" title="麦友 VIP">👑 <span id="mrj-vip-mini-pts"></span></button>' +
    '<button id="mrj-oclose" title="关闭">&times;</button></span></div>' +
    '<div class="mrj-ob" id="mrj-obody"></div>';
  var miniNote = document.createElement('div');
  miniNote.id = 'mrj-mini-note';
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  document.body.appendChild(miniNote);

  /* ---------- 自制确认弹窗（替代系统 confirm/alert，不影响自定义鼠标） ---------- */
  var cfmBd = document.createElement('div'); cfmBd.id = 'mrj-cfm-bd';
  var cfmBox = document.createElement('div'); cfmBox.id = 'mrj-cfm';
  document.body.appendChild(cfmBd);
  document.body.appendChild(cfmBox);
  function mrjConfirm(title, desc, okText, cancelText) {
    return new Promise(function (resolve) {
      cfmBox.innerHTML = '<div class="t">' + title + '</div>' +
        (desc ? '<div class="d">' + desc + '</div>' : '') +
        '<div class="btns">' +
        (cancelText === null ? '' : '<button class="no">' + (cancelText || (isEn() ? 'Keep it' : '再想想')) + '</button>') +
        '<button class="ok">' + (okText || (isEn() ? 'Confirm' : '确定')) + '</button></div>';
      cfmBd.classList.add('show'); cfmBox.classList.add('show');
      function done(v) {
        cfmBd.classList.remove('show'); cfmBox.classList.remove('show');
        cfmBd.onclick = null;
        resolve(v);
      }
      cfmBox.querySelector('.ok').onclick = function () { done(true); };
      var no = cfmBox.querySelector('.no');
      if (no) no.onclick = function () { done(false); };
      cfmBd.onclick = function () { done(false); };
    });
  }
  function mrjAlert(text) { return mrjConfirm(text, '', isEn() ? 'OK' : '知道了', null); }

  /* 🔑 重复档案横幅：同电话有旧档案（旧积分在别的设备上），点击去验证合并。
   * 常驻页面顶部，验证合并完成后自动消失 */
  var dupBanner = null;
  function showDupBanner() {
    if (dupBanner) { dupBanner.style.display = 'flex'; return; }
    dupBanner = document.createElement('div');
    dupBanner.id = 'mrj-dup-banner';
    dupBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:#f7ece1;border-bottom:1px solid #d9a05b;color:#5a3a22;font-size:13px;padding:9px 14px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;box-shadow:0 2px 10px rgba(60,42,26,.12)';
    var en = isEn();
    var pts = '';
    try { var c = JSON.parse(localStorage.getItem('mrj_status_cache') || 'null'); if (c && c.vip && c.vip.dupPoints) pts = c.vip.dupPoints; } catch (e) {}
    dupBanner.innerHTML = '👑 ' +
      (en ? 'We found an existing VIP profile with this phone' + (pts ? ' (' + pts + ' pts)' : '') + '. Verify to merge your points.'
          : '检测到这个电话已有麦友档案' + (pts ? '（' + pts + ' 麦粒）' : '') + '，验证后即可合并积分～') +
      '<button id="mrj-dup-go" style="border:none;background:#8b5e3c;color:#fff;border-radius:99px;padding:5px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">' + (en ? 'Verify now' : '立即验证') + '</button>' +
      '<button id="mrj-dup-x" style="border:none;background:none;color:#a8977f;font-size:18px;cursor:pointer;line-height:1">&times;</button>';
    document.body.appendChild(dupBanner);
    document.getElementById('mrj-dup-go').addEventListener('click', function () {
      window.MRJMailbox.startRecoverPublic();
    });
    document.getElementById('mrj-dup-x').addEventListener('click', function () {
      dupBanner.style.display = 'none'; /* 只是本次收起；下次 my_status 发现还没合并会再出现 */
    });
  }
  function hideDupBanner() {
    if (dupBanner) dupBanner.style.display = 'none';
    try { localStorage.removeItem('mrj_dup_profile'); } catch (e) {}
  }
  backdrop.addEventListener('click', hideOrders);
  document.getElementById('mrj-oclose').addEventListener('click', hideOrders);
  /* 👑 VIP 并入订单窗：小按钮开原有 VIP 注册/档案弹窗（header 的 VIP 按钮已隐藏） */
  document.getElementById('mrj-vip-mini').addEventListener('click', function () {
    hideOrders();
    var vb = document.getElementById('open-vip-btn');
    if (vb) vb.click(); /* 复用官网原有注册/档案逻辑（按钮隐藏但功能还在） */
  });
  function refreshVipMini() {
    var el = document.getElementById('mrj-vip-mini-pts');
    if (!el) return;
    var registered = false;
    try { registered = !!localStorage.getItem('mairiji_cust_name'); } catch (e) {}
    var pts = localStorage.getItem('mrj_vip_points');
    el.textContent = registered ? ((isEn() ? 'VIP · ' : '麦友 · ') + (pts || '0') + (isEn() ? ' pts' : ' 粒'))
                                : (isEn() ? 'Join VIP' : '加入麦友');
  }
  miniNote.addEventListener('click', function () { miniNote.style.display = 'none'; showOrders(); });

  /* 滚动条：滚动时显现，停下 0.8 秒后隐身（事件委托，动态生成的聊天框也生效） */
  var scrollHideTimers = {};
  document.addEventListener('scroll', function (e) {
    var el = e.target;
    if (!el || !el.classList) return;
    if (!el.classList.contains('mrj-ob') && !el.classList.contains('mrj-chat') && !el.classList.contains('mrj-list') && !el.classList.contains('mrj-detail')) return;
    el.classList.add('mrj-scrolling');
    var key = el.dataset.chat || el.className.slice(0, 20);
    clearTimeout(scrollHideTimers[key]);
    scrollHideTimers[key] = setTimeout(function () { el.classList.remove('mrj-scrolling'); }, 800);
  }, true);

  /* 购物车按钮 + 抽屉入口红点 */
  function setCartDot(on) {
    var entryDot = document.querySelector('#mrj-my-orders-link .mrj-dot');
    if (entryDot) entryDot.style.display = on ? 'block' : 'none';
    var cartBtn = document.getElementById('open-cart-btn') || document.querySelector('.cart-button, [id*="cart"][class*="btn"], .nav-action-btn.cart');
    /* 兜底：找购物车角标的父按钮 */
    if (!cartBtn) {
      var badge = document.getElementById('cart-count-badge');
      if (badge) cartBtn = badge.closest('button, a');
    }
    if (cartBtn) {
      var d = cartBtn.querySelector('.mrj-cart-dot');
      if (on && !d) {
        d = document.createElement('span');
        d.className = 'mrj-cart-dot';
        cartBtn.style.position = cartBtn.style.position || 'relative';
        cartBtn.appendChild(d);
      }
      if (d) d.style.display = on ? 'block' : 'none';
    }
    var msgBtn = document.getElementById('mrj-msg-btn');
    if (msgBtn) {
      var md = msgBtn.querySelector('.mrj-cart-dot');
      if (md) md.style.display = on ? 'block' : 'none';
    }
  }

  /* ---------- 状态 ---------- */
  var pollTimer = null, bgTimer = null;
  var lastData = null;                 /* 最近一次服务器数据 */
  var renderedKeys = {};               /* orderId -> {msgKey:true} 已渲染消息 */
  var pendingLocal = [];               /* 乐观上屏、上传中的消息 */
  var localFaqLog = JSON.parse(localStorage.getItem('mrj_faq_log') || '[]');
  var seenShopN = Number(localStorage.getItem('mrj_seen_shop_n') || 0);

  function cacheData(d) { try { localStorage.setItem('mrj_status_cache', JSON.stringify(d)); } catch (e) {} }
  function loadCache() { try { return JSON.parse(localStorage.getItem('mrj_status_cache') || 'null'); } catch (e) { return null; } }

  function msgKey(m) { return m.from + '|' + m.text + '|' + Math.floor((m.at || 0) / 120000); } /* 2分钟窗口去重 */
  function escB(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtT(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  function showOrders() {
    backdrop.classList.add('show'); modal.classList.add('show');
    document.body.classList.add('no-scroll');
    setCartDot(false);
    miniNote.style.display = 'none';
    refreshVipMini();
    /* 秒开：先用缓存渲染（坏缓存直接丢弃，绝不让窗口开不了） */
    var cached = loadCache();
    var painted = false;
    if (cached) {
      try { lastData = cached; renderFull(cached); painted = true; }
      catch (e) { try { localStorage.removeItem('mrj_status_cache'); } catch (e2) {} lastData = null; }
    }
    if (!painted) {
      if (placing) { document.getElementById('mrj-obody').innerHTML = ''; renderPlacing(); }
      else if (selectedOid === 'ask') { lastData = { ok: true, orders: [], msgs: [] }; renderFull(lastData); } /* 客服咨询：无缓存也直接渲染 */
      else document.getElementById('mrj-obody').innerHTML = '<div class="mrj-empty"><span>🍞</span>' + (isEn() ? 'Loading…' : '加载中…') + '</div>';
    }
    fetchAndApply(true);
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden) fetchAndApply(false); }, 15000);
  }
  function hideOrders() {
    backdrop.classList.remove('show'); modal.classList.remove('show');
    document.body.classList.remove('no-scroll');
    clearInterval(pollTimer);
    markShopSeen();
  }

  function shopMsgCount(d) {
    var n = 0;
    ((d && d.msgs) || []).forEach(function (m) { if (m.from === 'shop') n++; });
    return n;
  }
  function markShopSeen() {
    if (lastData) { seenShopN = shopMsgCount(lastData); localStorage.setItem('mrj_seen_shop_n', String(seenShopN)); }
  }

  function fetchAndApply(isOpen) {
    post({ action: 'my_status', token: getToken() }).then(function (r) {
      if (!r.ok) return;
      if (!Array.isArray(r.orders)) r.orders = [];
      if (!Array.isArray(r.msgs)) r.msgs = [];
      cacheData(r);
      /* 🌾 顺带缓存麦粒积分（VIP 档案窗秒显用） */
      if (r.vip) {
        try {
          localStorage.setItem('mrj_vip_points', String(r.vip.points || 0));
          /* 🔑 找回已被店家批准（服务器带回了本 token 的档案）→ 本地自动登录 */
          var pend = JSON.parse(localStorage.getItem('mrj_recover_pending') || 'null');
          if (pend && !localStorage.getItem('mairiji_cust_name')) {
            localStorage.setItem('mairiji_cust_name', r.vip.name || pend.name);
            localStorage.setItem('mairiji_cust_phone', r.vip.phone || pend.phone);
            localStorage.removeItem('mrj_recover_pending');
            miniNote.textContent = isEn() ? '👑 VIP profile restored! Points: ' + (r.vip.points || 0) : '👑 麦友档案已恢复！麦粒积分：' + (r.vip.points || 0);
            miniNote.style.display = 'block';
          }
          /* 🔑 同电话有旧档案未合并 → 常驻横幅；合并完成 → 收起 + 恭喜 */
          if (r.vip.dup) showDupBanner();
          else {
            var hadDup = false;
            try { hadDup = !!localStorage.getItem('mrj_dup_profile'); } catch (e3) {}
            if (hadDup) {
              hideDupBanner();
              miniNote.textContent = isEn() ? '👑 Profiles merged! Points: ' + (r.vip.points || 0) : '👑 档案已合并！麦粒积分：' + (r.vip.points || 0);
              miniNote.style.display = 'block';
            }
          }
        } catch (e) {}
      }
      var structureChanged = !lastData || !Array.isArray(lastData.orders) ||
        r.orders.length !== lastData.orders.length ||
        r.orders.some(function (w) {
          var old = lastData.orders.filter(function (x) { return x.orderId === w.orderId; })[0];
          return !old || old.status !== w.status;
        });
      lastData = r;
      if (structureChanged || isOpen && !document.querySelector('.mrj-split')) {
        renderFull(r); /* 订单增减/状态变化才整体重绘 */
      } else {
        applyMsgDelta(r); /* 只追加新消息，不动滚动位置 */
      }
      if (modal.classList.contains('show')) markShopSeen();
    }).catch(function () {});
  }

  /* ---------- 整体渲染（打开/结构变化时）：左右分栏 ---------- */
  var selectedOid = null;   /* 当前选中的订单（右栏显示谁） */
  var mobDetail = false;    /* 手机窄屏：是否处于详情页 */

  function orderUnread(r, orderId) {
    /* 该订单是否有未读店家消息（粗略：按 seen 计数无法分单，这里用时间） */
    var lastSeen = Number(localStorage.getItem('mrj_seen_at_' + orderId) || 0);
    return ((r && r.msgs) || []).some(function (m) {
      return m.from === 'shop' && (!m.orderId || m.orderId === orderId) && (m.at || 0) > lastSeen;
    });
  }
  function markOrderSeen(orderId) {
    localStorage.setItem('mrj_seen_at_' + orderId, String(Date.now()));
  }

  function renderFull(r) {
    var body = document.getElementById('mrj-obody');
    var en = isEn();
    renderedKeys = {};
    /* 🛡 数据消毒：旧版缓存/脏数据缺字段会让渲染崩溃 → 聊天框打不开。
     * 补齐所有必要字段，彻底防炸 */
    if (!r || typeof r !== 'object') r = { orders: [], msgs: [] };
    if (!Array.isArray(r.orders)) r.orders = [];
    if (!Array.isArray(r.msgs)) r.msgs = [];
    r.orders = r.orders.filter(function (w) { return w && w.orderId; });
    r.orders.forEach(function (w) {
      if (typeof w.status !== 'string') w.status = 'pending';
      if (!w.order || typeof w.order !== 'object') w.order = {};
      if (!Array.isArray(w.order.items)) w.order.items = [];
    });
    /* 下单成功且真订单卡已到 → 撤掉临时"发送中"卡片，并自动选中新订单 */
    if (placing && placing.stage === 'ok' && placing.orderId &&
        r.orders.some(function (w) { return w.orderId === placing.orderId; })) {
      selectedOid = placing.orderId;
      placing = null;
    }
    /* 无订单也不早退：客服咨询入口恒在（v4.12） */
    var ordersSorted = r.orders.slice().sort(function (a, b) {
      var ca = a.status.indexOf('cancelled') === 0 ? 1 : 0;
      var cb = b.status.indexOf('cancelled') === 0 ? 1 : 0;
      if (ca !== cb) return ca - cb; /* 已取消沉底 */
      return (b.order.at || 0) - (a.order.at || 0);
    });
    /* 选中项失效时：有订单选第一单，没订单选客服咨询 */
    if (!selectedOid || (selectedOid !== 'ask' && !ordersSorted.some(function (w) { return w.orderId === selectedOid; }))) {
      selectedOid = ordersSorted.length ? ordersSorted[0].orderId : 'ask';
    }

    /* 左栏：订单列表 */
    var listHtml = ordersSorted.map(function (w) {
      var o = w.order;
      var cancelled = w.status.indexOf('cancelled') === 0;
      var items = o.items.map(function (it) { return it.name + ' × ' + it.qty; }).join('、');
      var st = statusChip(w.status, en);
      return '<div class="mrj-li' + (w.orderId === selectedOid ? ' sel' : '') + (cancelled ? ' cxl' : '') + '" data-li="' + w.orderId + '">' +
        '<div class="li-t">' + escB(items) + '</div>' +
        '<div class="li-s"><span class="st ' + st.cls + '">' + st.label + '</span>RM ' + (o.total || 0).toFixed(2) + '</div>' +
        '<span class="mrj-li-dot"' + (orderUnread(r, w.orderId) && w.orderId !== selectedOid ? ' style="display:block"' : '') + '></span>' +
        '</div>';
    }).join('');

    /* 💬 客服咨询：常驻入口（不需要有订单） */
    listHtml += '<div class="mrj-li mrj-li-ask' + (selectedOid === 'ask' ? ' sel' : '') + '" data-li="ask">' +
      '<div class="li-t">💬 ' + (en ? 'Chat with us' : '客服咨询') + '</div>' +
      '<div class="li-s">' + (en ? 'Custom orders & questions' : '定制 / 送礼 / 任何问题') + '</div>' +
      '<span class="mrj-li-dot"' + (orderUnread(r, 'ask') && selectedOid !== 'ask' ? ' style="display:block"' : '') + '></span></div>';

    body.innerHTML = '<div class="mrj-split' + (mobDetail ? ' mob-detail' : '') + '">' +
      '<div class="mrj-list" id="mrj-list">' + listHtml + '</div>' +
      '<div class="mrj-detail" id="mrj-detail"></div></div>';

    /* 右栏：选中订单的详情（或客服咨询） */
    renderDetailPane(r, ordersSorted.filter(function (w) { return w.orderId === selectedOid; })[0]);

    /* 左栏点击切换 */
    body.querySelectorAll('[data-li]').forEach(function (li) {
      li.addEventListener('click', function () {
        selectedOid = li.dataset.li;
        mobDetail = true; /* 手机上进详情页 */
        renderFull(lastData || r);
      });
    });
    renderPlacing(); /* 临时"发送中"卡片 */
  }

  function statusChip(status, en) {
    if (status.indexOf('cancelled') === 0) return { cls: 'bad', label: en ? 'Cancelled' : '已取消' };
    if (status === 'delivered') return { cls: 'ok', label: en ? 'Delivered' : '已送达' };
    if (status === 'ready') return { cls: 'ok', label: en ? 'Ready' : '已完成' };
    if (status === 'baking') return { cls: '', label: en ? 'Baking' : '制作中' };
    if (status === 'confirmed') return { cls: '', label: en ? 'Confirmed' : '已确认' };
    return { cls: '', label: en ? 'Pending' : '待确认' };
  }

  /* 右栏渲染：一次只显示一个订单的进度+聊天 */
  function renderDetailPane(r, w) {
    var pane = document.getElementById('mrj-detail');
    if (!pane) return;
    var en = isEn();
    /* 💬 客服咨询频道：无订单也能聊 */
    if (selectedOid === 'ask') {
      pane.innerHTML = '<div class="mrj-back" id="mrj-back">‹ ' + (en ? 'Back' : '返回') + '</div>' +
        '<div class="mrj-title">💬 ' + (en ? 'Chat with MaiRiJi' : '客服咨询') + '</div>' +
        '<div class="mrj-meta">' + (en ? 'Custom cakes, corporate gifts, or any questions' : '定制蛋糕 / 企业送礼 / 合作洽谈 / 任何问题') + '</div>' +
        '<div class="mrj-chatwrap"><div class="mrj-chat" data-chat="ask"></div>' +
        '<div class="mrj-newpill" data-pill="ask">↓ ' + (en ? 'New message' : '新消息') + '</div></div>' +
        '<div class="mrj-inrow"><input type="text" maxlength="300" placeholder="' + (en ? 'Message us…' : '想问什么直接说～') + '" data-inp="ask"><button data-send="ask">' + (en ? 'Send' : '发送') + '</button></div>';
      fillMsgs('ask', collectMsgs(r, 'ask'), true);
      bindCardEvents(pane);
      markOrderSeen('ask');
      var bk = document.getElementById('mrj-back');
      if (bk) bk.addEventListener('click', function () { mobDetail = false; renderFull(lastData || r); });
      return;
    }
    if (!w) { pane.innerHTML = ''; return; }
    var o = w.order;
    var cancelled = w.status.indexOf('cancelled') === 0;
    var stepNames = en ? ['Pending', 'Confirmed', 'Baking', 'Ready', 'Delivered'] : ['待确认', '已确认', '制作中', '已完成', '已送达'];
    var stepIdx = STATUS_STEPS.indexOf(w.status === 'new' ? 'pending' : w.status);
    var steps = cancelled
      ? '<div class="mrj-cancelled">✕ ' + (en ? 'Cancelled' : '已取消') + '</div>'
      : '<div class="mrj-steps">' + stepNames.map(function (n, i) {
          var cls = i < stepIdx ? 'done' : i === stepIdx ? 'cur' : '';
          return '<div class="mrj-step ' + cls + '"><i>' + (i < stepIdx ? '✓' : i + 1) + '</i>' + n + '</div>';
        }).join('') + '</div>';
    var items = o.items.map(function (it) { return it.name + ' × ' + it.qty; }).join('、');

    var html = '<div class="mrj-back" id="mrj-back">‹ ' + (en ? 'All orders' : '返回订单列表') + '</div>' +
      '<div class="mrj-title">' + escB(items) + '</div>' +
      '<div class="mrj-meta"><b>RM ' + (o.total || 0).toFixed(2) + '</b> · ' + (o.method === 'delivery' ? (en ? 'Delivery' : '配送') : (en ? 'Pickup' : '自取')) + (o.timeRaw ? ' · ' + o.timeRaw.replace('T', ' ') : '') + '</div>' +
      steps;

    if (!cancelled) {
      var faqOpts = '<option value="">💡 ' + (en ? 'Quick questions (tap to ask)' : '常见问题（点选即问）') + '</option>' +
        FAQ.map(function (f, i) { return '<option value="' + i + '">' + f.q + '</option>'; }).join('');
      html +=
        '<div class="mrj-chatwrap"><div class="mrj-chat" data-chat="' + w.orderId + '"></div>' +
        '<div class="mrj-newpill" data-pill="' + w.orderId + '">↓ ' + (en ? 'New message' : '新消息') + '</div></div>' +
        '<select class="mrj-faq" data-faq="' + w.orderId + '">' + faqOpts + '</select>' +
        '<div class="mrj-inrow"><input type="text" maxlength="300" placeholder="' + (en ? 'Message us…' : '给店家留言…') + '" data-inp="' + w.orderId + '"><button data-send="' + w.orderId + '">' + (en ? 'Send' : '发送') + '</button></div>';
    }
    pane.innerHTML = html;

    /* 聊天框固定高度由 CSS clamp 控制，无需内联覆盖 */

    if (!cancelled) {
      fillMsgs(w.orderId, collectMsgs(r, w.orderId), true);
      bindCardEvents(pane);
    }
    markOrderSeen(w.orderId);
    var back = document.getElementById('mrj-back');
    if (back) back.addEventListener('click', function () {
      mobDetail = false;
      renderFull(lastData || r);
    });
  }

  function collectMsgs(r, orderId) {
    var msgs = (r.msgs || []).filter(function (m) { return !m.orderId || m.orderId === orderId; }).slice();
    localFaqLog.forEach(function (f) { if (f.orderId === orderId) msgs.push(f); });
    pendingLocal.forEach(function (p) { if (p.orderId === orderId) msgs.push(p); });
    msgs.sort(function (a, b) { return a.at - b.at; });
    return msgs;
  }

  function escKeepU(s2) {
    /* 转义后放行 <u ...>…</u>（FAQ 取消链接 / WhatsApp 补发链接专用）
     * 注意：escB 会把引号转成 &quot;，所以这里必须按 &quot; 匹配（v3 的 bug 就在这） */
    var t = escB(s2);
    t = t.replace(/&lt;u class=&quot;(mrj-do-cancel|mrj-wa-send)&quot; data-oid=&quot;([^&]*)&quot;(?: style=&quot;cursor:pointer&quot;)?&gt;/g,
      '<u class="$1" data-oid="$2" style="cursor:pointer">');
    t = t.replace(/&lt;\/u&gt;/g, '</u>');
    return t;
  }
  function bubbleHtml(m) {
    var mine = m.from === 'customer';
    var tag = m._pending ? '<small>' + (isEn() ? 'sending…' : '发送中…') + '</small>'
      : m._failed ? '<small>' + (isEn() ? 'failed · ' : '发送失败 · ') + '<span class="mrj-retry" data-retry="' + m._localId + '">' + (isEn() ? 'retry' : '点击重发') + '</span></small>'
      : '<small>' + fmtT(m.at) + (mine ? '' : ' · ' + (isEn() ? 'MaiRiJi' : '麦日记')) + '</small>';
    return '<div class="mrj-bb ' + (mine ? 'c' : 's') + (m._pending ? ' pending-up' : '') + '" data-mk="' + escB(msgKey(m)) + '"' + (m._localId ? ' data-lid="' + m._localId + '"' : '') + '>' + escKeepU(m.text) + tag + '</div>';
  }

  function atBottom(el) { return el.scrollHeight - el.scrollTop - el.clientHeight < 40; }

  function fillMsgs(orderId, msgs, scrollBottom) {
    var chat = document.querySelector('[data-chat="' + orderId + '"]');
    if (!chat) return;
    renderedKeys[orderId] = renderedKeys[orderId] || {};
    if (!msgs.length) {
      if (orderId === 'ask') {
        /* 开场白（本地显示，不占数据）：附 WhatsApp 可选跳转 */
        chat.innerHTML = '<div class="mrj-spacer"></div><div class="mrj-bb s">' + (isEn()
          ? '👋 Hello, this is MaiRiJi! Custom cakes, corporate gifts, or any questions — just leave a message and we will reply soon.<br>Prefer WhatsApp? <u class="mrj-wa-chat" style="cursor:pointer">Tap here to chat on WhatsApp</u>'
          : '👋 您好，这里是麦日记！定制蛋糕、企业送礼、合作洽谈或任何问题，直接留言，我们会尽快回复您～<br>若您更习惯用 WhatsApp，<u class="mrj-wa-chat" style="cursor:pointer">点这里跳转 WhatsApp 聊</u>') + '</div>';
      } else {
        chat.innerHTML = '<div class="mrj-spacer"></div><div class="mrj-chat-empty">' + (isEn() ? 'Questions? Leave us a message below.' : '有问题可以在下面留言，我们会尽快回复～') + '</div>';
      }
      return;
    }
    /* 顶部弹性占位：消息少时把气泡压到底部（固定高度聊天框专用） */
    chat.innerHTML = '<div class="mrj-spacer"></div>' + msgs.map(function (m) { renderedKeys[orderId][msgKey(m)] = true; return bubbleHtml(m); }).join('');
    if (scrollBottom) chat.scrollTop = chat.scrollHeight;
    bindRetry(chat);
  }

  /* ---------- 增量：只追加新消息（不动滚动位置，不在底部则显示泡泡） ---------- */
  function applyMsgDelta(r) {
    r.orders.concat([{ orderId: 'ask' }]).forEach(function (w) {
      var chat = document.querySelector('[data-chat="' + w.orderId + '"]');
      if (!chat) {
        /* 非选中订单：没有聊天框，只点亮左栏红点 */
        if (w.orderId !== selectedOid && orderUnread(r, w.orderId)) {
          var li = document.querySelector('[data-li="' + w.orderId + '"] .mrj-li-dot');
          if (li) li.style.display = 'block';
        }
        return;
      }
      var known = renderedKeys[w.orderId] || (renderedKeys[w.orderId] = {});
      var fresh = [];
      (r.msgs || []).forEach(function (m) {
        if (m.orderId && m.orderId !== w.orderId) return;
        var k = msgKey(m);
        if (known[k]) return;
        /* 服务器回显了乐观消息 → 把本地待传气泡转正 */
        var dup = pendingLocal.filter(function (p) { return p.orderId === w.orderId && p.text === m.text && p.from === m.from; })[0];
        if (dup) {
          var el = chat.querySelector('[data-lid="' + dup._localId + '"]');
          if (el) el.outerHTML = bubbleHtml(m);
          pendingLocal = pendingLocal.filter(function (p) { return p !== dup; });
          known[k] = true;
          return;
        }
        fresh.push(m);
      });
      if (!fresh.length) return;
      var stick = atBottom(chat);
      var emptyHint = chat.querySelector('.mrj-chat-empty');
      if (emptyHint) emptyHint.remove();
      fresh.sort(function (a, b) { return a.at - b.at; }).forEach(function (m) {
        known[msgKey(m)] = true;
        chat.insertAdjacentHTML('beforeend', bubbleHtml(m));
      });
      if (stick) {
        chat.scrollTop = chat.scrollHeight;
      } else {
        var pill = document.querySelector('[data-pill="' + w.orderId + '"]');
        if (pill) {
          pill.style.display = 'block';
          pill.onclick = function () { chat.scrollTop = chat.scrollHeight; pill.style.display = 'none'; };
          chat.onscroll = function () { if (atBottom(chat)) pill.style.display = 'none'; };
        }
      }
    });
  }

  /* ---------- 乐观发送 ---------- */
  var localSeq = 0;
  function optimisticSend(orderId, text) {
    var m = { orderId: orderId, from: 'customer', text: text, at: Date.now(), _pending: true, _localId: 'L' + (++localSeq) + Date.now() };
    pendingLocal.push(m);
    var chat = document.querySelector('[data-chat="' + orderId + '"]');
    if (chat) {
      var emptyHint = chat.querySelector('.mrj-chat-empty');
      if (emptyHint) emptyHint.remove();
      var meTyping = chat.querySelector('.mrj-typing-me');
      if (meTyping) meTyping.remove(); /* 发送了，撤掉"打字中" */
      chat.insertAdjacentHTML('beforeend', bubbleHtml(m));
      chat.scrollTop = chat.scrollHeight;
    }
    uploadMsg(m);
  }
  function uploadMsg(m) {
    post({ action: 'customer_msg', token: getToken(), orderId: m.orderId, text: m.text }).then(function (r) {
      var chat = document.querySelector('[data-chat="' + m.orderId + '"]');
      var el = chat && chat.querySelector('[data-lid="' + m._localId + '"]');
      if (r && r.ok) {
        m._pending = false;
        renderedKeys[m.orderId] = renderedKeys[m.orderId] || {};
        renderedKeys[m.orderId][msgKey(m)] = true;
        pendingLocal = pendingLocal.filter(function (p) { return p !== m; });
        if (el) el.outerHTML = bubbleHtml(m);
      } else { markFailed(m); }
    }).catch(function () { markFailed(m); });
  }
  function markFailed(m) {
    m._pending = false; m._failed = true;
    var chat = document.querySelector('[data-chat="' + m.orderId + '"]');
    var el = chat && chat.querySelector('[data-lid="' + m._localId + '"]');
    if (el) { el.outerHTML = bubbleHtml(m); bindRetry(chat); }
  }
  function bindRetry(scope) {
    (scope || document).querySelectorAll('.mrj-retry').forEach(function (r) {
      r.onclick = function () {
        var m = pendingLocal.filter(function (p) { return p._localId === r.dataset.retry; })[0];
        if (!m) return;
        m._failed = false; m._pending = true;
        var chat = document.querySelector('[data-chat="' + m.orderId + '"]');
        var el = chat && chat.querySelector('[data-lid="' + m._localId + '"]');
        if (el) el.outerHTML = bubbleHtml(m);
        uploadMsg(m);
      };
    });
  }

  /* ---------- 卡片事件 ---------- */
  function bindCardEvents(body) {
    body.querySelectorAll('[data-send]').forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = body.querySelector('[data-inp="' + b.dataset.send + '"]');
        var text = (inp.value || '').trim();
        if (!text) return;
        inp.value = '';
        optimisticSend(b.dataset.send, text); /* 立即上屏，后台上传 */
      });
    });
    body.querySelectorAll('[data-inp]').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { var b = body.querySelector('[data-send="' + inp.dataset.inp + '"]'); if (b) b.click(); }
      });
      /* 顾客打字时：聊天框右下角出现自己的「···」气泡（纯本地，停手 1.2 秒消失） */
      inp.addEventListener('input', function () {
        var chat = document.querySelector('[data-chat="' + inp.dataset.inp + '"]');
        if (!chat) return;
        var t = chat.querySelector('.mrj-typing-me');
        if (inp.value.trim()) {
          if (!t) {
            t = document.createElement('div');
            t.className = 'mrj-typing mrj-typing-me';
            t.innerHTML = '<i></i><i></i><i></i>';
            chat.appendChild(t);
            chat.scrollTop = chat.scrollHeight;
          }
          clearTimeout(t._tm);
          t._tm = setTimeout(function () { t.remove(); }, 1200);
        } else if (t) { t.remove(); }
      });
    });
    body.querySelectorAll('[data-faq]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        if (sel.value === '') return;
        var f = FAQ[+sel.value];
        sel.value = '';
        if (f.cancel) {
          /* 取消订单：动态回答 + 隐蔽的文字链接 */
          var w0 = (lastData && lastData.orders || []).filter(function (x) { return x.orderId === sel.dataset.faq; })[0];
          var canCancel = w0 && (w0.status === 'pending' || w0.status === 'new');
          f = { q: '我想取消订单', a: canCancel
            ? '好的，订单还未确认可以取消。请确认您真的不需要了——手作烘焙每一单都是为您预留的食材呢 🥲 确定的话请点：<u class="mrj-do-cancel" data-oid="' + sel.dataset.faq + '" style="cursor:pointer">确认取消订单</u>'
            : '您的订单已经确认，食材已为您安排，暂时不能直接取消了。如有特殊情况请在下方留言，师傅会尽快与您协商～' };
        }
        var now = Date.now();
        var qm = { orderId: sel.dataset.faq, from: 'customer', text: f.q, at: now };
        var am = { orderId: sel.dataset.faq, from: 'shop', text: f.a, at: now + 1 };
        localFaqLog.push(qm, am);
        if (localFaqLog.length > 40) localFaqLog = localFaqLog.slice(-40);
        localStorage.setItem('mrj_faq_log', JSON.stringify(localFaqLog));
        var chat = document.querySelector('[data-chat="' + sel.dataset.faq + '"]');
        if (chat) {
          var empty = chat.querySelector('.mrj-chat-empty');
          if (empty) empty.remove();
          renderedKeys[sel.dataset.faq] = renderedKeys[sel.dataset.faq] || {};
          renderedKeys[sel.dataset.faq][msgKey(qm)] = true;
          renderedKeys[sel.dataset.faq][msgKey(am)] = true;
          /* ① 问题气泡立即上屏 */
          chat.insertAdjacentHTML('beforeend', bubbleHtml(qm));
          chat.scrollTop = chat.scrollHeight;
          /* ② 店家「···」打字中动画（纯前端模拟，零网络零消耗） */
          var typing = document.createElement('div');
          typing.className = 'mrj-typing';
          typing.innerHTML = '<i></i><i></i><i></i>';
          setTimeout(function () {
            if (!chat.isConnected) return;
            chat.appendChild(typing);
            chat.scrollTop = chat.scrollHeight;
          }, 350);
          /* ③ 按答案长度模拟打字时间（0.9~2 秒），然后答案跳出 */
          var thinkMs = Math.min(2000, 900 + f.a.length * 8);
          setTimeout(function () {
            if (typing.parentNode) typing.remove();
            if (!chat.isConnected) return;
            chat.insertAdjacentHTML('beforeend', bubbleHtml(am));
            chat.scrollTop = chat.scrollHeight;
          }, 350 + thinkMs);
        }
      });
    });
    body.querySelectorAll('[data-cxl]').forEach(function (b) {
      b.addEventListener('click', function () {
        mrjConfirm(
          isEn() ? 'Cancel this order?' : '确定取消这笔订单吗？',
          isEn() ? 'Every order reserves ingredients just for you 🥲' : '每一单的食材都是为您预留的呢 🥲',
          isEn() ? 'Yes, cancel' : '确定取消',
          isEn() ? 'Keep my order' : '我再想想'
        ).then(function (yes) { if (yes) doCancelOrder(b.dataset.cxl); });
      });
    });
  }

  /* 聊天里的文字链接（事件委托：重开窗口/缓存重画后依然可点） */
  modal.addEventListener('click', function (e) {
    var u = e.target.closest ? e.target.closest('.mrj-do-cancel, .mrj-wa-send, .mrj-wa-chat') : null;
    if (!u) return;
    if (u.classList.contains('mrj-wa-chat')) {
      var waN = (window.app && window.app.config && window.app.config.waNumber) || '601115277643';
      var txt = isEn() ? 'Hello MaiRiJi! I would like to inquire about custom orders.' : '你好，麦日记！我想咨询关于预定与客制化烘焙的问题。';
      var wurl = 'https://wa.me/' + waN + '?text=' + encodeURIComponent(txt);
      var w3 = window.open(wurl, '_blank');
      if (!w3 || w3.closed || typeof w3.closed === 'undefined') location.href = wurl;
      return;
    }
    if (u.classList.contains('mrj-do-cancel')) {
      mrjConfirm(
        isEn() ? 'Really cancel this order?' : '真的要取消这笔订单吗？',
        isEn() ? 'Every order reserves ingredients just for you 🥲' : '每一单的食材都是为您预留的呢 🥲',
        isEn() ? 'Yes, cancel' : '确定取消',
        isEn() ? 'Keep my order' : '我再想想'
      ).then(function (yes) { if (yes) doCancelOrder(u.dataset.oid); });
    } else {
      sendWaSnapshot(u.dataset.oid);
    }
  });

  /* 取消订单：聊天式即时反馈（先上屏，再等服务器，不让顾客以为卡了） */
  function pushLocalMsg(m) {
    localFaqLog.push(m);
    if (localFaqLog.length > 40) localFaqLog = localFaqLog.slice(-40);
    localStorage.setItem('mrj_faq_log', JSON.stringify(localFaqLog));
  }
  function appendBubble(orderId, m) {
    var chat = document.querySelector('[data-chat="' + orderId + '"]');
    if (!chat) return null;
    var empty = chat.querySelector('.mrj-chat-empty');
    if (empty) empty.remove();
    renderedKeys[orderId] = renderedKeys[orderId] || {};
    renderedKeys[orderId][msgKey(m)] = true;
    chat.insertAdjacentHTML('beforeend', bubbleHtml(m));
    chat.scrollTop = chat.scrollHeight;
    return chat.lastElementChild;
  }
  function doCancelOrder(orderId) {
    var en = isEn();
    var now = Date.now();
    /* ① 顾客气泡 + 店家"处理中"气泡立刻上屏 */
    var qm = { orderId: orderId, from: 'customer', text: en ? 'I confirm to cancel this order.' : '我确认取消这笔订单', at: now };
    pushLocalMsg(qm);
    appendBubble(orderId, qm);
    var busy = { orderId: orderId, from: 'shop', text: en ? 'Got it, cancelling your order…' : '收到，正在为您取消订单…', at: now + 1 };
    var busyEl = appendBubble(orderId, busy);
    /* ② 等服务器结果，把"处理中"气泡换成结果 */
    function settle(text) {
      var done = { orderId: orderId, from: 'shop', text: text, at: Date.now() };
      pushLocalMsg(done);
      renderedKeys[orderId] = renderedKeys[orderId] || {};
      renderedKeys[orderId][msgKey(done)] = true;
      if (busyEl && busyEl.parentNode) busyEl.outerHTML = bubbleHtml(done);
      var chat = document.querySelector('[data-chat="' + orderId + '"]');
      if (chat) chat.scrollTop = chat.scrollHeight;
    }
    post({ action: 'customer_cancel', token: getToken(), orderId: orderId }).then(function (r2) {
      if (!r2.ok) {
        settle((en ? 'Sorry, cancellation failed: ' : '抱歉，取消没有成功：') + (r2.error || (en ? 'please message us below.' : '请在下方留言，师傅会帮您处理～')));
        return;
      }
      settle(en ? '✓ Your order has been cancelled. Hope to bake for you next time! 🌾' : '✓ 订单已为您取消。期待下次为您烘焙～ 🌾');
      /* 让顾客看清成功气泡，1.5 秒后再刷新（卡片会缩小成"已取消"状态） */
      setTimeout(function () { fetchAndApply(true); }, 1500);
    }).catch(function () {
      settle(en ? 'Network hiccup — cancellation not confirmed. Please try again or message us below.' : '网络不太稳定，取消还没确认成功。请再点一次，或在下方留言，师傅会帮您处理～');
    });
  }

  /* ---------- 后台轻监听：店家回复提醒（订单窗关着也能收到） ---------- */
  function bgWatch() {
    if (document.hidden) return;                        /* 页面切后台不打服务器（省配额省电） */
    if (modal.classList.contains('show')) return;      /* 窗开着由主轮询负责 */
    var cached = loadCache();
    if (!cached || !cached.orders || !cached.orders.length) return;
    /* 只在有活跃订单（未送达未取消）时才轮询 */
    var active = cached.orders.some(function (w) {
      return ['delivered'].indexOf(w.status) === -1 && w.status.indexOf('cancelled') !== 0;
    });
    if (!active) return;
    post({ action: 'my_status', token: getToken() }).then(function (r) {
      if (!r.ok) return;
      cacheData(r); lastData = r;
      var n = shopMsgCount(r);
      if (n > seenShopN) {
        miniNote.textContent = isEn() ? '🍞 MaiRiJi replied to your order — tap to view' : '🍞 麦日记回复了您的订单，点击查看';
        miniNote.style.display = 'block'; /* 永久显示，点击打开订单窗才消失 */
        setCartDot(true);
      }
    }).catch(function () {});
  }
  bgTimer = setInterval(bgWatch, 60000);
  setTimeout(bgWatch, 5000); /* 打开页面 5 秒后先查一次 */

  /* ---------- 入口 ---------- */
  function injectEntry() {
    var drawer = document.getElementById('cart-drawer-panel');
    if (drawer && !document.getElementById('mrj-my-orders-link')) {
      var a = document.createElement('a');
      a.id = 'mrj-my-orders-link';
      a.innerHTML = (isEn() ? '📦 My Orders / Track Progress ›' : '📦 查看我的订单 / 订单进度 ›') + '<span class="mrj-dot"></span>';
      a.addEventListener('click', showOrders);
      drawer.appendChild(a);
    }
  }
  /* header 信息按钮：插在 VIP 按钮旁（信封图标，点击开订单窗） */
  function injectHeaderBtn() {
    var vipBtn = document.getElementById('open-vip-btn');
    /* 👑 VIP 已并入订单窗：header 的 VIP 按钮隐藏（功能保留，靠订单窗小按钮转发点击） */
    if (vipBtn) vipBtn.style.display = 'none';
    if (document.getElementById('mrj-msg-btn')) return;
    if (!vipBtn || !vipBtn.parentNode) return;
    var b = document.createElement('button');
    b.id = 'mrj-msg-btn';
    b.className = vipBtn.className; /* 继承官网按钮样式 */
    b.title = isEn() ? 'My Orders' : '我的订单';
    b.setAttribute('data-label', isEn() ? 'My Orders' : '我的订单');
    b.style.position = 'relative';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span class="mrj-cart-dot" style="display:none"></span>';
    b.addEventListener('click', showOrders);
    vipBtn.parentNode.insertBefore(b, vipBtn.nextSibling);
  }
  /* 🎟 WhatsApp 认领链接：#claim=码 → 自动把店内建的订单挂到本浏览器账号 */
  function handleClaim() {
    var m = (location.hash || '').match(/#claim=([a-z0-9]+)/i);
    if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    post({ action: 'claim_order', token: getToken(), code: m[1] }).then(function (r) {
      if (r.ok) {
        try { localStorage.removeItem('mrj_status_cache'); } catch (e) {}
        /* 👑 顺手建 VIP：服务端已入 customers 表，本地写档案（不覆盖已有的） */
        try {
          if (r.name && !localStorage.getItem('mairiji_cust_name')) localStorage.setItem('mairiji_cust_name', r.name);
          if (r.phone && !localStorage.getItem('mairiji_cust_phone')) localStorage.setItem('mairiji_cust_phone', r.phone);
          if (window.app && window.app.updateVIPBtnUI) window.app.updateVIPBtnUI();
        } catch (e) {}
        miniNote.textContent = isEn() ? '🍞 Order linked! You are now a VIP member too' : '🍞 订单已绑定！已顺手为您开通麦友档案 👑';
        miniNote.style.display = 'block';
        setTimeout(showOrders, 800);
      } else {
        mrjAlert(isEn() ? 'Link expired or already used.' : '认领链接已失效或已被使用～有疑问请 WhatsApp 我们');
      }
    }).catch(function () {});
  }
  handleClaim();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { injectEntry(); injectHeaderBtn(); });
  else { injectEntry(); injectHeaderBtn(); }
  setTimeout(function () { injectEntry(); injectHeaderBtn(); }, 2000);

  /* ================================================================
   * 聊天式下单流程（v4，替代感谢弹窗）
   * 点「发送订单」→ 打开信息框 → 感谢语 + 订单卡「发送中…」→
   * 成功：订单卡转正 + 聊天里问「要不要也发一份 WhatsApp？」
   * 失败/太久：保留购物篮，卡片上给「重试」「发 WhatsApp」按钮
   * ================================================================ */
  var placing = null;        /* {stage, en, summary, orderId, reason} */
  var placePayload = null, placeApp = null, placeSeq = 0, slowTimer = null, failTimer = null;

  /* WhatsApp 订单快照：下单那一刻就存好文字，购物篮清空后照样能发 */
  function loadWaSnaps() { try { return JSON.parse(localStorage.getItem('mrj_wa_snaps') || '[]'); } catch (e) { return []; } }
  function stashWa(url, oid) {
    var s = loadWaSnaps().filter(function (x) { return x.oid !== oid; });
    s.unshift({ oid: oid || '', url: url });
    localStorage.setItem('mrj_wa_snaps', JSON.stringify(s.slice(0, 5)));
  }
  function sendWaSnapshot(oid) {
    var s = loadWaSnaps();
    var hit = s.filter(function (x) { return x.oid === oid; })[0] || s[0];
    if (!hit) { mrjAlert(isEn() ? 'Order content not found on this device.' : '这台设备上找不到订单内容了，请直接留言给我们～'); return; }
    var w = window.open(hit.url, '_blank');
    if (!w || w.closed || typeof w.closed === 'undefined') window.location.href = hit.url;
  }

  function buildWaMsg(app, data, en) {
    var cart = app.cart || [];
    var totalPrice = 0, totalQty = 0;
    var isVIP = false;
    try { isVIP = !!localStorage.getItem(app.config.storageKeys.custName); } catch (e) {}
    var vipBadge = isVIP ? (en ? ' [VIP Member]' : ' [VIP会员]') : '';
    var msg = en ? 'Hello MaiRiji! I would like to place an order:\n\n' : '你好，麦日记！我想预定以下商品：\n\n';
    msg += en ? '【Customer & Delivery Info】\n' : '【预定与配送信息】\n';
    if (data.deliveryZone) msg += (en ? 'Type/Zone: ' : '配送/取货方式：') + data.deliveryZone + '\n';
    if (data.name) msg += (en ? 'Name: ' : '姓名：') + data.name + vipBadge + '\n';
    if (data.phone) msg += (en ? 'Contact Phone: ' : '联系电话：') + data.phone + '\n';
    var zoneEl = document.getElementById('cust-delivery-zone');
    var zoneVal = zoneEl ? zoneEl.value : '';
    msg += (zoneVal === 'pickup' ? (en ? 'Pickup Location: \n' : '自提地点：\n') : (en ? 'Delivery Address: \n' : '详细配送地址：\n')) + (data.address || '') + '\n';
    msg += (en ? 'Preferred Date: ' : '期望日期：') + (data.date || '') + '\n\n';
    msg += en ? '【Order Details】\n' : '【商品明细】\n';
    cart.forEach(function (item, i) {
      var line = (item.price * item.qty).toFixed(2);
      totalPrice += item.price * item.qty; totalQty += item.qty;
      var dn = app.getItemDisplayName ? app.getItemDisplayName(item) : item.name;
      msg += (i + 1) + '. ' + dn + ' x ' + item.qty + ' — RM ' + line + '\n';
    });
    msg += '\n------------------------------\n';
    msg += en ? ('Total Items: ' + totalQty + ' | Total: RM ' + totalPrice.toFixed(2) + '\n\n')
              : ('共 ' + totalQty + ' 件商品 | 总计：RM ' + totalPrice.toFixed(2) + '\n\n');
    msg += en ? 'Please confirm availability and delivery schedule with me. Thank you!' : '请与我确认具体配送/自提时间，谢谢！';
    return 'https://wa.me/' + app.config.waNumber + '?text=' + encodeURIComponent(msg);
  }

  function placingHtml() {
    if (!placing) return '';
    var en = placing.en;
    var h = '<div class="mrj-card" id="mrj-placing-card">' +
      '<div class="mrj-title">🌾 ' + (en ? 'Thank you for your order!' : '感谢您的预定！') + '</div>' +
      '<div class="mrj-meta">' + escB(placing.summary) + '</div>';
    if (placing.stage === 'sending' || placing.stage === 'slow') {
      h += '<div class="mrj-sending"><span class="mrj-spin"></span>' + (en ? 'Sending your order…' : '订单发送中，请稍候…') + '</div>';
      if (placing.stage === 'slow') {
        h += '<div class="mrj-place-note">' + (en ? 'Taking longer than usual… you can also send it via WhatsApp first, we handle both the same way.' : '网络有点慢…您也可以先把订单发到 WhatsApp，我们同样会处理～') + '</div>' +
          '<div class="mrj-place-actions"><button class="w" data-pw="1">' + (en ? 'Send via WhatsApp' : '发送 WhatsApp 订单') + '</button></div>';
      }
    } else if (placing.stage === 'ok') {
      h += '<div class="mrj-sending" style="color:#7c9d5f"><span style="flex:none">✓</span>' + (en ? 'Order sent! Loading details…' : '订单已送达麦日记！正在加载订单详情…') + '</div>';
    } else { /* failed / paused */
      h += '<div class="mrj-place-note">' + escB(placing.reason || '') + '</div>' +
        '<div class="mrj-place-actions">' +
        (placing.stage === 'failed' ? '<button class="r" data-pr="1">' + (en ? 'Retry' : '重试发送') + '</button>' : '') +
        '<button class="w" data-pw="1">' + (en ? 'Send via WhatsApp' : '发送 WhatsApp 订单') + '</button></div>';
    }
    return h + '</div>';
  }
  function renderPlacing() {
    var body = document.getElementById('mrj-obody');
    if (!body) return;
    var old = document.getElementById('mrj-placing-card');
    if (!placing) { if (old) old.remove(); return; }
    /* 分栏布局时放右栏顶部；无订单时放整个窗体 */
    var host = document.getElementById('mrj-detail') || body;
    if (old) old.outerHTML = placingHtml();
    else host.insertAdjacentHTML('afterbegin', placingHtml());
    var card = document.getElementById('mrj-placing-card');
    if (!card) return;
    var w = card.querySelector('[data-pw]');
    if (w) w.onclick = function () { sendWaSnapshot((placing && placing.orderId) || ''); };
    var rb = card.querySelector('[data-pr]');
    if (rb) rb.onclick = function () { doPlace(); };
  }

  function failPlace(reason) {
    if (!placing) return;
    placing.stage = 'failed';
    placing.reason = reason || (placing.en
      ? 'Order failed to send 🥲 Your basket is kept — retry, or send via WhatsApp instead.'
      : '订单发送失败了 🥲 购物篮已为您保留，可以重试，或改发 WhatsApp 订单。');
    renderPlacing();
  }

  function onPlaced(orderId) {
    if (!placing) return;
    placing.stage = 'ok';
    placing.orderId = orderId;
    /* 把刚存的快照挂到订单号上 */
    var snaps = loadWaSnaps();
    if (snaps[0]) { snaps[0].oid = orderId; localStorage.setItem('mrj_wa_snaps', JSON.stringify(snaps)); }
    var en = placing.en;
    /* 聊天里追问 WhatsApp（本地气泡，零网络） */
    var m = { orderId: orderId, from: 'shop', at: Date.now(), text: en
      ? '🌾 We\'ve received your order and will reply here after confirming. Want a WhatsApp copy too? Tap: <u class="mrj-wa-send" data-oid="' + orderId + '">Send WhatsApp order</u> (or just ignore this)'
      : '🌾 我们已收到您的订单，确认后会在这里回复您～ 需要同时发送一份订单到 WhatsApp 吗？点这里：<u class="mrj-wa-send" data-oid="' + orderId + '">发送 WhatsApp 订单</u>（不需要就忽略～）' };
    localFaqLog.push(m);
    if (localFaqLog.length > 40) localFaqLog = localFaqLog.slice(-40);
    localStorage.setItem('mrj_faq_log', JSON.stringify(localFaqLog));
    /* 成功了才清空购物篮 */
    if (placeApp) { placeApp.cart = []; placeApp.saveCart(); placeApp.updateCartUI(); }
    renderPlacing();
    fetchAndApply(true);
  }

  function doPlace() {
    if (!placePayload || !placing) return;
    var seq = ++placeSeq;
    placing.stage = 'sending'; placing.reason = '';
    renderPlacing();
    clearTimeout(slowTimer); clearTimeout(failTimer);
    /* 太久（12秒）：给出 WhatsApp 选项但继续等 */
    slowTimer = setTimeout(function () {
      if (seq === placeSeq && placing && placing.stage === 'sending') { placing.stage = 'slow'; renderPlacing(); }
    }, 12000);
    /* 超时（30秒）：判失败，保留购物篮 */
    failTimer = setTimeout(function () {
      if (seq === placeSeq && placing && (placing.stage === 'sending' || placing.stage === 'slow')) {
        failPlace(placing.en ? 'Timed out 🥲 Your basket is kept — retry, or send via WhatsApp.' : '发送超时了 🥲 购物篮已为您保留，可以重试或改发 WhatsApp 订单。');
      }
    }, 30000);
    post({ action: 'shop_status' }).then(function (st) {
      if (seq !== placeSeq) return;
      if (st.ok && st.paused) {
        clearTimeout(slowTimer); clearTimeout(failTimer);
        placing.stage = 'paused';
        placing.reason = placing.en
          ? 'Sorry, we are not taking orders right now. Your basket is kept — try later, or reach us on WhatsApp.'
          : '不好意思，我们暂时停止接单了。购物篮已为您保留，可以稍后再试，或先发 WhatsApp 和我们沟通～';
        renderPlacing();
        return;
      }
      return post({ action: 'place_order', token: getToken(), order: placePayload }).then(function (r) {
        if (seq !== placeSeq) return;
        clearTimeout(slowTimer); clearTimeout(failTimer);
        if (!r || !r.ok) { failPlace(r && r.error); return; }
        onPlaced(r.orderId);
      });
    }).catch(function () {
      if (seq !== placeSeq) return;
      clearTimeout(slowTimer); clearTimeout(failTimer);
      failPlace(null);
    });
  }

  /* ---------- 站内下单入口 ---------- */
  window.MRJMailbox = {
    placeOrder: function (app, data) {
      var en = app.getCurrentLanguage && app.getCurrentLanguage() === 'en';
      var cart = app.cart || [];
      if (!cart.length) return;
      var items = cart.map(function (it) {
        return { id: it.id, name: app.getItemDisplayName ? app.getItemDisplayName(it) : it.name, price: it.price, qty: it.qty };
      });
      var total = cart.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
      var zoneEl = document.getElementById('cust-delivery-zone');
      var zoneVal = zoneEl ? zoneEl.value : '';
      placeApp = app;
      placePayload = {
        name: data.name, phone: data.phone,
        method: zoneVal === 'pickup' ? 'pickup' : 'delivery',
        timeRaw: data.date || '', address: data.address || '',
        note: (data.deliveryZone ? '[' + data.deliveryZone + '] ' : ''),
        items: items, total: Math.round(total * 100) / 100,
      };
      /* 趁购物篮还在，先做好 WhatsApp 快照（成功后清空也能发） */
      stashWa(buildWaMsg(app, data, en), '');
      placing = {
        stage: 'sending', en: en, orderId: '',
        summary: items.map(function (it) { return it.name + ' × ' + it.qty; }).join('、') + ' · RM ' + (Math.round(total * 100) / 100).toFixed(2),
      };
      mobDetail = true;      /* 手机上直接进详情栏（发送中卡片在右栏） */
      showOrders();          /* 直接打开信息框 */
      renderPlacing();       /* 感谢语 + 发送中… */
      doPlace();
    },
    showOrders: showOrders,

    /* 💬 打开客服咨询频道（「预定与专属客服」卡片入口） */
    openAsk: function () { selectedOid = 'ask'; mobDetail = true; showOrders(); },

    /* 🌟 VIP 注册：称呼+电话写进信箱 customers 表（同一 token，麦粒积分自动挂钩） */
    vipRegister: function (name, phone) {
      var self = this;
      return post({ action: 'vip_register', token: getToken(), name: name, phone: phone })
        .then(function (r) {
          if (!r.ok) throw new Error(r.error || 'fail');
          try { localStorage.setItem('mrj_vip_points', String(r.points || 0)); } catch (e) {}
          /* 🔑 v4.9：同电话有旧档案 → 注册照常成功（不阻断），挂横幅引导验证合并 */
          if (r.needRecover) {
            try { localStorage.setItem('mrj_dup_profile', JSON.stringify({ name: name, phone: phone })); } catch (e) {}
            setTimeout(function () { showDupBanner(); }, 600);
          }
          return r;
        });
    },

    startRecoverPublic: function () { /* 横幅点击入口 */
      var pend = {};
      try { pend = JSON.parse(localStorage.getItem('mrj_dup_profile') || '{}'); } catch (e) {}
      this.startRecover(pend.name || localStorage.getItem('mairiji_cust_name') || '',
                        pend.phone || localStorage.getItem('mairiji_cust_phone') || '');
    },

    /* 🔑 找回流程：生成验证码 → 顾客用本人电话的 WhatsApp 发给店家 → 店家 APP 批准 */
    startRecover: function (name, phone) {
      var en = isEn();
      post({ action: 'recover_request', token: getToken(), phone: phone }).then(function (r) {
        if (!r.ok) { mrjAlert(r.error || (en ? 'Failed, please try later.' : '出错了，请稍后再试')); return; }
        /* 记住待恢复的资料：批准后本地自动补上 */
        try { localStorage.setItem('mrj_recover_pending', JSON.stringify({ name: name, phone: phone, at: Date.now() })); } catch (e) {}
        var waNum = (window.app && window.app.config && window.app.config.waNumber) || '601115277643';
        var text = en
          ? 'Hi MaiRiJi! I want to recover my VIP profile. My verification code: ' + r.code
          : '你好麦日记！我要找回我的麦友档案，我的验证码：' + r.code;
        mrjConfirm(
          en ? 'This phone already has a VIP profile' : '这个电话已经有麦友档案了',
          en ? 'To protect your points, please send the code <b style="font-size:16px">' + r.code + '</b> to us via WhatsApp <b>from this phone number</b>. Verification takes <b>1-3 working days</b>; your profile & points will be restored automatically once approved.'
             : '为保护您的积分，请<b>用这个电话号码的 WhatsApp</b> 把验证码 <b style="font-size:16px">' + r.code + '</b> 发给我们。审核需要 <b>1-3 个工作日</b>，通过后档案和积分会自动恢复～',
          en ? 'Open WhatsApp' : '打开 WhatsApp 发送',
          en ? 'Later' : '稍后再说'
        ).then(function (yes) {
          if (!yes) return;
          var url = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(text);
          var w2 = window.open(url, '_blank');
          if (!w2 || w2.closed || typeof w2.closed === 'undefined') location.href = url;
        });
      }).catch(function () { mrjAlert(en ? 'Network error.' : '网络异常，请稍后再试'); });
    },

    /* 🌾 麦粒积分：填进 VIP 档案窗（缓存秒显 → my_status 顺带刷新） */
    fillPoints: function () {
      var en = isEn();
      var box = document.getElementById('mrj-vip-points');
      if (!box) {
        /* 档案卡里插一行「麦粒积分」（地址下方） */
        var addr = document.getElementById('profile-display-address');
        var card = addr && addr.closest ? addr.closest('.vip-card-box') : null;
        if (!card) return;
        var div = document.createElement('div');
        div.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px dashed #d8c8b7';
        div.innerHTML = '<span style="font-size:12px;color:#888">' + (en ? 'Wheat Points: ' : '麦粒积分：') + '</span>' +
          '<strong id="mrj-vip-points" style="font-size:17px;color:#8b5e3c;margin-left:4px">…</strong>' +
          '<span style="font-size:11px;color:#b3a28c;margin-left:6px">' + (en ? '(RM1 spent = 1 point)' : '（消费 RM1 = 1 粒）') + '</span>' +
          '<u id="mrj-edit-name" style="display:block;margin-top:8px;font-size:12px;color:#8b5e3c;cursor:pointer">✏ ' + (en ? 'Change my name' : '修改我的昵称') + '</u>';
        card.appendChild(div);
        box = document.getElementById('mrj-vip-points');
      }
      /* 缓存秒显 */
      box.textContent = localStorage.getItem('mrj_vip_points') || '0';
      /* ✏ 改昵称：随时改、无限次（本地+customers表同步；不动积分不动电话） */
      var eb = document.getElementById('mrj-edit-name');
      if (eb && !eb._bound) {
        eb._bound = 1;
        eb.addEventListener('click', function () {
          /* 自制输入弹窗（不用系统 prompt——会让自定义鼠标消失） */
          var cur = localStorage.getItem('mairiji_cust_name') || '';
          cfmBox.innerHTML = '<div class="t">✏ ' + (en ? 'Change my name' : '修改我的昵称') + '</div>' +
            '<input id="mrj-nn-inp" type="text" maxlength="40" value="' + escB(cur) + '" style="width:100%;box-sizing:border-box;border:1px solid #d8c8b7;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;margin-bottom:14px;color:#3d2c1c" />' +
            '<div class="btns"><button class="no">' + (en ? 'Cancel' : '取消') + '</button><button class="ok">' + (en ? 'Save' : '保存') + '</button></div>';
          cfmBd.classList.add('show'); cfmBox.classList.add('show');
          var inp = document.getElementById('mrj-nn-inp');
          setTimeout(function () { inp.focus(); inp.select(); }, 80);
          function done2() { cfmBd.classList.remove('show'); cfmBox.classList.remove('show'); cfmBd.onclick = null; }
          function save2() {
            var nn = String(inp.value).trim().slice(0, 40);
            done2();
            if (!nn || nn === cur) return;
            localStorage.setItem('mairiji_cust_name', nn);
            var pn = document.getElementById('profile-display-name');
            if (pn) pn.textContent = nn;
            if (window.app && window.app.updateVIPBtnUI) window.app.updateVIPBtnUI();
            post({ action: 'vip_register', token: getToken(), name: nn,
                   phone: localStorage.getItem('mairiji_cust_phone') || '' }).catch(function () {});
          }
          cfmBox.querySelector('.ok').onclick = save2;
          cfmBox.querySelector('.no').onclick = done2;
          cfmBd.onclick = done2;
          inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') save2(); });
        });
      }
      /* 后台刷新（my_status 已带 vip 字段，无需新接口） */
      post({ action: 'my_status', token: getToken() }).then(function (r) {
        if (r.ok && r.vip) {
          box.textContent = String(r.vip.points || 0);
          localStorage.setItem('mrj_vip_points', String(r.vip.points || 0));
        }
      }).catch(function () {});
    },
  };
})();
