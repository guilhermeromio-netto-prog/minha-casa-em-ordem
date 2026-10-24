/* Service worker simples: rede primeiro, cache como reserva (casca offline). Troque VERSAO a cada release (tools/versionar.sh faz isso). */
var VERSAO = 'painel-sala-2f12161';
var ARQUIVOS = ['./', 'index.html', 'dados.json', 'manifest.webmanifest', 'assets/favicon.svg', 'icons/icon-192.png',
  'css/tokens.css', 'css/base.css', 'css/app.css',
  'js/util.js', 'js/icons.js', 'js/store.js', 'js/dominio.js', 'js/clima.js', 'js/ics.js', 'js/nav.js', 'js/energia.js', 'js/telas.js', 'js/gerenciar.js', 'js/app.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;   /* clima etc. vão direto à rede */
  if (/\.apk$/i.test(r.url)) return;
  e.respondWith(new Promise(function (ok) {
    var passou = false;
    var t = setTimeout(function () { caches.match(r, { ignoreSearch: true }).then(function (c) { if (c && !passou) { passou = true; ok(c); } }); }, 4000);
    fetch(r).then(function (resp) {
      clearTimeout(t);
      if (resp && resp.ok) { var cp = resp.clone(); caches.open(VERSAO).then(function (c) { c.put(r, cp); }); }
      if (!passou) { passou = true; ok(resp); }
    }, function () {
      clearTimeout(t);
      caches.match(r, { ignoreSearch: true }).then(function (c) { if (!passou) { passou = true; ok(c || Response.error()); } });
    });
  }));
});
