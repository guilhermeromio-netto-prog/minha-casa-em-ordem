/* Minha Casa em Ordem — domínio financeiro PURO (sem DOM): pendências ("Atenção agora"), pago/em aberto, histórico, lembretes e .ics.
   Contas de casa e faturas do cartão. Nada é marcado como pago automaticamente: só por ação manual (com data).
   Testado em Node: node tools/teste-financeiro.js */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u;
  var F = {};

  /* ---------- ocorrências ---------- */
  function valorDe(c, m) { return (c.valores && c.valores[m] != null) ? c.valores[m] : c.valor; }
  /* Conta mensal: nasce em `desde` (conta nova) ou no mês atual (conta antiga). O mês seguinte aparece sempre como "aberto". */
  function ocorrenciasConta(c, hoje) {
    if (!c.mensal) return c.data ? [{ conta: c, data: c.data, chave: 'avulsa', paga: !!c.paga, pagaEm: c.pagaEm || '', valor: c.valor }] : [];
    var m0 = U.ym(hoje), out = [], ini = U.somaMes(m0, -2);
    for (var i = -2; i <= 1; i++) {
      var m = U.somaMes(m0, i), paga = !!(c.pagas && c.pagas[m]);
      var existe = i >= 0 || paga || (c.desde && c.desde <= m);
      if (!existe) continue;
      if (c.desde && m < c.desde && !paga) continue;
      out.push({ conta: c, data: U.dataNoMes(m, c.dia), chave: m, paga: paga, pagaEm: typeof (c.pagas || {})[m] === 'string' ? c.pagas[m] : '', valor: valorDe(c, m) });
    }
    return out;
  }
  F.ocorrenciasConta = ocorrenciasConta;

  function nivelDe(dias) { return dias < 0 ? 'vencida' : dias === 0 ? 'hoje' : dias === 1 ? 'amanha' : 'semana'; }
  F.nivelDe = nivelDe;
  F.rotuloNivel = function (dias) {
    if (dias < 0) return dias === -1 ? 'Venceu ontem' : 'Venceu há ' + (-dias) + ' dias';
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    return 'Vence em ' + dias + ' dias';
  };

  /* Tudo que pede atenção, em ordem de urgência: vencidas (mais antigas primeiro) → hoje → amanhã → próximos dias.
     Pagas/feitas NUNCA aparecem. janela = quantos dias à frente. */
  F.pendencias = function (s, hoje, janela) {
    janela = janela == null ? 7 : janela;
    var out = [], lim = U.somaDias(hoje, janela);
    function add(o) { o.dias = U.difDias(o.data, hoje); o.nivel = nivelDe(o.dias); out.push(o); }
    (s.contas || []).forEach(function (c) {
      ocorrenciasConta(c, hoje).forEach(function (o) {
        if (o.paga || o.data > lim) return;
        if (U.difDias(o.data, hoje) < -62) return;                        /* não arrasta lixo antigo para sempre */
        add({ tipo: 'conta', id: c.id, chave: o.chave, titulo: c.titulo, icone: c.icone || 'carteira', data: o.data, valor: o.valor, dono: c.dono, href: '#/familia' });
      });
    });
    (s.faturas || []).forEach(function (f) {
      if (f.status === 'paga' || !f.vencimento || f.teste) return;
      if (f.vencimento > lim || U.difDias(f.vencimento, hoje) < -62) return;
      var ct = (s.cartoes || []).filter(function (x) { return x.id === f.cartao || x.apelido === f.cartao; })[0];
      add({ tipo: 'fatura', id: f.id, chave: f.mes || '', titulo: 'Fatura ' + (ct ? ct.apelido : (f.cartao || 'do cartão')), icone: 'cartao', data: f.vencimento, valor: f.valor, dono: f.dono || (ct && ct.dono) || '', href: '#/cartoes' });
    });
    (s.lembretes || []).forEach(function (l) {
      if (!l.dia) return;
      var m0 = U.ym(hoje);
      [0, 1].forEach(function (i) {
        var m = U.somaMes(m0, i), d = U.dataNoMes(m, l.dia), feito = !!(l.feitos && l.feitos[m]);
        if (feito || d > lim) return;
        if (d < hoje && U.ym(d) !== m0) return;
        add({ tipo: 'lembrete', id: l.id, chave: m, titulo: l.titulo, icone: l.icone || 'sino', data: d, valor: null, obs: l.obs, href: '#/familia' });
      });
    });
    var peso = { fatura: 0, conta: 1, lembrete: 2 };
    out.sort(function (a, b) { return a.dias - b.dias || peso[a.tipo] - peso[b.tipo] || (a.titulo < b.titulo ? -1 : 1); });
    return out;
  };

  /* contadores para badge/rodapé */
  F.resumo = function (pend) {
    var r = { vencidas: 0, hoje: 0, amanha: 0, semana: 0, total: pend.length, valor: 0 };
    pend.forEach(function (p) { r[p.nivel === 'vencida' ? 'vencidas' : p.nivel === 'hoje' ? 'hoje' : p.nivel === 'amanha' ? 'amanha' : 'semana']++; if (p.valor != null && p.tipo !== 'lembrete') r.valor += p.valor; });
    r.urgentes = r.vencidas + r.hoje;
    return r;
  };

  /* ---------- pago / em aberto (manual) ---------- */
  function achar(s, tipo, id) { var l = tipo === 'fatura' ? s.faturas : tipo === 'lembrete' ? s.lembretes : s.contas; return (l || []).filter(function (x) { return x.id === id; })[0]; }
  F.marcarPaga = function (s, tipo, id, chave, data) {
    var x = achar(s, tipo, id); if (!x) return false;
    data = U.dataValida(data) ? data : U.hoje();
    if (tipo === 'fatura') { x.status = 'paga'; x.pagaEm = data; return true; }
    if (tipo === 'lembrete') { x.feitos = x.feitos || {}; x.feitos[chave] = true; if (!x.dia) x.feito = true; return true; }
    if (!x.mensal || chave === 'avulsa') { x.paga = true; x.pagaEm = data; return true; }
    x.pagas = x.pagas || {}; x.pagas[chave] = data;
    x.valores = x.valores || {}; if (x.valor != null && x.valores[chave] == null) x.valores[chave] = x.valor;   /* guarda o valor pago neste mês (histórico) */
    return true;
  };
  F.desfazerPaga = function (s, tipo, id, chave) {
    var x = achar(s, tipo, id); if (!x) return false;
    if (tipo === 'fatura') { x.status = 'aberta'; x.pagaEm = ''; return true; }
    if (tipo === 'lembrete') { if (x.feitos) delete x.feitos[chave]; x.feito = false; return true; }
    if (!x.mensal || chave === 'avulsa') { x.paga = false; x.pagaEm = ''; return true; }
    if (x.pagas) delete x.pagas[chave];
    return true;
  };

  /* listas "Em aberto" e "Pagas" (contas + faturas) */
  F.listas = function (s, hoje) {
    var abertas = [], pagas = [];
    (s.contas || []).forEach(function (c) {
      ocorrenciasConta(c, hoje).forEach(function (o) {
        var it = { tipo: 'conta', id: c.id, chave: o.chave, titulo: c.titulo, icone: c.icone || 'carteira', data: o.data, valor: o.valor, dono: c.dono, pagaEm: o.pagaEm, dias: U.difDias(o.data, hoje) };
        (o.paga ? pagas : abertas).push(it);
      });
    });
    (s.faturas || []).forEach(function (f) {
      if (f.teste || !f.vencimento) return;
      var ct = (s.cartoes || []).filter(function (x) { return x.id === f.cartao || x.apelido === f.cartao; })[0];
      var it = { tipo: 'fatura', id: f.id, chave: f.mes || '', titulo: 'Fatura ' + (ct ? ct.apelido : (f.cartao || 'do cartão')), icone: 'cartao', data: f.vencimento, valor: f.valor, dono: f.dono, pagaEm: f.pagaEm || '', dias: U.difDias(f.vencimento, hoje) };
      (f.status === 'paga' ? pagas : abertas).push(it);
    });
    abertas.forEach(function (x) { x.nivel = nivelDe(x.dias); });
    abertas.sort(function (a, b) { return a.dias - b.dias; });
    pagas.sort(function (a, b) { return (b.pagaEm || b.data) < (a.pagaEm || a.data) ? -1 : 1; });
    return { abertas: abertas, pagas: pagas };
  };

  /* ---------- histórico mensal e comparação ---------- */
  function dir(dv) { return dv > 0.005 ? 'subiu' : dv < -0.005 ? 'caiu' : 'igual'; }
  F.comparar = function (atual, anterior) {
    var dv = (atual || 0) - (anterior || 0);
    return { dv: Math.round(dv * 100) / 100, pct: anterior > 0 ? Math.round(dv / anterior * 1000) / 10 : null, dir: dir(dv) };
  };
  F.rotuloDir = function (c) { return c.dir === 'subiu' ? 'subiu' : c.dir === 'caiu' ? 'caiu' : 'igual'; };
  F.historico = function (s, hoje, n) {
    n = n || 6;
    var m0 = U.ym(hoje), meses = [], i, idx = {};
    for (i = n - 1; i >= 0; i--) { var m = U.somaMes(m0, -i); idx[m] = { mes: m, contas: 0, faturas: 0, total: 0, cats: {}, temDados: false }; meses.push(idx[m]); }
    function soma(m, cat, v, campo) { var e = idx[m]; if (!e || v == null || !isFinite(v)) return; e[campo] += v; e.total += v; e.cats[cat] = (e.cats[cat] || 0) + v; e.temDados = true; }
    (s.contas || []).forEach(function (c) {
      if (!c.mensal) { if (c.data) soma(U.ym(c.data), c.cat || 'casa', c.valor, 'contas'); return; }
      meses.forEach(function (e) {
        var m = e.mes, paga = !!(c.pagas && c.pagas[m]), tem = paga || (c.valores && c.valores[m] != null) || m >= m0 || (c.desde && c.desde <= m);
        if (tem) soma(m, c.cat || 'casa', valorDe(c, m), 'contas');
      });
    });
    var lancsPor = {};
    (s.lancs || []).forEach(function (l) { (lancsPor[l.fatura] = lancsPor[l.fatura] || []).push(l); });
    (s.faturas || []).forEach(function (f) {
      if (f.teste) return;
      var m = f.mes || (f.vencimento ? U.ym(f.vencimento) : ''); if (!idx[m]) return;
      var ls = lancsPor[f.id] || [];
      if (ls.length) { var t = 0; ls.forEach(function (l) { if (l.valor > 0) { soma(m, l.cat, l.valor, 'faturas'); t += l.valor; } }); }
      else soma(m, 'outros', f.valor, 'faturas');
    });
    meses.forEach(function (e, k) { e.vs = k > 0 ? F.comparar(e.total, meses[k - 1].total) : null; e.vsContas = k > 0 ? F.comparar(e.contas, meses[k - 1].contas) : null; e.vsFaturas = k > 0 ? F.comparar(e.faturas, meses[k - 1].faturas) : null; });
    var atual = meses[meses.length - 1], ant = meses[meses.length - 2], porCat = [];
    if (atual && ant) {
      var cs = {}; Object.keys(atual.cats).concat(Object.keys(ant.cats)).forEach(function (k) { cs[k] = 1; });
      Object.keys(cs).forEach(function (k) { var c = F.comparar(atual.cats[k] || 0, ant.cats[k] || 0); c.cat = k; c.atual = atual.cats[k] || 0; c.anterior = ant.cats[k] || 0; porCat.push(c); });
      porCat.sort(function (a, b) { return Math.abs(b.dv) - Math.abs(a.dv); });
    }
    return { meses: meses, porCategoria: porCat };
  };

  /* total do mês corrente em Família: a pagar / pago */
  F.totaisDoMes = function (s, hoje) {
    var m = U.ym(hoje), r = { aPagar: 0, pago: 0, n: 0, nPagas: 0 };
    (s.contas || []).forEach(function (c) {
      ocorrenciasConta(c, hoje).forEach(function (o) {
        if (U.ym(o.data) !== m || o.valor == null) return;
        r.n++; if (o.paga) { r.pago += o.valor; r.nPagas++; } else r.aPagar += o.valor;
      });
    });
    return r;
  };

  /* ---------- lembretes (notificações) — puro, com relógio injetável ---------- */
  /* antecedencia: ex. [3,1,0] = avisa 3 dias antes, 1 dia antes e no dia; vencidas: 1 aviso por dia. enviados: mapa chave→true */
  F.lembretesPara = function (s, hoje, antecedencia, enviados, hora) {
    enviados = enviados || {};
    if (hora != null && hora < 8) return [];                              /* nada de aviso de madrugada */
    var ant = antecedencia && antecedencia.length ? antecedencia : [3, 1, 0], max = Math.max.apply(null, ant), out = [];
    F.pendencias(s, hoje, max).forEach(function (p) {
      if (p.tipo === 'lembrete' && p.dias !== 0) return;
      var chave, corpo = F.rotuloNivel(p.dias) + (p.valor != null && p.tipo !== 'lembrete' ? ' · ' + U.valorBRL(p.valor) : '');
      if (p.dias < 0) chave = p.tipo + ':' + p.id + ':' + p.chave + ':atraso:' + hoje;
      else if (ant.indexOf(p.dias) >= 0) chave = p.tipo + ':' + p.id + ':' + p.chave + ':d' + p.dias;
      else return;
      if (enviados[chave]) return;
      out.push({ chave: chave, titulo: (p.dias < 0 ? 'Atrasada: ' : p.tipo === 'fatura' ? '' : '') + p.titulo, corpo: corpo, dias: p.dias, tipo: p.tipo, href: p.href });
    });
    return out;
  };
  F.podarEnviados = function (enviados, hoje) {      /* guarda só ~45 dias */
    var r = {}; Object.keys(enviados || {}).forEach(function (k) { if (enviados[k] >= U.somaDias(hoje, -45)) r[k] = enviados[k]; }); return r;
  };

  /* ---------- .ics (calendário) ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function dobrar(l) {                 /* RFC 5545: linhas ≤ 75 octetos, continuação com espaço; aqui por caracteres (seguro) */
    var out = [], b = 0, cur = '';
    for (var i = 0; i < l.length; i++) { var ch = l.charAt(i), n = unescape(encodeURIComponent(ch)).length; if (b + n > 73) { out.push(cur); cur = ' '; b = 1; } cur += ch; b += n; }
    out.push(cur); return out.join('\r\n');
  }
  function dataIcs(iso) { return iso.replace(/-/g, ''); }
  /* itens: [{uid, titulo, data 'AAAA-MM-DD', descricao, alarmes:[dias antes]}]; evento de dia inteiro + VALARM por antecedência (09:00 do dia do alarme) */
  F.gerarIcs = function (itens, agoraIso) {
    var carimbo = (agoraIso || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Minha Casa em Ordem//byGui//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Minha Casa em Ordem · contas'];
    itens.forEach(function (it) {
      if (!U.dataValida(it.data)) return;
      L.push('BEGIN:VEVENT', 'UID:' + String(it.uid).replace(/[^A-Za-z0-9_.@-]/g, '') + '@minha-casa-em-ordem', 'DTSTAMP:' + carimbo, 'DTSTART;VALUE=DATE:' + dataIcs(it.data), 'DTEND;VALUE=DATE:' + dataIcs(U.somaDias(it.data, 1)),
        'SUMMARY:' + esc(it.titulo), 'DESCRIPTION:' + esc(it.descricao || 'Lembrete do Minha Casa em Ordem. Confira no app do banco; este lembrete não confirma pagamento.'), 'TRANSP:TRANSPARENT');
      (it.alarmes && it.alarmes.length ? it.alarmes : [3, 1, 0]).forEach(function (d) {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(it.titulo), 'TRIGGER:' + (d === 0 ? 'PT9H' : '-P' + (d - 1) + 'DT15H'), 'END:VALARM');
      });
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(dobrar).join('\r\n') + '\r\n';
  };
  /* .ics com as pendências atuais (contas + faturas, não pagas) */
  F.icsDasPendencias = function (s, hoje, antecedencia, agoraIso) {
    var itens = F.pendencias(s, hoje, 60).filter(function (p) { return p.tipo !== 'lembrete' && p.dias >= 0; }).map(function (p) {
      return { uid: p.tipo + '-' + p.id + '-' + p.chave, titulo: p.titulo + (p.valor != null ? ' (' + U.valorBRL(p.valor) + ')' : ''), data: p.data, alarmes: antecedencia, descricao: 'Vencimento: ' + p.data.split('-').reverse().join('/') + '. Pagar pelo app do banco. Este lembrete não confirma pagamento.' };
    });
    return F.gerarIcs(itens, agoraIso);
  };

  /* ---------- agenda local para o service worker (sem texto de valores sensíveis além do título) ---------- */
  F.agendaParaSW = function (s, hoje, antecedencia) {
    var ant = antecedencia && antecedencia.length ? antecedencia : [3, 1, 0], out = [];
    F.pendencias(s, U.somaDias(hoje, 0), Math.max.apply(null, ant) + 45).forEach(function (p) {
      if (p.tipo === 'lembrete') return;
      ant.forEach(function (a) { out.push({ chave: p.tipo + ':' + p.id + ':' + p.chave + ':d' + a, avisar: U.somaDias(p.data, -a), titulo: p.titulo, corpo: F.rotuloNivel(a) }); });
    });
    return out;
  };

  PS.fin = F;
  if (typeof module === 'object' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : global);
