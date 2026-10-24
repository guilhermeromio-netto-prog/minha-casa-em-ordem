/* Isolado de propósito: só este arquivo usa import() dinâmico (carrega o pdf.js sob demanda, só na tela Cartões). */
(function (g) { 'use strict'; g.PS = g.PS || {}; g.PS.importarModulo = function (url) { return import(url); }; })(window);
