/* Proteção de tela: deriva lenta do layout, escurecimento por inatividade e modo noite automático. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var ultimo = Date.now(), deriva = [[0, 0], [5, 3], [-4, 5], [3, -4], [-5, -3], [4, 2]], di = 0;
  PS.atividade = function () { ultimo = Date.now(); if (document.body.classList.contains('dim')) document.body.classList.remove('dim'); };
  ['pointerdown', 'pointermove', 'touchstart', 'wheel'].forEach(function (ev) { g.addEventListener(ev, PS.atividade, { passive: true }); });
  setInterval(function () {
    var c = PS.store.get(); if (!c) return; c = c.config;
    var ag = PS.u.agora();
    var dorme = c.escurecerMin > 0 && Date.now() - ultimo > c.escurecerMin * 60000;
    document.body.classList.toggle('dim', dorme);
    document.documentElement.classList.toggle('noite', !!c.noiteAuto && (ag.h >= 22 || ag.h < 6));
  }, 10000);
  /* desloca alguns pixels a cada 3 min (evita imagem parada = burn-in) — só em tela de TV */
  setInterval(function () {
    if (g.innerWidth < 800) return;
    di = (di + 1) % deriva.length;
    document.documentElement.style.setProperty('--dx', deriva[di][0] + 'px');
    document.documentElement.style.setProperty('--dy', deriva[di][1] + 'px');
  }, 180000);
})(window);
