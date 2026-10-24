/* Telas financeiras: "Atenção agora" (Hoje), painel de contas/faturas (Família): Em aberto · Pagas · Histórico, e avisos. ES5. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u, h = U.h, I = PS.icone, S = PS.store, F = PS.fin;
  var NIVEL = { vencida: ['perigo', 'alerta'], hoje: ['perigo', 'sino'], amanha: ['aviso', 'sino'], semana: ['neutro', 'calendario'] };
  var aba = 'abertas';

  function brl(v) { return v == null ? '' : U.valorBRL(v); }
  function seloNivel(p) { var n = NIVEL[p.nivel]; return h('span', { class: 'selo ' + n[0] }, I(n[1]), F.rotuloNivel(p.dias)); }
  function dataBR(d) { return d ? d.split('-').reverse().join('/') : ''; }

  /* ---------- Atenção agora (Hoje) ---------- */
  function atencao(s, hoje, max) {
    var pend = F.pendencias(s, hoje, 7), r = F.resumo(pend);
    var cab = h('h2', null, I(r.urgentes ? 'alerta' : 'check'), h('span', null, 'Atenção agora'),
      r.total ? h('span', { class: 'mais' }, (r.vencidas ? r.vencidas + (r.vencidas > 1 ? ' vencidas' : ' vencida') + ' · ' : '') + r.total + (r.total > 1 ? ' itens' : ' item')) : null);
    var corpo;
    if (!pend.length) {
      corpo = h('p', { class: 'tudo-em-dia' }, I('check'), h('span', null, 'Tudo em dia', h('small', null, 'Nenhuma conta, fatura ou lembrete vencendo nos próximos 7 dias.')));
    } else {
      var mostra = pend.slice(0, max || 4);
      corpo = h('div', { class: 'atencao-lista' }, mostra.map(function (p) {
        return h('a', { class: 'atencao-item ' + p.nivel, href: p.href, 'data-fid': 'at:' + p.tipo + p.id + p.chave },
          I(p.icone), h('span', { class: 't' }, p.titulo, h('small', null, dataBR(p.data).slice(0, 5) + (p.valor != null && p.tipo !== 'lembrete' ? ' · ' + brl(p.valor) : ''))), seloNivel(p));
      }));
      if (pend.length > mostra.length) corpo.appendChild(h('a', { class: 'atencao-mais', href: '#/familia', 'data-fid': 'at:mais' }, '+' + (pend.length - mostra.length) + ' em Família'));
    }
    return h('section', { class: 'cartao atencao' + (r.urgentes ? ' urgente' : ''), 'aria-live': 'polite' }, cab, corpo);
  }

  /* ---------- marcar paga (manual; nunca implica pagamento real) ---------- */
  function marcar(p) {
    var inp = h('input', { type: 'date', value: U.hoje(), max: U.somaDias(U.hoje(), 1), 'data-fid': 'mp:data', 'aria-label': 'Data do pagamento' });
    PS.modal.abrir('Marcar como paga?', h('div', null,
      h('p', null, p.titulo + (p.valor != null ? ' · ' + brl(p.valor) : '') + ' · vence ' + dataBR(p.data)),
      h('label', { class: 'campo' }, h('span', null, 'Data em que você pagou'), inp),
      h('p', { class: 'nota' }, 'Isto só registra no painel. Não paga nada e não consulta o banco.')),
    [{ rotulo: 'Marcar como paga', acao: function () {
      S.alterar(function (st) { F.marcarPaga(st, p.tipo, p.id, p.chave, inp.value); });
      PS.aviso('Marcada como paga em ' + dataBR(inp.value));
    } }, { rotulo: 'Cancelar' }]);
  }
  function desfazer(p) {
    S.alterar(function (st) { F.desfazerPaga(st, p.tipo, p.id, p.chave); });
    PS.aviso('Desfeito: voltou para "Em aberto"');
  }

  /* ---------- linha de conta/fatura ---------- */
  function linha(p, paga) {
    var sel = paga ? h('span', { class: 'selo ok' }, I('check'), 'Paga' + (p.pagaEm ? ' em ' + dataBR(p.pagaEm).slice(0, 5) : '')) : seloNivel(p);
    return h('div', { class: 'conta-linha' + (paga ? ' feito' : '') },
      h('span', { class: 'cl-info' }, I(p.icone), h('span', { class: 't' }, p.titulo, h('small', null, (paga ? 'Venceu ' : 'Vence ') + dataBR(p.data).slice(0, 5) + (p.valor != null ? ' · ' + brl(p.valor) : '')))),
      sel,
      paga ? h('button', { class: 'btn peq', type: 'button', 'data-fid': 'dz:' + p.tipo + p.id + p.chave, onclick: function () { desfazer(p); } }, I('desfazer'), 'Desfazer')
        : h('button', { class: 'btn peq primario', type: 'button', 'data-fid': 'mp:' + p.tipo + p.id + p.chave, onclick: function () { marcar(p); } }, I('check'), 'Marcar paga'));
  }

  /* ---------- histórico (SVG inline) ---------- */
  var MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function mesRot(m) { return MES_CURTO[+m.slice(5) - 1] + '/' + m.slice(2, 4); }
  function barras(meses) {
    var max = 1; meses.forEach(function (m) { if (m.total > max) max = m.total; });
    var W = 300, H = 110, bw = W / meses.length, ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (H + 18)); svg.setAttribute('class', 'graf-barras'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Gasto por mês: ' + meses.map(function (m) { return mesRot(m.mes) + ' ' + brl(m.total); }).join('; '));
    meses.forEach(function (m, i) {
      var hh = Math.max(m.total > 0 ? 3 : 0, Math.round(m.total / max * (H - 14))), x = i * bw + bw * .2, w = bw * .6;
      var rc = document.createElementNS(ns, 'rect'); rc.setAttribute('x', x); rc.setAttribute('y', H - hh); rc.setAttribute('width', w); rc.setAttribute('height', hh); rc.setAttribute('rx', 3);
      rc.setAttribute('class', i === meses.length - 1 ? 'b-atual' : 'b-ant'); svg.appendChild(rc);
      var t = document.createElementNS(ns, 'text'); t.setAttribute('x', x + w / 2); t.setAttribute('y', H + 13); t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'b-rot'); t.textContent = mesRot(m.mes); svg.appendChild(t);
    });
    return svg;
  }
  function deltaTxt(c) {
    if (!c) return h('span', { class: 'delta neutro' }, '—');
    var ic = c.dir === 'subiu' ? 'subiu' : c.dir === 'caiu' ? 'caiu' : 'igual';
    var txt = c.dir === 'igual' ? 'igual' : (c.dir === 'subiu' ? 'subiu ' : 'caiu ') + brl(Math.abs(c.dv)) + (c.pct != null ? ' (' + Math.abs(c.pct).toString().replace('.', ',') + '%)' : '');
    return h('span', { class: 'delta ' + c.dir }, I(ic), txt);
  }
  var NOME_CAT = { mercado: 'Mercado', restaurante: 'Restaurantes/delivery', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', lazer: 'Lazer/streaming', assinaturas: 'Assinaturas', casa: 'Casa/contas', compras: 'Compras', viagens: 'Viagens', outros: 'Outros' };
  PS.nomeCat = function (c) { return NOME_CAT[c] || c; };
  function historico(s, hoje) {
    var H = F.historico(s, hoje, 6), ms = H.meses.filter(function (m) { return m.temDados || true; });
    var tem = ms.some(function (m) { return m.total > 0; });
    if (!tem) return h('p', { class: 'vazio' }, 'Ainda sem valores nos meses. Cadastre o valor das contas em Gerenciar → Família e marque como paga; as faturas entram em Cartões.');
    var linhas = ms.slice().reverse().map(function (m) {
      return h('tr', null, h('th', { scope: 'row' }, mesRot(m.mes)), h('td', null, brl(m.contas)), h('td', null, brl(m.faturas)), h('td', null, h('strong', null, brl(m.total))), h('td', null, deltaTxt(m.vs)));
    });
    var cats = H.porCategoria.filter(function (c) { return c.atual || c.anterior; }).slice(0, 6).map(function (c) {
      return h('tr', null, h('th', { scope: 'row' }, NOME_CAT[c.cat] || c.cat), h('td', null, brl(c.anterior)), h('td', null, brl(c.atual)), h('td', null, deltaTxt(c)));
    });
    var catsAtual = H.porCategoria.filter(function (c) { return c.atual > 0; }).map(function (c) { return { id: c.cat, rotulo: NOME_CAT[c.cat] || c.cat, valor: c.atual, cor: PS.graf.corDe(c.cat), icone: PS.graf.iconeCat(c.cat) }; });
    return h('div', { class: 'hist' }, PS.graf.barras(ms.map(function (m) { return { mes: m.mes, total: m.total, vs: m.vs }; }), { titulo: 'Gasto por mês (contas + faturas)' }),
      catsAtual.length ? h('div', null, h('h3', null, 'Este mês por categoria'), PS.graf.donut(catsAtual, { titulo: 'Este mês por categoria', centro: 'No mês' })) : null,
      h('table', { class: 'tab-hist' }, h('caption', null, 'Mês a mês (contas de casa + faturas)'), h('thead', null, h('tr', null, ['Mês', 'Contas', 'Faturas', 'Total', 'vs. mês anterior'].map(function (x) { return h('th', { scope: 'col' }, x); }))), h('tbody', null, linhas)),
      cats.length ? h('table', { class: 'tab-hist' }, h('caption', null, 'Por categoria: mês passado → este mês'), h('thead', null, h('tr', null, ['Categoria', 'Anterior', 'Atual', 'Variação'].map(function (x) { return h('th', { scope: 'col' }, x); }))), h('tbody', null, cats)) : null);
  }

  /* ---------- avisos / calendário ---------- */
  function painelAvisos(s) {
    var L = PS.lembretes, sup = L ? L.suporte() : {}, c = s.config;
    var ligado = L && L.ativo();
    var botoes = [];
    botoes.push(h('button', { class: 'btn', type: 'button', 'data-fid': 'av:ics', onclick: function () {
      var ics = F.icsDasPendencias(S.get(), U.hoje(), S.get().config.antecedencia, new Date().toISOString());
      PS.arq.baixar('contas-painel-da-sala.ics', ics, 'text/calendar'); PS.aviso('Arquivo .ics baixado: abra no calendário do celular');
    } }, I('baixar'), 'Adicionar ao calendário (.ics)'));
    if (sup.notif) botoes.push(h('button', { class: 'btn' + (ligado ? '' : ' primario'), type: 'button', 'data-fid': 'av:notif', onclick: function () {
      if (ligado) { L.desativar(); PS.aviso('Avisos neste aparelho desligados'); PS.redesenhar(); } else L.ativar().then(function (r) { PS.aviso(r.msg); PS.redesenhar(); });
    } }, I('sino'), ligado ? 'Desligar avisos neste aparelho' : 'Ativar avisos neste aparelho'));
    var antec = [7, 3, 2, 1, 0].map(function (d) {
      var on = c.antecedencia.indexOf(d) >= 0;
      return h('button', { class: 'btn peq' + (on ? ' ativo' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', 'data-fid': 'av:a' + d, onclick: function () {
        S.alterar(function (st) { var l = st.config.antecedencia.slice(); var i = l.indexOf(d); if (i >= 0) { if (l.length > 1) l.splice(i, 1); } else l.push(d); st.config.antecedencia = l.sort(function (a, b) { return b - a; }); });
      } }, (on ? '✓ ' : '') + (d === 0 ? 'no dia' : d + (d === 1 ? ' dia antes' : ' dias antes')));
    });
    return h('div', { class: 'avisos' }, h('h3', null, 'Lembretes de vencimento'),
      h('p', { class: 'nota' }, 'Avisar com antecedência: '), h('div', { class: 'acoes' }, antec),
      h('div', { class: 'acoes' }, botoes),
      h('p', { class: 'nota' }, L ? L.textoHonesto() : ''));
  }

  function totais(s, hoje) {
    var t = F.totaisDoMes(s, hoje);
    return h('div', { class: 'totais-wrap' }, PS.graf.pagoAberto(t.pago, t.aPagar), h('div', { class: 'totais-mes', 'aria-label': 'Totais do mês' },
      h('div', null, h('small', null, 'A pagar neste mês'), h('strong', null, brl(t.aPagar))),
      h('div', { class: 'pago' }, h('small', null, 'Já pago'), h('strong', null, brl(t.pago))),
      h('div', null, h('small', null, 'Contas'), h('strong', null, t.nPagas + '/' + t.n))));
  }

  function painel(s, hoje) {
    var lst = F.listas(s, hoje);
    var nA = lst.abertas.length, nP = lst.pagas.length;
    var abas = [['abertas', 'Em aberto', nA], ['pagas', 'Pagas', nP], ['hist', 'Histórico', null]].map(function (a) {
      return h('button', { class: 'aba', type: 'button', role: 'tab', 'aria-selected': aba === a[0] ? 'true' : 'false', 'data-fid': 'fa:' + a[0], onclick: function () { aba = a[0]; PS.redesenhar(); } }, a[1], a[2] != null ? h('small', null, a[2]) : null);
    });
    var corpo;
    if (aba === 'abertas') corpo = [totais(s, hoje), nA ? lst.abertas.map(function (p) { return linha(p, false); }) : h('p', { class: 'vazio' }, 'Nada em aberto. Tudo em dia!'), painelAvisos(s)];
    else if (aba === 'pagas') corpo = nP ? lst.pagas.slice(0, 40).map(function (p) { return linha(p, true); }) : h('p', { class: 'vazio' }, 'Nenhuma conta marcada como paga ainda.');
    else corpo = historico(s, hoje);
    return h('section', { class: 'cartao' }, h('h2', null, I('carteira'), h('span', null, 'Contas e faturas')), h('div', { class: 'abas', role: 'tablist' }, abas), corpo);
  }

  PS.finUI = { atencao: atencao, painel: painel, historico: historico, marcar: marcar };
})(window);
