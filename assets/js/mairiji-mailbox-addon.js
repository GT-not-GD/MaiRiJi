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
    { q: '我的面包什么时候好？', a: '您可以看上方的进度条哦～「制作中」表示面团已在发酵制作流程里，「已完成」就代表出炉啦。具体交付时间以订单预定时间为准 😊',
      qEn: 'When will my bread be ready?', aEn: 'Just check the progress bar above 😊 “Baking” means your dough is already in the fermenting/baking process, and “Ready” means it is out of the oven. The exact handover time follows the time you booked in your order.' },
    { q: '可以修改订单吗？', a: '订单确认前可以直接取消后重新下单；已经确认的订单请在下方留言告诉我们想改什么，师傅会尽快回复您～',
      qEn: 'Can I change my order?', aEn: 'Before an order is confirmed you can simply cancel it and reorder. If it is already confirmed, please leave a message below telling us what you would like to change and our baker will reply as soon as possible.' },
    { q: '配送范围和费用？', a: '目前 Tanjong Sepat 地区送货上门，Banting 需事先沟通安排，其他区域建议到店自提。有疑问请留言您的地址～',
      qEn: 'Delivery area and fees?', aEn: 'We currently deliver within the Tanjong Sepat area. Banting needs to be arranged in advance; for other areas we recommend self-pickup at the shop. If unsure, leave your address below and we will help.' },
    { q: '什么是拼单配送？', a: '拼单就是把同方向的订单凑在一起、一趟车一起送，帮大家省路费、也更环保 🍞 当同区凑满一定金额就「成团」，我们会协调一个大家都方便的日期统一配送。您在订单详情里能看到所在的「N 号团」和拼单进度条；成团后会显示「预计送货」日期（具体时间我们仍会再和您确认）。介绍邻居朋友一起下单，可以更快凑满、更快送到哦～',
      qEn: 'What is pooled delivery?', aEn: 'Pooling means grouping orders heading the same direction and delivering them in one trip — it saves on delivery cost and is greener 🍞 Once orders in the same area reach a certain total, the pool is “complete” and we coordinate one delivery date that works for everyone. In your order details you can see which pool (#N) you are in and the pooling progress bar; once complete an “Expected delivery” date appears (we will still confirm the exact time with you). Invite neighbours or friends to order together to fill the pool and get it delivered faster!' },
    { q: '面包如何保存？', a: '欧包常温密封可放 2 天；切片冷冻可保存 2 周，吃前 180°C 回烤 5 分钟风味最佳。芝士蛋糕请冷藏并在 3 天内享用～',
      qEn: 'How do I store the bread?', aEn: 'Sourdough/artisan loaves keep 2 days sealed at room temperature; sliced and frozen they keep 2 weeks — for best flavour, reheat at 180°C for 5 minutes before eating. Please refrigerate cheesecake and enjoy it within 3 days.' },
    { q: '我想取消订单', a: '', cancel: true, qEn: 'I want to cancel my order', aEn: '' }, /* 动态回答 */
  ];

  /* ---------- 样式 ---------- */
  var css = document.createElement('style');
  css.textContent = [
'#mrj-backdrop{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(60,42,26,.45);backdrop-filter:blur(2px);z-index:100000;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}',
'#mrj-backdrop.show{opacity:1;visibility:visible}',
'#mrj-orders-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-45%);width:96%;max-width:820px;background:#fdf9f3;border-radius:14px;box-shadow:0 12px 36px rgba(60,42,26,.25);z-index:100001;opacity:0;visibility:hidden;transition:transform .3s,opacity .3s,visibility .3s;height:90vh;height:90dvh;max-height:760px;display:flex;flex-direction:column;overflow:hidden}',
'#mrj-orders-modal.show{opacity:1;visibility:visible;transform:translate(-50%,-50%)}',
'.mrj-oh{display:flex;justify-content:space-between;align-items:center;padding:18px 22px 12px;border-bottom:1px dashed #e0d0bd;flex:none}',
'.mrj-oh h3{margin:0;font-family:"Playfair Display","Noto Serif SC",serif;font-size:19px;font-weight:700;color:#5a3a22}',
'.mrj-oh button{background:none;border:none;font-size:26px;color:#a8977f;cursor:pointer;line-height:1}',
'#mrj-vip-mini{font-size:13px !important;font-weight:700;color:#8b5e3c !important;border:1px dashed #c19a6b !important;border-radius:99px;padding:4px 12px;background:#faf5ec !important}',
'#mrj-vip-mini:hover{background:#f4eae0 !important}',
'.mrj-ob{overflow:hidden;padding:0;flex:1;display:flex;min-height:0}',
/* 左右分栏：左=订单列表，右=详情+聊天 */
'.mrj-split{display:flex;width:100%;flex:1 1 auto;min-height:0;max-height:100%}',
'.mrj-list{width:200px;flex:none;border-right:1px dashed #e0d0bd;overflow-y:auto;padding:12px 10px;background:#faf5ec;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
/* 详情栏：纵向 flex，整屏放得下不用滚（聊天框弹性伸缩，输入框永远钉在底部可见） */
'.mrj-detail{flex:1;overflow:hidden;padding:14px 18px 18px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;min-width:0;min-height:0;display:flex;flex-direction:column}',
'.mrj-detail>.mrj-back,.mrj-detail>.mrj-title,.mrj-detail>.mrj-meta,.mrj-detail>.mrj-steps,.mrj-detail>.mrj-cancelled,.mrj-detail>.mrj-faq,.mrj-detail>.mrj-inrow,.mrj-detail>#mrj-placing-card{flex:none}',
/* 拼单信息可能很长：给上限 + 自己滚，绝不把输入框挤出屏幕 */
'.mrj-detail>.mrj-pool{flex:none;max-height:26vh;overflow-y:auto}',
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
' .mrj-split.mob-detail .mrj-detail{display:flex}', /* 保持纵向 flex：整屏放得下、输入框不被挤走 */
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
/* 聊天框区域：弹性填充详情栏剩余空间——拼单信息长时它自动变矮，
 * 保证下方的 FAQ + 输入框始终在一屏内可见，无需滚动 */
'.mrj-chatwrap{position:relative;margin-top:14px;flex:1 1 auto;min-height:96px;display:flex;flex-direction:column}',
'.mrj-chat{background:#f7f0e6;border-radius:10px;padding:12px;flex:1 1 auto;min-height:96px;max-height:none;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}',
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
'@keyframes mrjspin{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(1.15)}100%{transform:rotate(360deg) scale(1)}}',
'.mrj-loadspin{font-size:34px;display:block;margin-bottom:8px;animation:mrjspin 1.6s ease-in-out infinite}',
'.mrj-detail-loading{padding:26px 18px;text-align:center}',
'.mrj-sk{height:14px;border-radius:7px;margin:12px auto 0;background:linear-gradient(90deg,#efe6d8 25%,#f7f0e6 37%,#efe6d8 63%);background-size:400% 100%;animation:mrjshimmer 1.4s ease infinite}',
'.mrj-sk.sk1{width:70%}.mrj-sk.sk2{width:90%;height:44px;border-radius:10px}.mrj-sk.sk3{width:55%}',
'@keyframes mrjshimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}',
/* 首屏订单列表加载过场：几张流光骨架卡，让「订单还没出来」时有明确的加载动画 */
'.mrj-listload{padding:16px 18px;flex:1;overflow:hidden}',
'.mrj-listload-tip{text-align:center;color:#b3a28c;font-size:13px;line-height:1.7;margin-bottom:14px}',
'.mrj-listload-tip .mrj-loadspin{font-size:30px}',
'.mrj-skcard{background:#fff;border:1px solid #eadfd0;border-radius:12px;padding:15px 16px;margin-bottom:13px;box-shadow:0 2px 8px rgba(60,42,26,.05)}',
'.mrj-skln{height:12px;border-radius:6px;background:linear-gradient(90deg,#efe6d8 25%,#f7f0e6 37%,#efe6d8 63%);background-size:400% 100%;animation:mrjshimmer 1.4s ease infinite}',
'.mrj-skln.w1{width:60%}.mrj-skln.w2{width:38%;margin-top:10px}.mrj-skln.bar{width:100%;height:8px;margin-top:13px;border-radius:99px}',
'#mrj-my-orders-link{display:block;text-align:center;margin:14px 16px 10px;padding:10px;font-size:13px;color:#8b5e3c;border:1px dashed #c19a6b;border-radius:8px;cursor:pointer;font-weight:700;position:relative}',
'#mrj-my-orders-link:hover{background:#f4eae0}',
'#mrj-my-orders-link .mrj-dot{position:absolute;top:6px;right:10px;width:9px;height:9px;border-radius:50%;background:#d9534f;display:none}',
/* 页面角落轻提示（店家回复） */
'#mrj-mini-note{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#5a3a22;color:#fff;font-size:13px;padding:10px 18px;border-radius:99px;box-shadow:0 6px 20px rgba(0,0,0,.28);z-index:99999;display:none;cursor:pointer;max-width:86vw;text-align:center}',
'@keyframes mrjpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}',
'#mrj-msg-btn.mrj-pulse{animation:mrjpulse 1.2s ease-in-out infinite}',
'.mrj-pool{background:#fdf3d9;border:1.5px solid #d99a3d;border-radius:10px;padding:10px 12px;margin:10px 0;font-size:12.5px;color:#8a6118;line-height:1.55}',
'.mrj-pool .pool-bar{height:8px;background:#f0e2c8;border-radius:99px;margin:7px 0 4px;overflow:hidden}',
'.mrj-pool .pool-fill{height:100%;background:linear-gradient(90deg,#d99a3d,#c9812a);border-radius:99px;transition:width .6s ease}',
'.mrj-pool.full{background:#eef7ec;border-color:#5a9a4e;color:#33622b}',
'.mrj-pool.full .pool-bar{background:#d8ecd4}',
'.mrj-pool.full .pool-fill{background:linear-gradient(90deg,#5a9a4e,#417a37)}',
'.mrj-pool-join{margin-top:8px;padding-top:8px;border-top:1px dashed #d99a3d;font-size:12px}',
'.mrj-pool-join.done{color:#33622b;border-top-color:#a5cb9d;font-weight:600}',
'.mrj-pool-join-btn{display:block;width:100%;padding:9px 12px;border:0;border-radius:9px;background:linear-gradient(90deg,#5a9a4e,#417a37);color:#fff;font-weight:700;font-size:12.5px;cursor:pointer;line-height:1.4}',
'.mrj-pool-join-btn:active{transform:scale(.98)}',
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
  modal.innerHTML = '<div class="mrj-oh"><h3>🌾 ' + (isEn() ? 'My Orders' : '我的订单') + '</h3>' +
    '<span style="display:flex;align-items:center;gap:10px">' +
    '<button id="mrj-vip-mini" title="' + (isEn() ? 'Member VIP' : '麦友 VIP') + '">👑 <span id="mrj-vip-mini-pts"></span></button>' +
    '<button id="mrj-oclose" title="' + (isEn() ? 'Close' : '关闭') + '">&times;</button></span></div>' +
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
  /* v4.19：横幅「固定+不遮挡」——
   * v4.18 的文档流方案有缺陷：往下滑横幅就跟着滚走了（用户反馈）。
   * 正解：横幅 fixed 固定在最顶（滑到哪都在），同时把同为 fixed 的
   * .main-header 往下推横幅的高度——两个都固定、上下排开、谁也不挡谁 */
  function dupBannerShift(on) {
    var h = on && dupBanner ? dupBanner.offsetHeight : 0;
    var hd = document.querySelector('.main-header');
    if (hd) hd.style.top = h ? h + 'px' : '';
    /* 页面内容也垫一下，防止横幅盖住页面最顶部的内容 */
    document.body.style.paddingTop = h ? h + 'px' : '';
  }
  function showDupBanner() {
    if (dupBanner) { dupBanner.style.display = 'flex'; dupBannerShift(true); return; }
    dupBanner = document.createElement('div');
    dupBanner.id = 'mrj-dup-banner';
    dupBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2001;background:#f7ece1;border-bottom:1px solid #d9a05b;color:#5a3a22;font-size:13px;padding:9px 14px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;box-shadow:0 2px 10px rgba(60,42,26,.12)';
    var en = isEn();
    var pts = '';
    try { var c = JSON.parse(localStorage.getItem('mrj_status_cache') || 'null'); if (c && c.vip && c.vip.dupPoints) pts = c.vip.dupPoints; } catch (e) {}
    dupBanner.innerHTML = '👑 ' +
      (en ? 'We found an existing VIP profile with this phone' + (pts ? ' (' + pts + ' pts)' : '') + '. Verify to merge your points & sync this device.'
          : '检测到这个电话已有麦友档案' + (pts ? '（' + pts + ' 麦粒）' : '') + '，验证后即可合并积分、并让这台设备同步登入～') +
      '<button id="mrj-dup-go" style="border:none;background:#8b5e3c;color:#fff;border-radius:99px;padding:5px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">' + (en ? 'Verify now' : '立即验证') + '</button>' +
      '<button id="mrj-dup-x" style="border:none;background:none;color:#a8977f;font-size:18px;cursor:pointer;line-height:1">&times;</button>';
    document.body.appendChild(dupBanner); /* fixed 固定顶部：滑动不消失 */
    dupBannerShift(true);
    window.addEventListener('resize', function () { if (dupBanner && dupBanner.style.display !== 'none') dupBannerShift(true); });
    document.getElementById('mrj-dup-go').addEventListener('click', function () {
      window.MRJMailbox.startRecoverPublic();
    });
    document.getElementById('mrj-dup-x').addEventListener('click', function () {
      dupBanner.style.display = 'none'; /* 只是本次收起；下次 my_status 发现还没合并会再出现 */
      dupBannerShift(false);
    });
  }
  function hideDupBanner() {
    if (dupBanner) { dupBanner.style.display = 'none'; dupBannerShift(false); }
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

  /* 🔔 v4.14 提示音：店家回复时轻轻「叮」一声（WebAudio，浏览器不允许就静默跳过） */
  var dingCtx = null;
  function ding() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!dingCtx) dingCtx = new AC();
      if (dingCtx.state === 'suspended') dingCtx.resume();
      var t = dingCtx.currentTime;
      var o = dingCtx.createOscillator();
      var g = dingCtx.createGain();
      o.type = 'sine'; o.frequency.value = 987; /* B5，比门铃柔和 */
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); g.connect(dingCtx.destination);
      o.start(t); o.stop(t + 0.65);
    } catch (e) {}
  }

  /* 🔔 v4.14 网页标题提醒：切到别的分页也能看到「🍞有新回复」 */
  var baseTitle = document.title;
  function setTitleAlert(on) {
    try {
      if (on) { if (document.title.indexOf('🍞') !== 0) document.title = '🍞有新回复 · ' + baseTitle; }
      else { baseTitle = baseTitle || document.title; if (document.title.indexOf('🍞') === 0) document.title = baseTitle; }
    } catch (e) {}
  }

  /* 购物车按钮 + 抽屉入口红点 */
  function setCartDot(on) {
    setTitleAlert(on); /* 红点亮 = 标题也提醒；红点灭 = 标题恢复 */
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

  /* ⏳ v4.16 有温度的加载态：Apps Script 冷启动可达10-20秒，
   * 旧版只有一行"加载中…"，顾客以为订单消失了。
   * 新版：面包转圈 + 明确告知"订单都在" + 慢的时候更新文案 + 失败可重试 */
  var loadT1 = null, loadT2 = null;
  function clearLoadTimers() {
    clearTimeout(loadT1); clearTimeout(loadT2);
    loadT1 = null; loadT2 = null;
  }
  function renderLoading() {
    var en = isEn();
    /* 首屏加载过场：面包转圈 + 安抚文案 + 3 张流光骨架卡（模拟订单正在加载出来），
     * 订单接口有时较慢，用动画让顾客明确看到「正在加载」而不是空白卡住 */
    var skCard = '<div class="mrj-skcard"><div class="mrj-skln w1"></div><div class="mrj-skln w2"></div><div class="mrj-skln bar"></div></div>';
    document.getElementById('mrj-obody').innerHTML =
      '<div class="mrj-listload" id="mrj-loading">' +
      '<div class="mrj-listload-tip"><span class="mrj-loadspin">🍞</span>' +
      '<b style="color:#5a3a22;display:block">' + (en ? 'Fetching your orders…' : '正在取回您的订单…') + '</b>' +
      '<small id="mrj-load-sub" style="display:block;margin-top:4px">' + (en ? 'Your orders are safely stored — just connecting to the bakery.' : '您的订单都好好保存着，正在连接烘焙坊～') + '</small></div>' +
      skCard + skCard + skCard +
      '</div>';
    clearLoadTimers();
    /* 6秒还没回来：解释一下为什么慢 */
    loadT1 = setTimeout(function () {
      var sub = document.getElementById('mrj-load-sub');
      if (sub) sub.innerHTML = en
        ? '☁ Server is waking up from a nap — may take up to 20 seconds. Your orders are NOT lost!'
        : '☁ 服务器刚睡醒，还需要几秒（最多约20秒）。<b>您的订单不会丢失！</b>';
    }, 6000);
    /* 15秒还没回来：再安抚一次 */
    loadT2 = setTimeout(function () {
      var sub = document.getElementById('mrj-load-sub');
      if (sub) sub.innerHTML = en
        ? 'Almost there… thanks for your patience 🌾'
        : '就快好了…谢谢您的耐心 🌾';
    }, 15000);
  }
  function renderLoadFailed() {
    var en = isEn();
    var body = document.getElementById('mrj-obody');
    if (!document.getElementById('mrj-loading')) return; /* 已有内容渲染出来就别覆盖 */
    body.innerHTML =
      '<div class="mrj-empty"><span>🔌</span>' +
      '<b style="color:#5a3a22">' + (en ? 'Network hiccup' : '网络不太顺') + '</b>' +
      '<small style="margin:6px 0 12px">' + (en ? 'Your orders are safe on our server. Please retry.' : '您的订单安全保存在服务器上，没有丢失。请重试一下～') + '</small>' +
      '<button id="mrj-load-retry" style="background:#8b5e3c;color:#fff;border:none;border-radius:99px;padding:10px 26px;font-size:14px;font-weight:700;cursor:pointer">' + (en ? '↻ Retry' : '↻ 重新加载') + '</button></div>';
    var rb = document.getElementById('mrj-load-retry');
    if (rb) rb.addEventListener('click', function () {
      renderLoading();
      fetchAndApply(true);
    });
  }

  function showOrders() {
    backdrop.classList.add('show'); modal.classList.add('show');
    document.body.classList.add('no-scroll');
    setCartDot(false);
    pulseMsgBtn(false); /* v4.14：打开窗即停呼吸提醒 */
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
      else renderLoading(); /* v4.16：有温度的加载态（面包转圈+说明订单没丢+慢时安抚+失败重试） */
    }
    fetchAndApply(true);
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden) fetchAndApply(false); }, 15000);
  }
  function hideOrders() {
    backdrop.classList.remove('show'); modal.classList.remove('show');
    document.body.classList.remove('no-scroll');
    clearInterval(pollTimer);
    clearLoadTimers(); /* v4.16：关窗即撤加载文案定时器 */
    markShopSeen();
    askByUser = false; /* 关窗复位：下次打开重新判定是否显示「订单加载中」 */
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
      clearLoadTimers(); /* v4.16：回来了就撤掉"慢加载"文案定时器 */
      if (!r.ok) { renderLoadFailed(); return; } /* 服务器说不行 → 重试界面（仅加载态时覆盖） */
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
        }) ||
        /* 🚚 拼单进度/预期日期/分组变化 → 整体重绘（v4.19 比整个 pools） */
        JSON.stringify(r.pools || r.pool || 0) !== JSON.stringify(lastData.pools || lastData.pool || 0);
      lastData = r;
      var firstLoad = !loadedOnce; /* 这是首次成功拿到数据 */
      loadedOnce = true;
      if (firstLoad || structureChanged || isOpen && !document.querySelector('.mrj-split')) {
        renderFull(r); /* 首次到货 / 订单增减 / 状态变化 → 整体重绘（替换掉「订单加载中」占位） */
      } else {
        applyMsgDelta(r); /* 只追加新消息，不动滚动位置 */
      }
      if (modal.classList.contains('show')) markShopSeen();
    }).catch(function () {
      /* v4.16：网络失败——正在显示加载态才切到重试界面；已有内容就静默（下轮轮询自动补） */
      clearLoadTimers();
      renderLoadFailed();
    });
  }

  /* ---------- 整体渲染（打开/结构变化时）：左右分栏 ---------- */
  var selectedOid = null;   /* 当前选中的订单（右栏显示谁） */
  var loadedOnce = false;   /* 是否已成功拿到过一次 my_status（用于区分「订单加载中」和「真没订单」） */
  var askByUser = false;    /* 客服咨询是否为用户主动点开（区分「主动进客服」和「订单没到的 fallback」） */
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
    /* 选中项失效时：有订单选第一单；没订单时——
     * 若用户主动点了客服咨询 / 已完成首次加载（确实没订单）→ 客服咨询；
     * 否则（首次订单还没到）→ 用 '__loading__' 占位，右栏显示「订单加载中…」，
     *   避免打开就直接掉进「只有客服咨询」、订单几秒后才慢慢冒出来的观感。 */
    if (!selectedOid || selectedOid === '__loading__' ||
        (selectedOid !== 'ask' && !ordersSorted.some(function (w) { return w.orderId === selectedOid; }))) {
      selectedOid = ordersSorted.length ? ordersSorted[0].orderId
        : (askByUser || loadedOnce ? 'ask' : '__loading__');
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

    /* 左栏点击切换 —— 就地切换，不整体重建 body：
     * 数据都是本地现成的，直接重绘右侧详情栏 + 挪动列表高亮即可（瞬时完成），
     * 不再拆掉整个 split 再重建，也不闪骨架屏——那会造成切换时的「黑条闪一下」。 */
    body.querySelectorAll('[data-li]').forEach(function (li) {
      li.addEventListener('click', function () {
        selectedOid = li.dataset.li;
        if (selectedOid === 'ask') askByUser = true; /* 用户主动点客服咨询 */
        mobDetail = true; /* 手机上进详情页 */
        var split = document.querySelector('.mrj-split');
        if (split) split.classList.add('mob-detail');
        /* 挪动左栏选中高亮（不重建列表 DOM，避免闪烁） */
        body.querySelectorAll('[data-li]').forEach(function (x) {
          x.classList.toggle('sel', x.dataset.li === selectedOid);
        });
        /* 只重绘右侧详情栏（本地数据，瞬时；有内容直接换，无空白过场） */
        renderDetailPane(r, ordersSorted.filter(function (w) { return w.orderId === selectedOid; })[0]);
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

  /* 🚚 v4.17 拼单进度条：只在「等拼单」且还没送达/取消的订单里显示。
   * 数据来自 my_status 的 pool 字段（全店活跃拼单合计，不含他人隐私）。
   * v4.17：①成团后不再显示合计金额（不泄露销售额），只报喜+预期日期；
   *        ②店家可在 APP 设置预期送货日期（pool.eta），凑单中/成团后都显示 */
  function poolHtml(r, w, en) {
    var o = w.order || {};
    var gm = String(o.note || '').match(/等拼单#?(\d*)/);
    if (!gm) return '';
    if (w.status === 'delivered' || w.status.indexOf('cancelled') === 0) return '';
    /* v4.19 拼团分组：按订单自己的团号取数据（协商不拢店家会拆团，各团独立计） */
    var grp = gm[1] || '1';
    var pool = (r && r.pools && r.pools[grp]) || (grp === '1' && r && r.pool) || {};
    var goal = Number(pool.goal) || 50;
    var sum = Number(pool.sum) || Number(o.total) || 0;
    var n = Number(pool.n) || 1;
    var eta = String(pool.eta || '');
    var pct = Math.min(100, Math.round(sum / goal * 100));
    var full = sum >= goal;
    var txt, etaLine = '';
    /* 🤝 本单是否「还没并入本团」：自己的备注没有 🤝（未被店家定案并入本团）。
     *   若本团已定好送货时间（eta 存在）而本单还没并入 = 这单其实是「来晚了/待加入」，
     *   绝不能把它显示成「已经在成团里」，否则顾客会以为自动进了已定案的团（issue #1）。 */
    var mine = String(o.note || '').indexOf('🤝') === -1;
    var agreed = !!o.poolJoinAgreed;
    var lateUnjoined = mine && !!eta && !agreed; /* 本团已定案，但本单还没并入、也还没同意 */
    var etaMs = 0;
    var em = String(eta).match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})/);
    if (em) etaMs = new Date(+em[1], +em[2] - 1, +em[3], +em[4], +em[5], 0, 0).getTime();
    var can36 = etaMs && (etaMs - Date.now() >= 36 * 3600 * 1000);
    /* ⏰ 「来晚了/待加入」独立卡片：不显示成团/预计送货（避免误以为已进团）。
     *   ≥36h → 亮出「加入本团」邀请；<36h → 温和告知会安排下一趟，不打扰。 */
    if (lateUnjoined) {
      if (can36) {
        return '<div class="mrj-pool">' +
          '<div style="margin-bottom:4px">🤝 ' +
          (en ? 'Pool #' + grp + ' already has a set delivery time: <b>' + escB(eta) + '</b>. You are <b>not in it yet</b> — join to be delivered together? Your delivery date would change to this time.'
              : grp + ' 号团已定好送货时间：<b>' + escB(eta) + '</b>。您<b>还没加入</b>——要加入一起配送吗？加入后您的送货日期会改为这个时间。') + '</div>' +
          '<button class="mrj-pool-join-btn" data-pooljoin="' + escB(w.orderId) + '" data-poolgrp="' + escB(grp) + '">' +
          (en ? '🤝 Join pool #' + grp + ' (delivery → ' + escB(eta) + ')' : '🤝 加入 ' + grp + ' 号团（送货改为 ' + escB(eta) + '）') +
          '</button>' +
          '<div style="margin-top:6px;font-size:11px;opacity:.8">' +
          (en ? 'Prefer another date? Just leave it — we will pool you with the next batch.' : '想要别的日期也没关系，不加入就好，我们会把您和下一批一起拼团。') + '</div></div>';
      }
      return '<div class="mrj-pool">🚚 ' +
        (en ? 'Your order is being arranged in an upcoming pooled delivery — stay tuned! 🍞'
            : '您的订单会安排在接下来的拼团配送里，请留意订单消息～ 🍞') + '</div>';
    }
    /* 📅 v4.18：各拼单顾客的期望日期（匿名，只有日期）——
     * 大家先看到彼此的期望，心里有数最终会协商到一个日期 */
    var wantsLine = '';
    var wants = pool.wants || [];
    if (wants.length > 1) {
      var wtxt = wants.map(function (w) {
        /* 2026-09-01T11:00 → 9/1；解析不了就原样（去T） */
        var mm = String(w).match(/^\d{4}-(\d{1,2})-(\d{1,2})/);
        return mm ? (+mm[1]) + '/' + (+mm[2]) : String(w).replace('T', ' ');
      }).join('、');
      wantsLine = '<div style="margin-top:5px;font-size:11.5px;opacity:.85">🗓 ' +
        (en ? 'Preferred dates in this pool: ' + escB(wtxt) + ' — we will coordinate one delivery date with everyone.'
            : '拼友们的期望日期：' + escB(wtxt) + ' — 最终会协商统一为一天配送，请留意通知～') + '</div>';
    }
    if (eta) {
      etaLine = '<div style="margin-top:5px;padding-top:5px;border-top:1px dashed ' + (full ? '#a5cb9d' : '#e5cf9e') + '">📅 ' +
        (en ? '<b>Expected delivery: ' + escB(eta) + '</b> (we will confirm the exact time with you)'
            : '<b>预计送货：' + escB(eta) + '</b>（具体时间我们会再和您确认）') + '</div>';
    } else if (full) {
      etaLine = '<div style="margin-top:5px;padding-top:5px;border-top:1px dashed #a5cb9d">📅 ' +
        (en ? 'We are arranging the delivery date — stay tuned!' : '正在安排送货日期，请留意订单消息～') + '</div>';
    }
    if (full) {
      /* 成团：只报喜，不亮金额（销售额是店家的隐私） */
      txt = en
        ? '🎉 <b>Pool complete!</b> ' + n + ' order' + (n > 1 ? 's' : '') + ' heading your way together.'
        : '🎉 <b>拼单成团啦！</b>同方向已凑满 ' + n + ' 单，一起为您送过来。';
    } else {
      txt = en
        ? '🚚 <b>Pooled delivery</b> — ' + n + ' order' + (n > 1 ? 's' : '') + ' pooled, RM ' + (goal - sum).toFixed(2) + ' to go. Share with friends nearby to bake it faster 🍞'
        : '🚚 <b>拼单配送中</b> — 已凑 ' + n + ' 单，还差 RM ' + (goal - sum).toFixed(2) + ' 成团。介绍邻居朋友一起下单，更快送到哦 🍞';
    }
    /* 团号标注（1号团也显示；文案精简）：让顾客一眼知道自己在哪个团 */
    var grpLine = '<div style="margin-top:4px;font-size:11px;opacity:.8">ℹ️ ' +
      (en ? 'You are in pool #' + grp : '您在 ' + grp + ' 号团') + '</div>';
    /* 🤝 已同意加入本团（等店家确认）：显示确认态提示 */
    var joinLine = '';
    if (agreed) {
      joinLine = '<div class="mrj-pool-join done">✅ ' +
        (en ? 'You have agreed to join pool #' + grp + '. Delivery will change to ' + escB(eta) + ' once the bakery confirms.'
            : '您已同意加入 ' + grp + ' 号团，送货日期将在店家确认后统一为 ' + escB(eta) + '。') + '</div>';
    }
    return '<div class="mrj-pool' + (full ? ' full' : '') + '">' + txt + grpLine + wantsLine + etaLine + joinLine +
      '<div class="pool-bar"><div class="pool-fill" style="width:' + pct + '%"></div></div>' +
      '<span style="font-size:11px;opacity:.75">' + pct + '%' + (full ? '' : (en ? ' · updates automatically' : ' · 进度自动更新')) + '</span></div>';
  }

  /* 右栏渲染：一次只显示一个订单的进度+聊天 */
  /* ⏳ 详情加载过场：点开订单后详情还没就绪时显示（骨架屏 + 面包转圈），
   * 避免右栏留白 / 卡顿感。返回按钮照常可用，手机上不会卡在空白页 */
  function detailSkeletonHtml(en) {
    return '<div class="mrj-back" id="mrj-back">‹ ' + (en ? 'All orders' : '返回订单列表') + '</div>' +
      '<div class="mrj-detail-loading">' +
      '<span class="mrj-loadspin">🍞</span>' +
      '<b style="color:#5a3a22;display:block;margin-top:6px">' + (en ? 'Opening your order…' : '正在打开订单…') + '</b>' +
      '<div class="mrj-sk sk1"></div><div class="mrj-sk sk2"></div><div class="mrj-sk sk3"></div>' +
      '</div>';
  }

  function renderDetailPane(r, w) {
    var pane = document.getElementById('mrj-detail');
    if (!pane) return;
    var en = isEn();
    /* ⏳ 首次订单还没到：右栏显示「订单加载中…」过场（面包转圈 + 骨架条），
     * 而不是直接掉进「客服咨询」——这样打开就明确看到订单正在加载 */
    if (selectedOid === '__loading__') {
      pane.innerHTML =
        '<div class="mrj-detail-loading">' +
        '<span class="mrj-loadspin">🍞</span>' +
        '<b style="color:#5a3a22;display:block;margin-top:6px">' + (en ? 'Loading your orders…' : '订单加载中…') + '</b>' +
        '<small id="mrj-load-sub" style="display:block;color:#b3a28c;margin-top:4px">' + (en ? 'Fetching from the bakery, just a moment 🌾' : '正在从烘焙坊取回您的订单，请稍候 🌾') + '</small>' +
        '<div class="mrj-sk sk1"></div><div class="mrj-sk sk2"></div><div class="mrj-sk sk3"></div>' +
        '</div>';
      return;
    }
    /* 返回按钮：即使在过场骨架里也要能用（绑定在下面统一处理） */
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
    if (!w) {
      pane.innerHTML = detailSkeletonHtml(en); /* 数据还没到：显示加载过场，别留白让人以为卡住 */
      var bk0 = document.getElementById('mrj-back');
      if (bk0) bk0.addEventListener('click', function () { mobDetail = false; renderFull(lastData || r); });
      return;
    }
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
      steps +
      poolHtml(r, w, en); /* 🚚 v4.14：等拼单的订单显示全店拼单进度条 */

    if (!cancelled) {
      var faqOpts = '<option value="">💡 ' + (en ? 'Quick questions (tap to ask)' : '常见问题（点选即问）') + '</option>' +
        FAQ.map(function (f, i) { return '<option value="' + i + '">' + (en && f.qEn ? f.qEn : f.q) + '</option>'; }).join('');
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
        var en = isEn();
        var f = FAQ[+sel.value];
        sel.value = '';
        /* 按当前语言取问答（英文缺失时回退中文，保证不空白） */
        var fq = en && f.qEn ? f.qEn : f.q;
        var fa = en && f.aEn ? f.aEn : f.a;
        if (f.cancel) {
          /* 取消订单：动态回答 + 隐蔽的文字链接（双语） */
          var w0 = (lastData && lastData.orders || []).filter(function (x) { return x.orderId === sel.dataset.faq; })[0];
          var canCancel = w0 && (w0.status === 'pending' || w0.status === 'new');
          fq = en ? 'I want to cancel my order' : '我想取消订单';
          if (en) {
            fa = canCancel
              ? 'Sure — since it is not confirmed yet, it can be cancelled. Please make sure you no longer need it: every handmade order reserves ingredients just for you 🥲 If you are certain, tap: <u class="mrj-do-cancel" data-oid="' + sel.dataset.faq + '" style="cursor:pointer">Confirm cancellation</u>'
              : 'Your order is already confirmed and the ingredients have been set aside, so it cannot be cancelled directly for now. If something special has come up, please leave a message below and our baker will discuss it with you as soon as possible.';
          } else {
            fa = canCancel
              ? '好的，订单还未确认可以取消。请确认您真的不需要了——手作烘焙每一单都是为您预留的食材呢 🥲 确定的话请点：<u class="mrj-do-cancel" data-oid="' + sel.dataset.faq + '" style="cursor:pointer">确认取消订单</u>'
              : '您的订单已经确认，食材已为您安排，暂时不能直接取消了。如有特殊情况请在下方留言，师傅会尽快与您协商～';
          }
        }
        var now = Date.now();
        var qm = { orderId: sel.dataset.faq, from: 'customer', text: fq, at: now };
        var am = { orderId: sel.dataset.faq, from: 'shop', text: fa, at: now + 1 };
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
          var thinkMs = Math.min(2000, 900 + (fa || '').length * 8);
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

  /* 🤝 加入本团邀请按钮（事件委托）：顾客点同意 → 请求加入，交店家复核 */
  modal.addEventListener('click', function (e) {
    var jb = e.target.closest ? e.target.closest('.mrj-pool-join-btn') : null;
    if (!jb) return;
    var en = isEn();
    mrjConfirm(
      en ? 'Join pool #' + jb.dataset.poolgrp + '?' : '加入 ' + jb.dataset.poolgrp + ' 号团？',
      en ? 'Your delivery date will change to the pool\'s unified time. The bakery will confirm before finalising.'
         : '您的送货日期会改为本团的统一时间，店家确认后正式并入。',
      en ? 'Yes, join' : '确定加入',
      en ? 'Not now' : '再想想'
    ).then(function (yes) { if (yes) doPoolJoin(jb.dataset.pooljoin, jb.dataset.poolgrp); });
  });

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
  /* 🤝 顾客同意加入本团：即时反馈 + 请求后端；成功后刷新（进度卡换成「已同意」态） */
  function doPoolJoin(orderId, grp) {
    var en = isEn();
    post({ action: 'pool_join_request', token: getToken(), orderId: orderId, group: grp }).then(function (r) {
      if (!r || !r.ok) {
        mrjAlert((en ? 'Could not join: ' : '暂时无法加入：') + ((r && r.error) || (en ? 'please try again later.' : '请稍后再试。')));
        return;
      }
      mrjAlert(en
        ? '✓ Request sent! We will confirm and finalise your spot in the pool shortly. 🌾'
        : '✓ 已提交！店家确认后就会把您正式并入本团，请留意订单消息～ 🌾');
      setTimeout(function () { fetchAndApply(true); }, 800);
    }).catch(function () {
      mrjAlert(en ? 'Network hiccup — please try again.' : '网络不太稳定，请再试一次～');
    });
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
        /* 🔔 v4.14：新回复不再默不作声——只在数量增加的这一刻响一声+按钮呼吸 */
        if (n > lastDingN) {
          ding();
          pulseMsgBtn(true);
          lastDingN = n;
          try { localStorage.setItem('mrj_ding_n', String(n)); } catch (e) {}
        }
      }
    }).catch(function () {});
  }
  /* 🔔 记住上次响铃时的店家消息数：防止每 30 秒重复响 */
  var lastDingN = Number(localStorage.getItem('mrj_ding_n') || 0) || seenShopN;
  /* 信息按钮呼吸动画：有新回复时头部按钮轻轻放大缩小，一眼看到 */
  function pulseMsgBtn(on) {
    var b = document.getElementById('mrj-msg-btn');
    if (b) { if (on) b.classList.add('mrj-pulse'); else b.classList.remove('mrj-pulse'); }
  }
  bgTimer = setInterval(bgWatch, 30000); /* v4.14: 60秒→30秒，回复提醒快一倍（仅活跃订单时才真打网络） */
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
    msg += (en ? 'Preferred Time: ' : '期望时间：') + String(data.date || '').replace('T', ' ') + '\n';
    if (data.pooled) msg += (en ? 'Note: below delivery threshold, waiting for pooled delivery (date TBC)' : '备注：未满起送额，等拼单配送（日期待确认）') + '\n';
    msg += '\n';
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
        /* v4.4：deliveryZone 已含邮编；拼单单再补一个显眼标记，店家 APP 里一眼看到 */
        note: (data.deliveryZone ? '[' + data.deliveryZone + '] ' : '') + (data.pooled ? '🚚⏳[等拼单] ' : ''),
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
    openAsk: function () { selectedOid = 'ask'; askByUser = true; mobDetail = true; showOrders(); },

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

    /* 📱 多设备同步（v13）：不再用配对码。改为「验证手机号码」——
     * 在新设备用同一电话注册麦友 → 顶部出现验证横幅 → 用该号码 WhatsApp 发码给店家 →
     * 店家在 APP 批准后，新设备的 token 被【追加】进同一账号（旧 token 不删），
     * 于是新旧手机都能登入、订单/积分/聊天全同步。openPair/配对码整条逻辑已删除。 */

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
          /* 📱「多设备同步」按钮已移除（v13）：改用顶部「验证手机号码」横幅统一处理 */
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
      /* 📱 多设备同步入口已移除（v13）：统一走顶部「验证手机号码」横幅 */
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
