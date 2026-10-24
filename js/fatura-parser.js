/* Leitura de faturas de cartão a partir do TEXTO de um PDF (extraído no aparelho; o PDF nunca sai dele).
   Módulo puro (navegador e Node). ES5. Heurísticas por banco NÃO foram validadas com faturas reais: só com PDFs sintéticos (tools/gerar-pdfs-teste.py). */
(function (g) {
  'use strict';
  var MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  var CATS = ['mercado', 'restaurante', 'transporte', 'saude', 'educacao', 'lazer', 'assinaturas', 'casa', 'compras', 'viagens', 'encargos', 'outros'];

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
    if (opc.itens && ehItauColunas(opc.itens)) return analisarItauColunas(opc.itens, opc);       /* Itaú em duas colunas: usa posição x/y dos itens do pdf.js */
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


  /* ---------- Itaú: fatura em DUAS COLUNAS (layout real) ----------
     O PDF do Itaú traz o texto com espaços quebrados no meio das palavras ("6.71 2,5 3", "04/ 08", "ATA CA DAO") e os lançamentos em duas colunas
     por página (esquerda: parcelas antigas; direita: compras recentes). Por isso aqui se trabalha com os ITENS do pdf.js (posição x/y), não com linhas
     de texto: separa as colunas, junta os pedaços de cada valor/data e lê categoria e cidade que o banco imprime sob cada lançamento. */
  function sd(s) { return semAcento(s).toLowerCase().replace(/\s+/g, ''); }              /* sem espaços e acentos: compara texto com espaços quebrados */
  function dinheiro(s) {                                                                 /* "R$ 1.23 4,5 6" -> 1234.56; "-2.345 ,67" -> -2345.67; senão null */
    var t = String(s || '').replace(/\s+/g, ''), m = /^([-+]?)(?:R\$)?([-+]?)((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(-|CR)?$/i.exec(t);
    if (!m) return null;
    var v = parseFloat(m[3].replace(/\./g, '').replace(',', '.'));
    return r2((m[1] === '-' || m[2] === '-' || m[4]) ? -v : v);
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function dataCurta(s) { var m = /^(\d{2})\/(\d{2})$/.exec(String(s || '').replace(/\s+/g, '')); return m ? { d: +m[1], m: +m[2] } : null; }
  function dataLonga(s) { var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || '').replace(/\s+/g, '')); return m && diaOk(+m[3], +m[2], +m[1]) ? iso(+m[3], +m[2], +m[1]) : ''; }

  /* categorias que o Itaú imprime sob o lançamento (sem acento, sem espaço) -> categoria do app */
  var CAT_BANCO = { supermercado: 'mercado', restaurante: 'restaurante', alimentacao: 'restaurante', transporte: 'transporte', automotivo: 'transporte', combustivel: 'transporte', saude: 'saude', farmacia: 'saude',
    educacao: 'educacao', viagem: 'viagens', turismo: 'viagens', hotel: 'viagens', casa: 'casa', vestuario: 'compras', eletronicos: 'compras', beleza: 'compras', lazer: 'lazer', diversao: 'lazer', servicos: 'outros', outros: 'outros' };
  var ROTULO_BANCO = { supermercado: 'supermercado', restaurante: 'restaurante', alimentacao: 'alimentação', transporte: 'transporte', automotivo: 'automotivo', combustivel: 'combustível', saude: 'saúde', farmacia: 'farmácia', educacao: 'educação',
    viagem: 'viagem', turismo: 'turismo', hotel: 'hotel', casa: 'casa', vestuario: 'vestuário', eletronicos: 'eletrônicos', beleza: 'beleza', lazer: 'lazer', diversao: 'diversão', servicos: 'serviços', outros: 'outros' };
  var CAT_BANCO_CHAVES = Object.keys(CAT_BANCO).sort(function (a, b) { return b.length - a.length; });
  function cidadeBonita(c) {
    c = String(c || '').toUpperCase().replace(/[^A-Z]/g, '');
    c = c.replace(/^(SAO|SANTO|SANTA|RIO|PONTA|PORTO|BELO|FOZ|CAMPO|MOGI|NOVA|VILA)(?=[A-Z]{3})/, '$1 ');
    c = c.replace(/^RIO ?(DE|DO|DA)(?=[A-Z])/, 'RIO $1 ');
    return c.toLowerCase().replace(/(^| )([a-z])/g, function (x, a, b) { return a + b.toUpperCase(); }).replace(/ De /g, ' de ').slice(0, 30);
  }
  /* "ve st uário DIADEMA" -> { cat: 'vestuario', cidade: 'Diadema' } */
  function lerCategoriaCidade(raw) {
    var d = sd(raw), i, k;
    for (i = 0; i < CAT_BANCO_CHAVES.length; i++) {
      k = CAT_BANCO_CHAVES[i];
      if (d.indexOf(k) === 0) {
        var resto = '', n = 0, orig = String(raw || '');                                   /* resto do texto ORIGINAL depois de k.length letras */
        for (var j = 0; j < orig.length; j++) { if (/\s/.test(orig.charAt(j))) { if (n >= k.length) resto += ' '; continue; } n++; if (n > k.length) resto += orig.charAt(j); }
        return { cat: k, cidade: cidadeBonita(resto) };
      }
    }
    return { cat: '', cidade: '' };
  }
  /* palavras comuns em nomes de estabelecimentos: separa trechos colados em MAIÚSCULAS ("SUPERMERCADOSANTA" -> "SUPERMERCADO SANTA"). O que não está na lista fica como veio. */
  var PALAVRAS = ('SUPERMERCADO MERCADO MERCEARIA FARMACIA DROGARIA PADARIA PANIFICADORA CONFEITARIA SORVETERIA PIZZARIA LANCHONETE LANCHES RESTAURANTE CHURRASCARIA CHURRAS CAFETERIA CAFE COFFEE SUSHI GRILL BURGER ' +
    'POSTO AUTO AUTOMOTIVO AUTOPECAS OFICINA CENTRO CONCESSIONARIA PEDAGIO ESTACIONAMENTO HOTEL POUSADA VIAGENS TURISMO AEREO PAGAMENTOS SERVICOS COMERCIO COMERCIAL SISTEMA SISTEMAS LOJA LOJAS CASA CASAS GRUPO MAGAZINE ELETRO ' +
    'MATERIAIS CONSTRUCAO COSMETICOS PERFUMARIA JOIAS CALCADOS MODAS OTICA PAPELARIA LIVRARIA INFORMATICA CLINICA LABORATORIO ESCOLA COLEGIO CURSO ACADEMIA ATACADO VAREJO CARNES FRUTAS HORTIFRUTI VERDURAS PEIXARIA ' +
    'SANTA SANTO ROUPAS BRASIL EXECUTIVO TRANSPORTES SEGUROS MOVEIS DECORACAO PETSHOP VETERINARIA').split(' ').filter(Boolean);
  function separarMaiusculas(tok) {
    if (!/^[A-Z]{8,}$/.test(tok)) return tok;
    var n = tok.length, custo = [0], via = [null], i, j, w;
    for (i = 1; i <= n; i++) {
      custo[i] = custo[i - 1] + 1; via[i] = 1;                                              /* caractere desconhecido */
      for (j = 0; j < PALAVRAS.length; j++) { w = PALAVRAS[j]; if (w.length <= i && tok.slice(i - w.length, i) === w && custo[i - w.length] <= custo[i]) { custo[i] = custo[i - w.length]; via[i] = w.length; } }
    }
    var partes = [], fim = n, desc = '';
    while (fim > 0) { var L = via[fim]; if (L === 1 && PALAVRAS.indexOf(tok.slice(fim - 1, fim)) < 0) { desc = tok.charAt(fim - 1) + desc; fim--; } else { if (desc) { partes.unshift(desc); desc = ''; } partes.unshift(tok.slice(fim - L, fim)); fim -= L; } }
    if (desc) partes.unshift(desc);
    return partes.join(' ');
  }
  /* descrição do estabelecimento: junta pedaços, tira cidade/BRA coladas no fim, tira "n/N" e separa letras de números */
  function limparDescItau(raw, cidadeSd) {
    var d = String(raw || '').replace(/\s+/g, ''), pa = 0, pt = 0, m = /(\d{2})\/(\d{2})$/.exec(d);
    if (m) { var a = +m[1], b = +m[2]; if (b >= 2 && b <= 60 && a >= 1 && a <= b) { pa = a; pt = b; d = d.slice(0, d.length - m[0].length); } }
    d = d.replace(/[,.\s]+$/, '');
    var cu = String(cidadeSd || '').toUpperCase(), du = d.toUpperCase(), cortou = false, k;
    if (cu) {
      if (du.slice(-3) === 'BRA' && du.slice(-3 - cu.length, -3) === cu) { d = d.slice(0, d.length - 3 - cu.length); cortou = true; }
      else if (du.slice(-2) === 'BR' && du.slice(-2 - cu.length, -2) === cu) { d = d.slice(0, d.length - 2 - cu.length); cortou = true; }
      else if (du.slice(-cu.length) === cu && d.length > cu.length + 2) { d = d.slice(0, d.length - cu.length); cortou = true; }
      if (!cortou) {
        for (k = Math.min(cu.length - 1, 8); k >= 3 && !cortou; k--) {                    /* cidade cortada no fim (prefixo: "OSA"; sufixo: "SASCO") */
          if (d.length - k >= 3 && du.slice(-k) === cu.slice(0, k) && k >= 3) { d = d.slice(0, d.length - k); cortou = true; }
        }
        for (k = Math.min(cu.length - 1, 8); k >= 4 && !cortou; k--) {
          if (d.length - k >= 3 && du.slice(-k) === cu.slice(-k)) { d = d.slice(0, d.length - k); cortou = true; }
        }
      }
    }
    d = d.replace(/([a-zà-ÿ])([A-Z])/g, '$1 $2').replace(/(\D)(\d{2,})/g, '$1 $2').replace(/(\d{2,})([A-Za-z])/g, '$1 $2');
    d = d.split(/\s+/).map(separarMaiusculas).join(' ').replace(/\s+/g, ' ').trim();
    return { desc: d, pa: pa, pt: pt, cidadeCortada: cortou };
  }
  /* data "dd/mm" -> ISO. Compra parcelada: o banco mostra a data da compra ORIGINAL, que pode ter anos; o ano sai de (parcela atual, mês da fatura) */
  function dataItau(dia, mes, pa, ref) {
    var ry = +ref.slice(0, 4), rm = +ref.slice(5, 7);
    if (pa > 1) {
      var alvo = ry * 12 + rm - 1 - pa, melhor = 0, dist = 1e9, y;
      for (y = ry - 6; y <= ry; y++) { var dd = Math.abs((y * 12 + mes - 1) - alvo); if (dd < dist && diaOk(y, mes, dia)) { dist = dd; melhor = y; } }
      if (melhor) return iso(melhor, mes, dia);
    }
    return resolveAno(dia, mes, ref);
  }
  function categoriaFinal(catBanco, desc, opc) {
    var us = (opc && opc.regras) || [], d = norm(desc), i, c;
    for (i = 0; i < us.length; i++) if (us[i].termo && d.indexOf(norm(us[i].termo)) >= 0) return us[i].cat;     /* 1º: regra do usuário */
    var mapa = CAT_BANCO[catBanco] || '';
    if (mapa && mapa !== 'outros') return mapa;                                                                    /* 2º: categoria específica do banco */
    c = categorizar(desc, null, opc && opc.regrasPadrao);                                                          /* 3º: regras padrão pela descrição */
    return c !== 'outros' ? c : (mapa || 'outros');
  }

  function celulasDe(pagina) {
    return (pagina.cel || []).filter(function (c) { return c && typeof c.s === 'string' && c.s.replace(/\s/g, '') !== ''; });
  }
  function agruparY(cel, tol) {
    var cs = cel.slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; }), out = [], cur = null;
    cs.forEach(function (c) { if (cur && Math.abs(cur.y - c.y) <= tol) cur.c.push(c); else { cur = { y: c.y, c: [c] }; out.push(cur); } });
    out.forEach(function (l) { l.c.sort(function (a, b) { return a.x - b.x; }); l.t = sd(l.c.map(function (c) { return c.s; }).join('')); });
    return out;
  }
  /* separa a página em coluna esquerda / direita pela posição das colunas "DATA" (cabeçalho) e das datas dd/mm */
  function colunas(cel) {
    var xs = cel.filter(function (c) { return dataCurta(c.s) || sd(c.s) === 'data'; }).map(function (c) { return c.x; });
    if (!xs.length) return [cel];
    var mn = Math.min.apply(null, xs), dir = xs.filter(function (x) { return x > mn + 120; });
    if (!dir.length) return [cel];
    var corte = Math.min.apply(null, dir) - 8;
    return [cel.filter(function (c) { return c.x < corte; }), cel.filter(function (c) { return c.x >= corte; })];
  }
  function ultimoDinheiro(l) {
    var n = l.c.length, v = dinheiro(l.c[n - 1].s);
    if (v == null && n > 1) { v = dinheiro(l.c[n - 2].s + l.c[n - 1].s); if (v != null) return { v: v, n: 2 }; return null; }
    return v == null ? null : { v: v, n: 1 };
  }
  function ehItauColunas(paginas) {
    var t = '';
    (paginas || []).forEach(function (p) { t += celulasDe(p).map(function (c) { return sd(c.s); }).join(''); });
    return /itau/.test(t) && /lancamentos:comprasesaques/.test(t) && /datavaloremr\$|estabelecimento/.test(t.replace(/\s/g, ''));
  }

  function analisarItauColunas(paginas, opc) {
    opc = opc || {};
    var res = { banco: 'itau', bancoNome: 'Itaú', layout: 'colunas', resumo: { total: null, vencimento: '', fechamento: '', final: '', periodo: '', emissao: '', proxFechamento: '', pagamentoMinimo: null, totalAnterior: null, pagamentoAnterior: null,
      limiteTotal: null, limiteDisponivel: null, produto: '', encargos: null, futuras: { proxima: null, demais: null, total: null, lista: [] } }, lancs: [], ignoradas: [], avisos: [], confianca: 'baixa',
      validacao: { subtotalCartao: null, subtotalProdutos: null, totalLancamentos: null, somaCartao: 0, somaProdutos: 0, somaFuturas: 0 }, porCategoria: {}, porCategoriaBanco: {} };
    var R = res.resumo, V = res.validacao, linhasPag = [], fluxo = [];
    /* 1) cabeçalho (linhas de largura inteira) */
    paginas.forEach(function (p, i) { var cel = celulasDe(p); linhasPag.push(agruparY(cel, 2.5)); fluxo.push(colunas(cel)); });
    var todas = []; linhasPag.forEach(function (ls) { todas = todas.concat(ls); });
    function valorDa(rx, excl) { for (var i = 0; i < todas.length; i++) { if (rx.test(todas[i].t) && !(excl && excl.test(todas[i].t))) { var u = ultimoDinheiro(todas[i]); if (u) return u.v; } } return null; }
    function achar(rx) { for (var i = 0; i < todas.length; i++) { var m = rx.exec(todas[i].t); if (m) return m; } return null; }
    R.total = valorDa(/totaldestafatura/);
    if (R.total == null) R.total = valorDa(/totaldafatura(?!anterior)/, /anterior/);
    R.totalAnterior = valorDa(/totaldafaturaanterior/);
    R.pagamentoAnterior = valorDa(/pagamentoefetuadoem/);
    if (R.pagamentoAnterior != null) R.pagamentoAnterior = Math.abs(R.pagamentoAnterior);
    var m = achar(/vencimento:(\d{2}\/\d{2}\/\d{4})/); if (m) R.vencimento = dataLonga(m[1]);
    m = achar(/emissao:(\d{2}\/\d{2}\/\d{4})/); if (m) R.emissao = dataLonga(m[1]);
    m = achar(/fechamento:(\d{2}\/\d{2}\/\d{4})/) || achar(/proximofechamento:(\d{2}\/\d{2}\/\d{4})/); if (m) R.proxFechamento = dataLonga(m[1]);
    R.fechamento = R.emissao;                                                              /* o Itaú fecha na emissão; "próx. fechamento" é o do mês seguinte */
    m = achar(/cartao[\dx*.\-]*?\.?(\d{4})$/) || achar(/cartao[\dx*.\-]{8,}(\d{4})/); if (m) R.final = m[1];
    m = achar(/^(black|platinum|gold|infinite|click|uniclass|personnalite|standard|internacional|nacional|mastercard|visa)$/); if (m) R.produto = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    R.limiteTotal = valorDa(/limitetotaldecredito/); R.limiteDisponivel = valorDa(/limitedisponivel/);
    R.pagamentoMinimo = null;
    todas.forEach(function (l, i) {                                                        /* "Pagamento mínimo:" e o valor logo abaixo */
      if (R.pagamentoMinimo != null) return;
      l.c.forEach(function (c) {
        if (R.pagamentoMinimo != null || sd(c.s).indexOf('pagamentominimo:') < 0) return;
        var ls = todas.filter(function (o) { return o.y < c.y - 1 && o.y > c.y - 40; });
        for (var j = 0; j < ls.length && R.pagamentoMinimo == null; j++) ls[j].c.forEach(function (d) { if (R.pagamentoMinimo == null && d.x >= c.x - 6 && d.x <= c.x + 90 && dinheiro(d.s) != null) R.pagamentoMinimo = dinheiro(d.s); });
      });
    });
    if (R.pagamentoMinimo == null) { m = achar(/valorminimodenovastransacoes\(r\$([\d.,]+)\)/); if (m) R.pagamentoMinimo = dinheiro(m[1]); }
    if (!R.vencimento) res.avisos.push('Não achei o vencimento: informe na revisão.');
    var ref = R.vencimento || R.emissao || opc.hoje || '2000-01-01';

    /* 2) lançamentos, coluna por coluna, página por página (a seção continua de uma coluna/página para a seguinte) */
    var sec = '', ultimo = null, brutos = [], pagtos = [];
    var encargos = null;
    fluxo.forEach(function (cols) {
      cols.forEach(function (cel) {
        agruparY(cel, 2.5).forEach(function (l) {
          var t = l.t, u = ultimoDinheiro(l), dt = dataCurta(l.c[0].s);
          if (t.length <= 2 && !dt) return;                                                /* ruído (ponto solto, letra de margem) */
          if (!dt && u == null) {                                                          /* cabeçalho de seção ou linha de detalhe */
            if (/lancamentos:comprasesaques/.test(t)) { sec = 'compras'; ultimo = null; return; }
            if (/lancamentos:produtoseservicos/.test(t)) { sec = 'produtos'; ultimo = null; return; }
            if (/comprasparceladas-?proximasfaturas/.test(t)) { sec = 'futuras'; ultimo = null; return; }
            if (/pagamentosefetuados/.test(t)) { sec = 'pagamentos'; ultimo = null; return; }
            if (/limitesdecredito|encargoscobrados|fiqueatentoaosencargos|simulacaodecompras/.test(t)) { sec = ''; ultimo = null; return; }
            if (ultimo && ultimo.y - l.y <= 14 && !ultimo.det) {                           /* linha de baixo: "categoria CIDADE" ou "Principal (R$..) + Juros (R$..)" */
              var pj = /principal\(r\$([\d.,]+)\)\+juros\(r\$([\d.,]+)\)/.exec(t);
              ultimo.det = true;
              if (pj) { ultimo.item.principal = dinheiro(pj[1]); ultimo.item.juros = dinheiro(pj[2]); }
              else { var cc = lerCategoriaCidade(l.c.map(function (c) { return c.s; }).join(' ')); ultimo.item.catBanco = cc.cat; ultimo.item.cidade = cc.cidade; ultimo.item.cidadeSd = cc.cidade.replace(/[^A-Za-z]/g, ''); }
            }
            return;
          }
          if (!dt) {                                                                       /* linha com valor e sem data: subtotais, futuras, limites, encargos */
            if (/lancamentosnocartao/.test(t)) { V.subtotalCartao = u.v; return; }
            if (/lancamentosprodutoseservicos/.test(t)) { V.subtotalProdutos = u.v; return; }
            if (/totaldoslancamentosatuais/.test(t)) { V.totalLancamentos = u.v; return; }
            if (/^[a-z]?proximafatura/.test(t) && sec === 'futuras') { R.futuras.proxima = u.v; return; }
            if (/demaisfaturas/.test(t) && sec === 'futuras') { R.futuras.demais = u.v; return; }
            if (/totalparaproximasfaturas/.test(t)) { R.futuras.total = u.v; return; }
            if (/jurosdorotativo|jurosdemora|multaporatraso|iofdefinanciamento/.test(t)) { encargos = r2((encargos || 0) + u.v); return; }
            return;
          }
          /* linha de lançamento: [data] [descrição...] [valor] */
          if (u == null || l.c.length - u.n < 2) { res.avisos.push('Linha com data e sem valor ignorada (' + String(l.c[0].s).replace(/\s+/g, '') + ').'); return; }
          var raw = l.c.slice(1, l.c.length - u.n).map(function (c) { return c.s; }).join(' ');
          var item = { dia: dt.d, mes: dt.m, rawDesc: raw, valor: u.v, sec: sec, catBanco: '', cidade: '' };
          ultimo = { item: item, y: l.y, det: false };
          if (!sec) { res.avisos.push('Lançamento fora de uma seção conhecida ignorado.'); ultimo = null; return; }
          (sec === 'pagamentos' ? pagtos : brutos).push(item);
        });
      });
    });

    R.encargos = encargos;
    /* 3) monta lançamentos, ignorados e parcelas futuras */
    var catsCompra = {};                                                                    /* descrição normalizada -> categoria (para classificar as parcelas futuras) */
    function montar(it) {
      var d = limparDescItau(it.rawDesc, it.cidadeSd || ''), data = dataItau(it.dia, it.mes, d.pa, ref);
      return { chave: it.dia + '/' + it.mes + '/' + d.pt + '/' + String(it.rawDesc).replace(/\s+/g, '').replace(/\d{2}\/\d{2}$/, ''), data: data, desc: limpar(d.desc).slice(0, 80), valor: it.valor, pa: d.pa, pt: d.pt, catBanco: it.catBanco || '', cidade: it.cidade || '', sec: it.sec, principal: it.principal, juros: it.juros };
    }
    pagtos.forEach(function (it) {
      var x = montar(it); x.cat = 'outros'; x.motivo = /deb|autom|pagamento/i.test(it.rawDesc.replace(/\s+/g, '')) ? 'pagamento da fatura anterior' : 'pagamento';
      res.ignoradas.push({ data: x.data, desc: x.desc, valor: x.valor, pa: 0, pt: 0, cat: 'outros', motivo: x.motivo });
    });
    brutos.forEach(function (it) {
      var x = montar(it);
      if (it.sec === 'futuras') { R.futuras.lista.push(x); return; }
      if (it.sec === 'produtos' || /^PgConta|MULTA/i.test(x.desc.replace(/\s+/g, ''))) {
        if (/multa|juros|encargo|iof/i.test(x.desc)) { x.cat = 'encargos'; x.catBanco = 'multa/juros'; if (x.principal != null && x.juros != null) x.desc = (x.desc + ' (principal ' + x.principal.toFixed(2).replace('.', ',') + ' + juros ' + x.juros.toFixed(2).replace('.', ',') + ')').slice(0, 80); }
        else x.cat = categoriaFinal(x.catBanco, x.desc, opc);
      } else x.cat = categoriaFinal(x.catBanco, x.desc, opc);
      x.origem = it.sec;
      catsCompra[x.chave] = { desc: x.desc, cat: x.cat };
      res.lancs.push({ data: x.data, desc: x.desc, valor: x.valor, pa: x.pa, pt: x.pt, cat: x.cat, catBanco: x.catBanco, cidade: x.cidade, origem: it.sec, bruto: '' });
    });
    R.futuras.lista = R.futuras.lista.map(function (x) {
      var c0 = catsCompra[x.chave], cat = c0 ? c0.cat : (/multa|juros/i.test(x.desc) ? 'encargos' : categoriaFinal('', x.desc, opc));
      return { data: x.data, desc: c0 ? c0.desc.replace(/ \(principal.*$/, '') : x.desc, pa: x.pa, pt: x.pt, valor: x.valor, cat: cat };
    });
    /* 4) validação (centavos exatos) */
    var cartao = 0, prods = 0;
    res.lancs.forEach(function (x) { if (x.origem === 'produtos') prods += x.valor; else cartao += x.valor; });
    V.somaCartao = r2(cartao); V.somaProdutos = r2(prods);
    res.soma = r2(cartao + prods);
    V.somaFuturas = r2(R.futuras.lista.reduce(function (a, x) { return a + x.valor; }, 0));
    V.restanteFuturas = r2(R.futuras.lista.reduce(function (a, x) { return a + x.valor * Math.max(0, x.pt - x.pa); }, 0));
    res.lancs.forEach(function (x) {
      if (x.valor > 0) { res.porCategoria[x.cat] = r2((res.porCategoria[x.cat] || 0) + x.valor); var cb = x.catBanco || 'sem categoria'; res.porCategoriaBanco[cb] = r2((res.porCategoriaBanco[cb] || 0) + x.valor); }
    });
    var bate = function (a, b) { return a != null && b != null && Math.abs(a - b) < 0.005; };
    var checks = [];
    if (V.subtotalCartao != null) { V.okCartao = bate(V.somaCartao, V.subtotalCartao); checks.push(V.okCartao); if (!V.okCartao) res.avisos.push('Compras no cartão: li ' + brl2(V.somaCartao) + ', o banco diz ' + brl2(V.subtotalCartao) + '.'); }
    if (V.subtotalProdutos != null) { V.okProdutos = bate(V.somaProdutos, V.subtotalProdutos); checks.push(V.okProdutos); if (!V.okProdutos) res.avisos.push('Produtos e serviços: li ' + brl2(V.somaProdutos) + ', o banco diz ' + brl2(V.subtotalProdutos) + '.'); }
    if (V.totalLancamentos != null) { V.okLancamentos = bate(res.soma, V.totalLancamentos); checks.push(V.okLancamentos); if (!V.okLancamentos) res.avisos.push('Total dos lançamentos: li ' + brl2(res.soma) + ', o banco diz ' + brl2(V.totalLancamentos) + '.'); }
    V.okTotal = bate(res.soma, R.total); if (R.total != null) checks.push(V.okTotal);
    if (R.total == null) res.avisos.push('Não achei o total da fatura. Confira os lançamentos.');
    else if (!V.okTotal) res.avisos.push('A soma dos lançamentos (' + brl2(res.soma) + ') difere do total da fatura (' + brl2(R.total) + '). Revise as linhas.');
    if (R.futuras.proxima != null) { V.okFuturas = bate(V.somaFuturas, R.futuras.proxima); if (!V.okFuturas) res.avisos.push('Parcelas futuras: a soma da lista (' + brl2(V.somaFuturas) + ') difere da "próxima fatura" do banco (' + brl2(R.futuras.proxima) + ').'); }
    if (!res.lancs.length) { res.confianca = 'nenhuma'; res.avisos.push('Não encontrei lançamentos neste PDF.'); }
    else if (R.total != null && checks.length && checks.every(Boolean)) res.confianca = 'alta';
    else if (R.total != null && Math.abs(res.soma - R.total) <= Math.abs(R.total) * 0.1) res.confianca = 'media';
    else res.confianca = 'baixa';
    if (res.lancs.length) { var ds = res.lancs.filter(function (x) { return !x.pt || x.pa <= 1; }).map(function (x) { return x.data; }).sort(); if (ds.length) R.periodo = ds[0].split('-').reverse().join('/') + ' a ' + ds[ds.length - 1].split('-').reverse().join('/'); }
    return res;
  }
  function brl2(v) { return 'R$ ' + (Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+,)/g, '.'); }

  /* ---------- leitura do PDF com pdf.js (lib injetada: no navegador vem de js/vendor/pdfjs, nos testes do Node também) ---------- */
  function lerPdf(lib, bytes, pedirSenha) {
    var tarefa = lib.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
    tarefa.onPassword = function (atualiza, motivo) {
      if (!pedirSenha) { tarefa.destroy(); return; }
      Promise.resolve(pedirSenha(motivo === 2 ? 'errada' : 'precisa')).then(function (s) { if (s == null || s === '') { tarefa.destroy(); } else atualiza(s); });
    };
    return tarefa.promise.then(function (pdf) {
      var todas = [], itens = [], chars = 0, n = Math.min(pdf.numPages, 30), seq = Promise.resolve(), i;
      function pag(k) { return pdf.getPage(k).then(function (p) { return p.getTextContent(); }).then(function (tc) { tc.items.forEach(function (it) { chars += (it.str || '').replace(/\s/g, '').length; }); itens.push({ cel: tc.items.filter(function (it) { return it && typeof it.str === 'string' && it.str.replace(/\s/g, '') !== '' && it.transform; }).map(function (it) { return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }; }) }); return agruparLinhas(tc.items); }); }
      for (i = 1; i <= n; i++) (function (k) { seq = seq.then(function () { return pag(k); }).then(function (ls) { todas = todas.concat(ls); }); })(i);
      return seq.then(function () {
        try { pdf.destroy(); } catch (e) { /* ok */ }
        if (chars < 20) { var er = new Error('imagem'); er.tipo = 'imagem'; throw er; }
        return { linhas: todas, paginas: n, itens: itens };
      });
    }, function (e) {
      var er = new Error(e && e.message || 'pdf'); er.tipo = (e && (e.name === 'PasswordException' || e.name === 'PasswordException')) || (tarefa.destroyed) ? 'senha' : 'invalido';
      if (e && /destroyed|Worker was destroyed|Loading aborted/i.test(String(e.message || e))) er.tipo = 'senha';
      throw er;
    });
  }

  var API = { analisarItauColunas: analisarItauColunas, ehItauColunas: ehItauColunas, dinheiro: dinheiro, limparDescItau: limparDescItau, lerCategoriaCidade: lerCategoriaCidade, lerPdf: lerPdf, analisar: analisar, agruparLinhas: agruparLinhas, valorBR: valorBR, limpar: limpar, rejeitaSensivel: rejeitaSensivel, categorizar: categorizar, detectarBanco: detectarBanco, extrairParcela: extrairParcela, CATS: CATS, BANCOS: BANCOS, norm: norm, dataCompleta: dataCompleta };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else { g.PS = g.PS || {}; g.PS.fatura = API; }
})(typeof window !== 'undefined' ? window : this);
