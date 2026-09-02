/* 麦日记官网 PWA Service Worker（v2）
 * 策略：HTML 永远走网络（保证内容最新，断网才用缓存兜底）；
 *       静态资源（js/css/图片/字体）走 stale-while-revalidate：先给缓存秒开，
 *       同时后台拉最新写回缓存——下次访问即最新（避免旧 JS 卡住功能更新）。
 * 注意：只缓存同源文件；Apps Script 请求（POST/跨域）一律直通不缓存。
 * ⚠️ 改了 main.js / addon 等静态资源后，请把 CACHE 版本号 +1（如 v2→v3），
 *    activate 时会清掉旧缓存，回头客不会再被旧文件卡住。 */
var CACHE = 'mrj-web-v7';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       /* POST（下单/聊天）直通 */
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        /* 跨域（Apps Script 等）直通 */

  var isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isHTML) {
    /* 网络优先：内容永远最新；断网回缓存 */
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }
  /* 静态资源：缓存优先 + 后台更新（stale-while-revalidate） */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var fetching = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fetching;
    })
  );
});
