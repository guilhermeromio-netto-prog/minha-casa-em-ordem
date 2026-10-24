/* Bloqueio opcional do painel por PIN, só neste aparelho (privacidade de tela). Não é criptografia: os dados locais continuam no navegador.
   Desligado por padrão (na TV ninguém precisa); recomendado em celulares. Trava após inatividade e ao abrir o app. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u, h = U.h;
  var CHAVE = 'painelsala.bloqueio';
  var el = null, ultimo = Date.now(), cfg = ler(), erros = 0, esperaAte = 0;

  function ler() { try { var v = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return v && v.ativo && v.hash && v.salt ? v : { ativo: false }; } catch (e) { return { ativo: false }; } }
  function gravar() { try { if (cfg.ativo) localStorage.setItem(CHAVE, JSON.stringify(cfg)); else localStorage.removeItem(CHAVE); } catch (e) { /* ok */ } }
  function bytes(t) { return new TextEncoder().encode(t); }
  function hex(b) { var s = '', a = new Uint8Array(b), i; for (i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s; }
  function derivar(pin, salt) {
    return crypto.subtle.importKey('raw', bytes(pin), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: 150000 }, k, 256);
    }).then(hex);
  }
  function aberto() { return !!el; }

  function bloquear() {
    if (el || !cfg.ativo) return;
    var msg = h('p', { class: 'nota', role: 'status' }, 'Painel bloqueado. Digite o PIN deste aparelho.');
    var tk = PS.ui.teclado({ rotulo: 'PIN do aparelho', mascarar: true, min: 4, max: 8, aoOk: function (v) {
      if (Date.now() < esperaAte) { msg.textContent = 'Aguarde alguns segundos…'; return; }
      derivar(v, cfg.salt).then(function (hh) {
        if (hh === cfg.hash) { erros = 0; liberar(); }
        else { erros++; esperaAte = Date.now() + Math.min(30000, erros * 2000); msg.textContent = 'PIN incorreto.' + (erros > 2 ? ' Aguarde ' + Math.min(30, erros * 2) + ' s.' : ''); PS.ui.teclado && null; }
      });
    } });
    el = h('div', { class: 'modal bloqueio-tela', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Painel bloqueado' }, h('div', { class: 'modal-caixa' }, h('h2', null, 'Painel da Sala · bloqueado'), msg, tk));
    var ant = document.querySelector('.modal'); if (ant && ant.parentNode) ant.parentNode.removeChild(ant);
    document.body.appendChild(el);
    var t5 = el.querySelector('[data-fid="tk:5"]'); if (t5) PS.nav.focar(t5);
  }
  function liberar() { if (el && el.parentNode) el.parentNode.removeChild(el); el = null; ultimo = Date.now(); PS.nav.focarPrimeiro(); }

  function ativar(pin, minutos) {
    var salt = PS.cripto.b64u(crypto.getRandomValues(new Uint8Array(16)));
    return derivar(pin, salt).then(function (hh) { cfg = { ativo: true, salt: salt, hash: hh, min: minutos || 5 }; gravar(); });
  }
  function desativar(pin) {
    return derivar(pin, cfg.salt).then(function (hh) { if (hh !== cfg.hash) throw new Error('PIN incorreto.'); cfg = { ativo: false }; gravar(); });
  }
  function definirMinutos(m) { if (cfg.ativo) { cfg.min = m; gravar(); } }

  function atividade() { ultimo = Date.now(); }
  ['keydown', 'pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, atividade, { passive: true, capture: true }); });
  setInterval(function () { if (cfg.ativo && !el && Date.now() - ultimo > (cfg.min || 5) * 60000) bloquear(); }, 5000);
  document.addEventListener('visibilitychange', function () { if (document.hidden && cfg.ativo && Date.now() - ultimo > 30000) bloquear(); });

  PS.bloqueio = { aberto: aberto, bloquear: bloquear, ativar: ativar, desativar: desativar, definirMinutos: definirMinutos, ativo: function () { return !!cfg.ativo; }, minutos: function () { return cfg.min || 5; },
    aoAbrir: function () { if (cfg.ativo) bloquear(); } };
})(window);
