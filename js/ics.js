/* Importador .ics (iCalendar) sem OAuth: SUMMARY, LOCATION, DTSTART e RRULE simples (DAILY/WEEKLY/MONTHLY/YEARLY). */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u;
  var BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  function desescapar(s) { return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\'); }
  function parseData(valor, params) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(valor.trim());
    if (!m) return null;
    if (m[4] == null) return { data: m[1] + '-' + m[2] + '-' + m[3], hora: '' };
    if (m[7]) { /* UTC -> São Paulo */
      var a = U.agora(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))));
      return { data: a.iso, hora: a.hhmm };
    }
    return { data: m[1] + '-' + m[2] + '-' + m[3], hora: m[4] + ':' + m[5] };
  }
  function parseRrule(s) {
    var r = {}; s.split(';').forEach(function (p) { var kv = p.split('='); r[kv[0]] = kv[1]; });
    return r;
  }
  function expandir(ini, rr, de, ate) {
    var out = [], max = rr && rr.COUNT ? +rr.COUNT : 100000, n = 0, guard = 0;
    var inter = Math.max(1, +(rr && rr.INTERVAL) || 1);
    var until = rr && rr.UNTIL ? (parseData(rr.UNTIL) || {}).data : null;
    function add(d) {
      if (d < ini) return true;
      if (until && d > until) return false;
      if (n >= max) return false;
      n++;
      if (d >= de && d <= ate) out.push(d);
      return d <= ate;
    }
    if (!rr) { if (ini >= de && ini <= ate) out.push(ini); return out; }
    var f = rr.FREQ, cont = true;
    if (f === 'DAILY') { for (var d = ini; cont && guard++ < 4000; d = U.somaDias(d, inter)) cont = add(d); }
    else if (f === 'WEEKLY') {
      var dias = rr.BYDAY ? rr.BYDAY.split(',').map(function (x) { return BYDAY[x.slice(-2)]; }).filter(function (x) { return x != null; }) : [U.dowIso(ini)];
      dias.sort();
      var ini0 = U.somaDias(ini, -U.dowIso(ini)); /* domingo da semana inicial */
      for (var w = ini0; cont && guard++ < 1500; w = U.somaDias(w, 7 * inter)) {
        for (var k = 0; k < dias.length && cont; k++) cont = add(U.somaDias(w, dias[k]));
      }
    } else if (f === 'MONTHLY') {
      var dm = +ini.slice(8);
      for (var m = U.ym(ini); cont && guard++ < 600; m = U.somaMes(m, inter)) {
        if (dm <= U.diasNoMes(+m.slice(0, 4), +m.slice(5))) cont = add(m + '-' + U.pad(dm));
      }
    } else if (f === 'YEARLY') {
      for (var y = +ini.slice(0, 4); cont && guard++ < 100; y += inter) {
        var dd = y + ini.slice(4); if (U.dataValida(dd)) cont = add(dd);
      }
    } else { if (ini >= de && ini <= ate) out.push(ini); }
    return out;
  }

  function importar(texto, diasFrente) {
    var hoje = U.hoje(), de = U.somaDias(hoje, -1), ate = U.somaDias(hoje, diasFrente || 120);
    var linhas = texto.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var evs = [], atual = null, resultado = [], vistos = {};
    linhas.forEach(function (l) {
      if (l === 'BEGIN:VEVENT') { atual = {}; return; }
      if (l === 'END:VEVENT') { if (atual) evs.push(atual); atual = null; return; }
      if (!atual) return;
      var i = l.indexOf(':'); if (i < 0) return;
      var partes = l.slice(0, i).split(';'), nome = partes[0].toUpperCase(), valor = l.slice(i + 1);
      if (nome === 'SUMMARY') atual.titulo = desescapar(valor);
      else if (nome === 'LOCATION') atual.local = desescapar(valor);
      else if (nome === 'DTSTART') atual.ini = parseData(valor, partes.slice(1));
      else if (nome === 'RRULE') atual.rr = parseRrule(valor);
      else if (nome === 'STATUS') atual.status = valor.toUpperCase();
    });
    evs.forEach(function (e) {
      if (!e.ini || e.status === 'CANCELLED') return;
      expandir(e.ini.data, e.rr, de, ate).forEach(function (d) {
        var c = { id: U.uid(), titulo: U.limitar(e.titulo || 'Compromisso', 120), data: d, hora: e.ini.hora, local: U.limitar(e.local || '', 80), fonte: 'ics' };
        var k = c.titulo + '|' + c.data + '|' + c.hora;
        if (!vistos[k]) { vistos[k] = 1; resultado.push(c); }
      });
    });
    return { total: evs.length, compromissos: resultado.slice(0, 500) };
  }
  PS.ics = { importar: importar };
})(window);
