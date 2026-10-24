/* Utilidades: datas em America/Sao_Paulo, construtor de DOM, formatação. Sem dependências. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var TZ = 'America/Sao_Paulo';
  var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var fmt = null;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch (e) { fmt = null; }

  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  /* "agora" em São Paulo -> {y,m,d,h,mi,s,dow,iso,hhmm} */
  function agora(data) {
    data = data || new Date();
    var y, m, d, h, mi, s;
    if (fmt) {
      var p = {};
      fmt.formatToParts(data).forEach(function (x) { p[x.type] = x.value; });
      y = +p.year; m = +p.month; d = +p.day; h = +p.hour % 24; mi = +p.minute; s = +p.second;
    } else {
      y = data.getFullYear(); m = data.getMonth() + 1; d = data.getDate(); h = data.getHours(); mi = data.getMinutes(); s = data.getSeconds();
    }
    var iso = y + '-' + pad(m) + '-' + pad(d);
    return { y: y, m: m, d: d, h: h, mi: mi, s: s, dow: dowIso(iso), iso: iso, hhmm: pad(h) + ':' + pad(mi) };
  }
  function utc(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function dowIso(iso) { return new Date(utc(iso)).getUTCDay(); }
  function somaDias(iso, n) {
    var t = new Date(utc(iso) + n * 86400000);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function difDias(a, b) { return Math.round((utc(a) - utc(b)) / 86400000); } /* a - b */
  function diasNoMes(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function ym(iso) { return iso.slice(0, 7); }
  function somaMes(ymStr, n) {
    var y = +ymStr.slice(0, 4), m = +ymStr.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function dataNoMes(ymStr, dia) { return ymStr + '-' + pad(Math.min(Math.max(1, dia), diasNoMes(+ymStr.slice(0, 4), +ymStr.slice(5, 7)))); }
  function dataValida(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(utc(s)); }
  function horaValida(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  function dataLonga(iso) { var p = iso.split('-'); return DIAS[dowIso(iso)] + ', ' + (+p[2]) + ' de ' + MESES[+p[1] - 1]; }
  function dataCurta(iso) { var p = iso.split('-'); return DIAS_CURTOS[dowIso(iso)] + ', ' + pad(p[2]) + '/' + pad(p[1]); }
  function rotuloRelativo(iso, hoje) {
    var n = difDias(iso, hoje);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    if (n > 1) return 'em ' + n + ' dias';
    return 'há ' + (-n) + ' dias';
  }
  function valorBRL(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    n = Number(n);
    try { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch (e) { return 'R$ ' + n.toFixed(2).replace('.', ','); }
  }
  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function limitar(s, n) { s = (s == null ? '' : String(s)); return s.length > n ? s.slice(0, n) : s; }

  /* DOM: h('div', {class:'x', onclick:fn}, filhos...) — nunca usa innerHTML com dados do usuário */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) anexar(el, arguments[i]);
    return el;
  }
  function anexar(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { anexar(el, x); }); return; }
    if (c.nodeType) el.appendChild(c); else el.appendChild(document.createTextNode(String(c)));
  }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function focavel(el, extra) { el.setAttribute('tabindex', '0'); el.setAttribute('data-f', ''); if (extra) el.setAttribute('data-fid', extra); return el; }

  PS.u = { TZ: TZ, DIAS: DIAS, DIAS_CURTOS: DIAS_CURTOS, MESES: MESES, pad: pad, agora: agora, hoje: function () { return agora().iso; }, dowIso: dowIso, somaDias: somaDias, difDias: difDias, diasNoMes: diasNoMes, ym: ym, somaMes: somaMes, dataNoMes: dataNoMes, dataValida: dataValida, horaValida: horaValida, dataLonga: dataLonga, dataCurta: dataCurta, rotuloRelativo: rotuloRelativo, valorBRL: valorBRL, uid: uid, limitar: limitar, h: h, limpar: limpar, focavel: focavel };
})(window);
