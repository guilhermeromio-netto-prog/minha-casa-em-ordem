/* Gráficos em SVG/CSS puro (sem biblioteca): rosca, barras com variação, anel de meta, barra pago×aberto, minigráfico.
   Cada gráfico traz legenda em texto e tabela equivalente (leitores de tela). Animações respeitam prefers-reduced-motion. ES5. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u, h = U.h, I = PS.icone, NS = 'http://www.w3.org/2000/svg';
  var CORES = { mercado: '#2EBB64', restaurante: '#FFB020', transporte: '#4DA3FF', saude: '#FF6B5E', educacao: '#A98BFF', lazer: '#E20074', assinaturas: '#00C7B7', casa: '#C9D1D9', compras: '#FF8FD0', viagens: '#7BDFF2', outros: '#8A93A6' };
  var ICONES = { mercado: 'mercado', restaurante: 'garfo', transporte: 'carro', saude: 'coracao', educacao: 'escola', lazer: 'filme', assinaturas: 'repetir', casa: 'casa', compras: 'sacola', viagens: 'aviao', outros: 'pontos' };
  var NOMES = { mercado: 'Mercado', restaurante: 'Restaurantes/delivery', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', lazer: 'Lazer', assinaturas: 'Assinaturas', casa: 'Casa/contas', compras: 'Compras', viagens: 'Viagens', outros: 'Outros' };
  function brl(v) { return U.valorBRL(v); }
  function reduzido() { return !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function el(tag, at) { var e = document.createElementNS(NS, tag); Object.keys(at || {}).forEach(function (k) { e.setAttribute(k, at[k]); }); return e; }
  function corDe(c) { return CORES[c] || CORES.outros; }

  /* número que "sobe" até o valor final (texto final já vai em data-valor / aria-label) */
  function contar(no, valor, fmt) {
    fmt = fmt || brl; no.setAttribute('data-valor', String(valor));
    if (reduzido() || !g.requestAnimationFrame) { no.textContent = fmt(valor); return no; }
    var ini = null, dur = 650; no.textContent = fmt(0);
    function passo(t) { if (ini == null) ini = t; var k = Math.min(1, (t - ini) / dur), e = 1 - Math.pow(1 - k, 3); no.textContent = fmt(valor * e); if (k < 1) g.requestAnimationFrame(passo); else no.textContent = fmt(valor); }
    g.requestAnimationFrame(passo); return no;
  }

  function tabelaAlt(titulo, cols, linhas) {
    return h('div', { class: 'sr-only' }, h('table', null, h('caption', null, titulo),
      h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', null, linhas.map(function (l) { return h('tr', null, l.map(function (c, i) { return i ? h('td', null, c) : h('th', { scope: 'row' }, c); })); }))));
  }

  /* ---------- rosca por categoria ---------- */
  function donut(itens, o) {
    o = o || {}; var total = 0; itens.forEach(function (x) { total += x.valor; });
    var R = 15.9155, acum = 0, svg = el('svg', { viewBox: '0 0 42 42', class: 'rosca-svg', role: 'img', 'aria-label': (o.titulo || 'Gastos por categoria') + ': total ' + brl(total) + '. ' + itens.map(function (x) { return x.rotulo + ' ' + brl(x.valor); }).join('; ') });
    svg.appendChild(el('circle', { cx: 21, cy: 21, r: R, fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 5 }));
    var centroV = h('strong', { class: 'rc-valor' }), centroT = h('small', { class: 'rc-rot' }, o.centro || 'Total');
    var centro = h('div', { class: 'rosca-centro', 'aria-hidden': 'true' }, centroT, centroV);
    var fatias = [], botoes = [], trava = null;
    function mostrar(i) {
      fatias.forEach(function (f, k) { f.classList.toggle('dim', i != null && k !== i); f.classList.toggle('sel', k === i); });
      botoes.forEach(function (b, k) { b.classList.toggle('sel', k === i); });
      if (i == null) { centroT.textContent = o.centro || 'Total'; centroV.textContent = brl(total); }
      else { centroT.textContent = itens[i].rotulo + ' · ' + Math.round(itens[i].valor / total * 1000) / 10 + '%'; centroV.textContent = brl(itens[i].valor); }
    }
    itens.forEach(function (x, i) {
      var pct = total ? x.valor / total * 100 : 0, c = el('circle', { cx: 21, cy: 21, r: R, fill: 'none', stroke: x.cor, 'stroke-width': 5, 'stroke-dasharray': Math.max(0, pct - 0.6) + ' ' + (100 - Math.max(0, pct - 0.6)), 'stroke-dashoffset': 25 - acum, class: 'fatia', tabindex: '0', 'aria-label': x.rotulo + ': ' + brl(x.valor) + ', ' + Math.round(pct * 10) / 10 + '%' });
      c.style.setProperty('--atraso', (i * 70) + 'ms'); acum += pct;
      c.addEventListener('mouseenter', function () { if (trava == null) mostrar(i); }); c.addEventListener('mouseleave', function () { if (trava == null) mostrar(null); });
      c.addEventListener('focus', function () { if (trava == null) mostrar(i); }); c.addEventListener('blur', function () { if (trava == null) mostrar(null); });
      c.addEventListener('click', function () { trava = trava === i ? null : i; mostrar(trava); });
      svg.appendChild(c); fatias.push(c);
    });
    var leg = h('ul', { class: 'rosca-leg' }, itens.map(function (x, i) {
      var pct = total ? Math.round(x.valor / total * 1000) / 10 : 0;
      var b = h('button', { type: 'button', class: 'leg-item', 'aria-pressed': 'false', 'data-fid': 'leg:' + x.id, onclick: function () { trava = trava === i ? null : i; mostrar(trava); b.setAttribute('aria-pressed', trava === i ? 'true' : 'false'); }, onmouseenter: function () { if (trava == null) mostrar(i); }, onmouseleave: function () { if (trava == null) mostrar(null); }, onfocus: function () { if (trava == null) mostrar(i); } },
        h('span', { class: 'leg-cor', style: 'background:' + x.cor }), I(x.icone || 'pontos'), h('span', { class: 'leg-nome' }, x.rotulo), h('span', { class: 'leg-pct' }, pct.toString().replace('.', ',') + '%'), h('span', { class: 'leg-valor' }, brl(x.valor)));
      botoes.push(b); return h('li', null, b);
    }));
    var caixa = h('div', { class: 'rosca' }, h('div', { class: 'rosca-fig' }, svg, centro), leg, tabelaAlt(o.titulo || 'Gastos por categoria', ['Categoria', 'Valor', '%'], itens.map(function (x) { return [x.rotulo, brl(x.valor), (total ? Math.round(x.valor / total * 1000) / 10 : 0) + '%']; })));
    mostrar(null); contar(centroV, total); return caixa;
  }

  /* ---------- barras mensais com variação ---------- */
  function barras(meses, o) {
    o = o || {}; var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    function rot(m) { return MES[+m.slice(5) - 1] + '/' + m.slice(2, 4); }
    var max = 1; meses.forEach(function (m) { if (m.total > max) max = m.total; });
    var W = 320, H = 120, bw = W / Math.max(1, meses.length), svg = el('svg', { viewBox: '0 0 ' + W + ' ' + (H + 22), class: 'graf-barras', role: 'img', 'aria-label': (o.titulo || 'Gasto por mês') + ': ' + meses.map(function (m) { return rot(m.mes) + ' ' + brl(m.total); }).join('; ') });
    meses.forEach(function (m, i) {
      var hh = Math.max(m.total > 0 ? 3 : 0, Math.round(m.total / max * (H - 16))), x = i * bw + bw * .18, w = bw * .64, ult = i === meses.length - 1;
      var r = el('rect', { x: x, y: H - hh, width: w, height: hh, rx: 3, class: (ult ? 'b-atual' : 'b-ant') + ' barra-anim' }); r.style.setProperty('--atraso', (i * 60) + 'ms'); r.style.transformOrigin = (x + w / 2) + 'px ' + H + 'px'; svg.appendChild(r);
      var t = el('text', { x: x + w / 2, y: H + 14, 'text-anchor': 'middle', class: 'b-rot' }); t.textContent = rot(m.mes); svg.appendChild(t);
      if (ult || meses.length <= 4) { var v = el('text', { x: x + w / 2, y: H - hh - 4, 'text-anchor': 'middle', class: 'b-val' }); v.textContent = brl(m.total).replace('R$ ', ''); svg.appendChild(v); }
    });
    var ult = meses[meses.length - 1], d = ult && ult.vs, txt = '';
    if (d) txt = d.dir === 'igual' ? 'igual ao mês anterior' : (d.dir === 'subiu' ? 'subiu ' : 'caiu ') + brl(Math.abs(d.dv)) + (d.pct != null ? ' (' + Math.abs(d.pct).toString().replace('.', ',') + '%)' : '') + ' vs. mês anterior';
    return h('div', { class: 'barras-box' }, svg, d ? h('p', { class: 'delta ' + d.dir }, I(d.dir === 'subiu' ? 'subiu' : d.dir === 'caiu' ? 'caiu' : 'igual'), h('span', null, rot(ult.mes) + ': ' + txt)) : null,
      tabelaAlt(o.titulo || 'Gasto por mês', ['Mês', 'Total', 'Variação'], meses.map(function (m) { return [rot(m.mes), brl(m.total), m.vs ? (m.vs.dir + ' ' + brl(Math.abs(m.vs.dv))) : '—']; })));
  }

  /* ---------- anel: total do mês vs meta (ou vs mês anterior) ---------- */
  function anel(valor, ref, o) {
    o = o || {}; var pct = ref > 0 ? valor / ref * 100 : 0, vis = Math.min(100, pct), R = 15.9155, over = ref > 0 && valor > ref;
    var svg = el('svg', { viewBox: '0 0 42 42', class: 'anel-svg', role: 'img', 'aria-label': (o.rotulo || 'Total do mês') + ' ' + brl(valor) + (ref > 0 ? ', ' + Math.round(pct) + '% de ' + brl(ref) + ' (' + (o.refRot || 'referência') + ')' : '') });
    svg.appendChild(el('circle', { cx: 21, cy: 21, r: R, fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 4 }));
    var c = el('circle', { cx: 21, cy: 21, r: R, fill: 'none', stroke: over ? '#FF6B5E' : '#E20074', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': vis + ' ' + (100 - vis), 'stroke-dashoffset': 25, class: 'anel-prog' }); svg.appendChild(c);
    var v = h('strong', { class: 'anel-valor' });
    var st = ref > 0 ? h('span', { class: 'selo ' + (over ? 'perigo' : 'ok') }, I(over ? 'alerta' : 'check'), over ? 'Acima de ' + (o.refRot || 'referência') : 'Dentro de ' + (o.refRot || 'referência')) : null;
    var caixa = h('div', { class: 'anel' }, h('div', { class: 'anel-fig' }, svg, h('div', { class: 'anel-centro' }, h('small', null, o.rotulo || 'Total do mês'), v)), h('div', { class: 'anel-info' }, ref > 0 ? h('p', null, Math.round(pct) + '% de ' + brl(ref), h('small', null, (o.refRot || 'referência'))) : h('p', { class: 'nota' }, 'Defina uma meta mensal em Gerenciar para ver o anel.'), st));
    contar(v, valor); return caixa;
  }

  /* ---------- barra pago × em aberto ---------- */
  function pagoAberto(pago, aberto) {
    var t = pago + aberto, pp = t ? Math.round(pago / t * 100) : 0;
    return h('div', { class: 'pago-aberto', role: 'img', 'aria-label': 'Pago ' + brl(pago) + ' (' + pp + '%), em aberto ' + brl(aberto) },
      h('div', { class: 'pa-barra' }, h('i', { class: 'pa-pago', style: 'width:' + pp + '%' }), h('i', { class: 'pa-aberto', style: 'width:' + (t ? 100 - pp : 0) + '%' })),
      h('div', { class: 'pa-leg' }, h('span', { class: 'selo ok' }, I('pago'), 'Pago ' + brl(pago)), h('span', { class: 'selo aviso' }, I('relogio'), 'Em aberto ' + brl(aberto))));
  }

  /* ---------- minigráfico ---------- */
  function spark(vals, cor) {
    var W = 60, H = 18, mx = Math.max.apply(null, vals.concat([1])), mn = Math.min.apply(null, vals.concat([0])), n = vals.length;
    var pts = vals.map(function (v, i) { return (n > 1 ? i * (W - 2) / (n - 1) + 1 : W / 2) + ',' + (H - 2 - (v - mn) / ((mx - mn) || 1) * (H - 4)); }).join(' ');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'spark', 'aria-hidden': 'true' }); svg.appendChild(el('polyline', { points: pts, fill: 'none', stroke: cor || '#E20074', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); return svg;
  }

  PS.graf = { CORES: CORES, ICONES: ICONES, NOMES: NOMES, corDe: corDe, nomeCat: function (c) { return NOMES[c] || c; }, iconeCat: function (c) { return ICONES[c] || 'pontos'; }, donut: donut, barras: barras, anel: anel, pagoAberto: pagoAberto, spark: spark, contar: contar, tabelaAlt: tabelaAlt, reduzido: reduzido };
})(window);
