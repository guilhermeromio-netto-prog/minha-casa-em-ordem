/* Leitura de faturas de cartão a partir do TEXTO de um PDF (extraído no aparelho; o PDF nunca sai dele).
   Módulo puro (navegador e Node). ES5. Heurísticas por banco NÃO foram validadas com faturas reais: só com PDFs sintéticos (tools/gerar-pdfs-teste.py). */
(function (g) {
  'use strict';
  var MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  var CATS = ['mercado', 'restaurante', 'transporte', 'saude', 'educacao', 'lazer', 'assinaturas', 'casa', 'compras', 'viagens', 'outros'];

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function semAcento(s) { return String(s || '').normalize ? String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s || ''); }
  function norm(s) { return semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  /* ---------- dados sensíveis: nunca guardar número completo de cartão, CPF, CEP/endereço ---------- */
  function limpar(s) {
    s = String(s || '');
    s = s.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[cpf]').replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[cnpj]');
    s = s.replace(/(?:\d[ .\-*•x]?){12,18}\d/gi, function (m) { var d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 ? '•••• ' + d.slice(-4) : m; });
    s = s.replace(/\b\d{11}\b/g, '[nº]');
    return s;
  }
  /* para campos digitados: devolve motivo se houver número de cartão/CVV */
  function rejeitaSensivel(txt) {
    var s = String(txt || '');
    var d = s.replace(/[ .\-]/g, '');
    if (/\d{13,19}/.test(d) && !/[a-zA-Z]/.test(s.replace(/\d|[ .\-]/g, ''))) return 'Parece um número de cartão completo. Guarde só os 4 últimos dígitos.';
    if (/(?:\d[ .\-]?){13,19}/.test(s)) return 'Parece um número de cartão completo. Guarde só os 4 últimos dígitos.';
    if (/\b(cvv|cvc|csc|c[oó]d(?:igo)?\.? de seguran[cç]a|cod\.? seg)\b/i.test(s)) return 'Não guarde o código de segurança (CVV) do cartão.';
    return '';
  }

  /* ---------- valores e datas ---------- */
  var RE_VAL = /(?:R\$\s*)?([+-]?)\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(\s*-|\s*CR\b|\s*D\b)?/g;
  function valorBR(str) {
    var m = /([+-]?)\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(\s*-|\s*CR\b)?/i.exec(String(str || ''));
    if (!m) return null;
    var v = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
    if (m[1] === '-' || (m[3] && /-|CR/i.test(m[3]))) v = -v;
    return Math.round(v * 100) / 100;
  }
  function todosValores(s) {
    var out = [], m; RE_VAL.lastIndex = 0;
    while ((m = RE_VAL.exec(s))) { var v = parseFloat(m[2].replace(/\./g, '').replace(',', '.')); if (m[1] === '-' || (m[3] && /-|CR/i.test(m[3]))) v = -v; out.push({ v: Math.round(v * 100) / 100, i: m.index, f: m.index + m[0].length, txt: m[0] }); }
    return out;
  }
  function iso(y, m, d) { return y + '-' + p2(m) + '-' + p2(d); }
  function diaOk(y, m, d) { var dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; }
  function ano4(a) { a = +a; return a < 100 ? 2000 + a : a; }
  /* data com ano: dd/mm/aaaa, dd/mm/aa, dd MMM aaaa */
  function dataCompleta(s) {
    var m = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/.exec(s);
    if (m) { var y = ano4(m[3]); if (diaOk(y, +m[2], +m[1])) return iso(y, +m[2], +m[1]); }
    m = /\b(\d{1,2})\s+(?:de\s+)?([A-Za-zçÇ]{3})[A-Za-z]*\.?\s+(?:de\s+)?(\d{4})\b/.exec(semAcento(s));
    if (m && MESES[m[2].toLowerCase()]) { var y2 = +m[3]; if (diaOk(y2, MESES[m[2].toLowerCase()], +m[1])) return iso(y2, MESES[m[2].toLowerCase()], +m[1]); }
    return '';
  }
  function somaDiasIso(d, n) { var p = d.split('-'); var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return dt.getUTCFullYear() + '-' + p2(dt.getUTCMonth() + 1) + '-' + p2(dt.getUTCDate()); }
  /* data sem ano (dd/mm ou dd MMM): resolve o ano pela referência (vencimento/fechamento) */
  function resolveAno(dia, mes, ref) {
    var y = +ref.slice(0, 4), d = iso(y, mes, dia);
    if (!diaOk(y, mes, dia)) return '';
    if (d > somaDiasIso(ref, 31)) d = iso(y - 1, mes, dia);
    return diaOk(+d.slice(0, 4), mes, dia) ? d : '';
  }

  /* ---------- perfis por banco (heurísticas) ---------- */
  var BANCOS = [
    { id: 'nubank', nome: 'Nubank', det: /nubank|nu pagamentos/i, total: /(?:valor\s+)?(?:total\s+)?(?:da\s+)?fatura|total a pagar|pagamento total/i, venc: /vencimento|data de vencimento/i, fecha: /fechamento|fecha em/i },
    { id: 'itau', nome: 'Itaú', det: /ita[uú]|itaucard|ita[uú] unibanco/i, total: /total desta fatura|total da fatura|valor total/i, venc: /vencimento/i, fecha: /fechamento|melhor data/i },
    { id: 'bradesco', nome: 'Bradesco', det: /bradesco|bradescard/i, total: /total da fatura|total a pagar|valor total/i, venc: /vencimento/i, fecha: /fechamento|melhor data/i },
    { id: 'santander', nome: 'Santander', det: /santander/i, total: /total da fatura|total a pagar|saldo desta fatura|valor total/i, venc: /vencimento/i, fecha: /fechamento|melhor data/i },
    { id: 'bb', nome: 'Banco do Brasil', det: /banco do brasil|ourocard|\bBB\b/i, total: /total da fatura|total a pagar|valor total|saldo da fatura/i, venc: /vencimento/i, fecha: /fechamento|melhor data/i },
    { id: 'c6', nome: 'C6 Bank', det: /c6 bank|c6bank|\bC6\b/i, total: /total da fatura|valor total|total a pagar/i, venc: /vencimento/i, fecha: /fechamento/i },
    { id: 'inter', nome: 'Inter', det: /banco inter|inter\s*&?\s*co|\binter\b/i, total: /valor da fatura|total da fatura|total a pagar/i, venc: /vencimento/i, fecha: /fechamento/i },
    { id: 'caixa', nome: 'Caixa', det: /caixa econ[oô]mica|cart[aã]o caixa|\bcaixa\b/i, total: /total da fatura|valor total|total a pagar/i, venc: /vencimento/i, fecha: /fechamento|melhor data/i },
    { id: 'mercadopago', nome: 'Mercado Pago', det: /mercado\s*pago/i, total: /total da fatura|total a pagar|valor total/i, venc: /vencimento/i, fecha: /fechamento/i },
    { id: 'xp', nome: 'XP', det: /\bxp\b|xp investimentos|cart[aã]o xp/i, total: /total da fatura|total a pagar|valor total/i, venc: /vencimento/i, fecha: /fechamento/i }
  ];
  var GENERICO = { id: 'generico', nome: 'Genérico', total: /total (?:da|desta) fatura|total a pagar|valor total|valor da fatura|saldo da fatura|total geral/i, venc: /vencimento|vence em/i, fecha: /fechamento|fecha em/i };
  function detectarBanco(texto) { for (var i = 0; i < BANCOS.length; i++) if (BANCOS[i].det.test(texto)) return BANCOS[i]; return GENERICO; }

  /* ---------- itens do pdf.js -> linhas ---------- */
  function agruparLinhas(itens) {
    var cel = (itens || []).filter(function (it) { return it && typeof it.str === 'string' && it.str.replace(/\s/g, '') !== ''; }).map(function (it) {
      var t = it.transform || [1, 0, 0, 1, 0, 0]; return { s: it.str, x: t[4], y: t[5], w: it.width || 0, h: Math.abs(t[3]) || 8 };
    });
    cel.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var linhas = [], cur = null;
    cel.forEach(function (c) {
      if (cur && Math.abs(cur.y - c.y) <= Math.max(2, c.h * 0.4)) cur.c.push(c); else { cur = { y: c.y, c: [c] }; linhas.push(cur); }
    });
    return linhas.map(function (l) {
      l.c.sort(function (a, b) { return a.x - b.x; });
      var out = '', fim = null;
      l.c.forEach(function (c) { if (fim !== null) out += (c.x - fim > 1.5 ? ' ' : '') + (c.x - fim > 12 ? ' ' : ''); out += c.s; fim = c.x + c.w; });
      return out.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
  }

  /* ---------- categorização ---------- */
  function categorizar(desc, regrasUsuario, regrasPadrao) {
    var d = norm(desc), i, j, r;
    var us = regrasUsuario || [];
    for (i = 0; i < us.length; i++) if (us[i].termo && d.indexOf(norm(us[i].termo)) >= 0) return us[i].cat;
    var pd = regrasPadrao || {};
    for (j = 0; j < CATS.length; j++) { r = pd[CATS[j]] || []; for (i = 0; i < r.length; i++) if (d.indexOf(norm(r[i])) >= 0) return CATS[j]; }
    return 'outros';
  }

  /* ---------- parser principal ---------- */
  var RE_DATA_INI = /^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\s+(.*)$/;
  var RE_DATA_MES = /^(\d{1,2})\s+([A-Za-zÇç]{3})[A-Za-z]*\.?\s+(.*)$/;
  var RE_PAG = /pagamento (?:recebido|efetuado|em |on ?line|fatura)|pagto\.? (?:fatura|recebido)|pagamento de fatura|obrigado pelo pagamento|saldo (?:anterior|restante)/i;
  var RE_CRED = /estorno|cr[eé]dito|devolu[cç][aã]o|reembolso|cashback|desconto concedido/i;

  function extrairParcela(desc) {
    var m = /(?:parc(?:ela)?\.?\s*)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i.exec(desc) || /\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/.exec(desc) || /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(desc) || /\bparcela\s+(\d{1,2})\s+de\s+(\d{1,2})/i.exec(desc);
    if (!m) return { desc: desc, pa: 0, pt: 0 };
    var pa = +m[1], pt = +m[2];
    if (pt < 2 || pt > 60 || pa < 1 || pa > pt) return { desc: desc, pa: 0, pt: 0 };
    return { desc: desc.replace(m[0], ' ').replace(/\s+/g, ' ').replace(/[-–\s]+$/, '').trim(), pa: pa, pt: pt };
  }

  function analisar(linhasBrutas, opc) {
    opc = opc || {};
    var linhas = (linhasBrutas || []).map(function (l) { return limpar(l); }).filter(function (l) { return l.trim(); });
    var texto = linhas.join('\n'), banco = detectarBanco(texto);
    var res = { banco: banco.id, bancoNome: banco.nome, resumo: { total: null, vencimento: '', fechamento: '', final: '', periodo: '' }, lancs: [], ignoradas: [], avisos: [], confianca: 'baixa' };

    /* resumo */
    linhas.forEach(function (l, i) {
      var seg = l + (linhas[i + 1] ? ' ' + linhas[i + 1] : '');
      if (res.resumo.total == null && banco.total.test(l) && !/pagamento m[ií]nimo|m[ií]nimo/i.test(l)) { var vs = todosValores(l); if (!vs.length && linhas[i + 1]) vs = todosValores(linhas[i + 1]); if (vs.length) res.resumo.total = vs[vs.length - 1].v; }
      if (!res.resumo.vencimento && banco.venc.test(l)) { var d = dataCompleta(seg); if (d) res.resumo.vencimento = d; }
      if (!res.resumo.fechamento && banco.fecha.test(l)) { var f = dataCompleta(seg); if (f) res.resumo.fechamento = f; }
      if (!res.resumo.final) { var fm = /(?:final|cart[aã]o|\u2022{2,}|\*{2,}|x{2,})\D{0,12}(\d{4})\b/i.exec(l); if (fm) res.resumo.final = fm[1]; }
      if (!res.resumo.periodo) { var pm = /per[ií]odo[:\s]+(.{5,40})/i.exec(l); if (pm) res.resumo.periodo = pm[1].trim(); }
    });
    var ref = res.resumo.vencimento || res.resumo.fechamento || opc.hoje || '2000-01-01';

    /* lançamentos */
    linhas.forEach(function (l) {
      var m = RE_DATA_INI.exec(l), dia, mes, ano, resto, data = '';
      if (m) { dia = +m[1]; mes = +m[2]; ano = m[3]; resto = m[4]; }
      else {
        var mm = RE_DATA_MES.exec(semAcento(l));
        if (!mm || !MESES[mm[2].toLowerCase()]) return;
        dia = +mm[1]; mes = MESES[mm[2].toLowerCase()]; resto = l.slice(l.length - mm[3].length); ano = null;
      }
      if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return;
      data = ano ? (diaOk(ano4(ano), mes, dia) ? iso(ano4(ano), mes, dia) : '') : resolveAno(dia, mes, ref);
      if (!data) return;
      var vs = todosValores(resto);
      if (!vs.length) return;
      var v = vs[0];                                   /* 1ª coluna de valor (R$); a 2ª costuma ser US$ */
      var desc = resto.slice(0, v.i).replace(/R\$\s*$/, '').replace(/\s+/g, ' ').trim();
      if (!desc || desc.length < 2) { desc = resto.slice(v.f).replace(/\s+/g, ' ').trim(); }
      if (/^(total|subtotal|saldo|encargos|juros|iof)\b.*(fatura|anterior|desta|a pagar)/i.test(desc)) return;
      if (/total (da|desta) fatura|total a pagar|pagamento m[ií]nimo|limite|vencimento|fechamento/i.test(desc)) return;
      var pc = extrairParcela(desc);
      var valor = v.v;
      if (RE_CRED.test(pc.desc) && valor > 0) valor = -valor;
      var it = { data: data, desc: pc.desc.slice(0, 80), valor: valor, pa: pc.pa, pt: pc.pt, cat: categorizar(pc.desc, opc.regras, opc.regrasPadrao), bruto: l.slice(0, 120) };
      if (RE_PAG.test(pc.desc)) { it.motivo = 'pagamento da fatura anterior'; res.ignoradas.push(it); }
      else res.lancs.push(it);
    });

    /* confiança */
    var soma = Math.round(res.lancs.reduce(function (a, x) { return a + x.valor; }, 0) * 100) / 100;
    res.soma = soma;
    if (!res.lancs.length) { res.confianca = 'nenhuma'; res.avisos.push('Não encontrei lançamentos neste PDF.'); }
    else if (res.resumo.total != null && Math.abs(soma - res.resumo.total) <= 0.05) res.confianca = 'alta';
    else if (res.resumo.total != null && Math.abs(soma - res.resumo.total) <= Math.abs(res.resumo.total) * 0.1) { res.confianca = 'media'; res.avisos.push('A soma dos lançamentos (' + soma.toFixed(2).replace('.', ',') + ') difere do total da fatura. Confira antes de salvar.'); }
    else { res.confianca = 'baixa'; res.avisos.push(res.resumo.total == null ? 'Não achei o total da fatura. Confira os lançamentos.' : 'A soma dos lançamentos difere bastante do total da fatura. Revise as linhas.'); }
    if (!res.resumo.vencimento) res.avisos.push('Não achei o vencimento: informe na revisão.');
    if (res.lancs.length) { var ds = res.lancs.map(function (x) { return x.data; }).sort(); if (!res.resumo.periodo) res.resumo.periodo = ds[0].split('-').reverse().join('/') + ' a ' + ds[ds.length - 1].split('-').reverse().join('/'); }
    return res;
  }


  /* ---------- leitura do PDF com pdf.js (lib injetada: no navegador vem de js/vendor/pdfjs, nos testes do Node também) ---------- */
  function lerPdf(lib, bytes, pedirSenha) {
    var tarefa = lib.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
    tarefa.onPassword = function (atualiza, motivo) {
      if (!pedirSenha) { tarefa.destroy(); return; }
      Promise.resolve(pedirSenha(motivo === 2 ? 'errada' : 'precisa')).then(function (s) { if (s == null || s === '') { tarefa.destroy(); } else atualiza(s); });
    };
    return tarefa.promise.then(function (pdf) {
      var todas = [], chars = 0, n = Math.min(pdf.numPages, 30), seq = Promise.resolve(), i;
      function pag(k) { return pdf.getPage(k).then(function (p) { return p.getTextContent(); }).then(function (tc) { tc.items.forEach(function (it) { chars += (it.str || '').replace(/\s/g, '').length; }); return agruparLinhas(tc.items); }); }
      for (i = 1; i <= n; i++) (function (k) { seq = seq.then(function () { return pag(k); }).then(function (ls) { todas = todas.concat(ls); }); })(i);
      return seq.then(function () {
        try { pdf.destroy(); } catch (e) { /* ok */ }
        if (chars < 20) { var er = new Error('imagem'); er.tipo = 'imagem'; throw er; }
        return { linhas: todas, paginas: n };
      });
    }, function (e) {
      var er = new Error(e && e.message || 'pdf'); er.tipo = (e && (e.name === 'PasswordException' || e.name === 'PasswordException')) || (tarefa.destroyed) ? 'senha' : 'invalido';
      if (e && /destroyed|Worker was destroyed|Loading aborted/i.test(String(e.message || e))) er.tipo = 'senha';
      throw er;
    });
  }

  var API = { lerPdf: lerPdf, analisar: analisar, agruparLinhas: agruparLinhas, valorBR: valorBR, limpar: limpar, rejeitaSensivel: rejeitaSensivel, categorizar: categorizar, detectarBanco: detectarBanco, extrairParcela: extrairParcela, CATS: CATS, BANCOS: BANCOS, norm: norm, dataCompleta: dataCompleta };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else { g.PS = g.PS || {}; g.PS.fatura = API; }
})(typeof window !== 'undefined' ? window : this);
