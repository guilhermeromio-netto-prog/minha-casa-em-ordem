/* Testes do domínio financeiro (pendências, pago/aberto, histórico, lembretes com relógio falso, .ics):  node tools/teste-financeiro.js */
'use strict';
var assert = require('assert');
global.window = global; global.PS = {};
require('../js/util.js'); require('../js/financeiro.js');
var F = global.PS.fin, U = global.PS.u;
var ok = 0, falhas = 0;
function t(nome, fn) { try { fn(); ok++; console.log('  ok   ' + nome); } catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + e.message); } }
function conta(o) { return Object.assign({ id: 'c1', titulo: 'Luz', mensal: true, dia: 10, data: '', valor: 100, paga: false, pagaEm: '', pagas: {}, valores: {}, desde: '', cat: 'casa', dono: '' }, o); }
function est(o) { return Object.assign({ contas: [], faturas: [], cartoes: [], lembretes: [], lancs: [] }, o); }
var HOJE = '2026-10-10';

t('pendências ordenam por urgência: vencida, hoje, amanhã, depois', function () {
  var s = est({ contas: [conta({ id: 'a', titulo: 'Água', dia: 7 }), conta({ id: 'b', titulo: 'Luz', dia: 10 }), conta({ id: 'c', titulo: 'Gás', dia: 11 }), conta({ id: 'd', titulo: 'Net', dia: 15 }), conta({ id: 'e', titulo: 'Longe', dia: 25 })] });
  var p = F.pendencias(s, HOJE, 7);
  assert.deepStrictEqual(p.map(function (x) { return x.titulo; }), ['Água', 'Luz', 'Gás', 'Net']);
  assert.deepStrictEqual(p.map(function (x) { return x.nivel; }), ['vencida', 'hoje', 'amanha', 'semana']);
  assert.strictEqual(p[0].dias, -3);
});
t('conta paga some das pendências; desfazer traz de volta', function () {
  var s = est({ contas: [conta({ dia: 10 })] });
  assert.strictEqual(F.pendencias(s, HOJE, 7).length, 1);
  assert.ok(F.marcarPaga(s, 'conta', 'c1', '2026-10', '2026-10-09'));
  assert.strictEqual(F.pendencias(s, HOJE, 7).length, 0);
  assert.strictEqual(s.contas[0].pagas['2026-10'], '2026-10-09');
  assert.strictEqual(s.contas[0].valores['2026-10'], 100);
  F.desfazerPaga(s, 'conta', 'c1', '2026-10');
  assert.strictEqual(F.pendencias(s, HOJE, 7).length, 1);
});
t('conta mensal gera o mês seguinte como aberto depois de paga', function () {
  var s = est({ contas: [conta({ dia: 3 })] });
  F.marcarPaga(s, 'conta', 'c1', '2026-10', HOJE);
  var p = F.pendencias(s, '2026-10-30', 7);
  assert.strictEqual(p.length, 1); assert.strictEqual(p[0].data, '2026-11-03'); assert.strictEqual(p[0].chave, '2026-11');
  var l = F.listas(s, '2026-10-30');
  assert.ok(l.abertas.some(function (x) { return x.chave === '2026-11'; })); assert.ok(l.pagas.some(function (x) { return x.chave === '2026-10' && x.pagaEm === HOJE; }));
});
t('conta antiga (sem desde) não vira vencida de meses passados; conta nova com desde sim', function () {
  var s = est({ contas: [conta({ id: 'x', dia: 5, desde: '' }), conta({ id: 'y', titulo: 'Nova', dia: 5, desde: '2026-09' })] });
  var p = F.pendencias(s, HOJE, 7).filter(function (x) { return x.dias < 0; });
  assert.deepStrictEqual(p.map(function (x) { return x.id + x.chave; }).sort(), ['x2026-10', 'y2026-09', 'y2026-10']);
});
t('fatura: vencida em vermelho (nivel), paga some, teste nunca entra', function () {
  var s = est({ cartoes: [{ id: 'k', apelido: 'Nubank' }], faturas: [{ id: 'f1', cartao: 'k', mes: '2026-10', valor: 1234.56, vencimento: '2026-10-08', status: 'fechada' }, { id: 'f2', cartao: 'k', mes: '2026-10', valor: 5, vencimento: '2026-10-09', status: 'aberta', teste: true }] });
  var p = F.pendencias(s, HOJE, 7); assert.strictEqual(p.length, 1); assert.strictEqual(p[0].nivel, 'vencida'); assert.strictEqual(p[0].titulo, 'Fatura Nubank');
  F.marcarPaga(s, 'fatura', 'f1', '', HOJE); assert.strictEqual(F.pendencias(s, HOJE, 7).length, 0); assert.strictEqual(s.faturas[0].pagaEm, HOJE);
  F.desfazerPaga(s, 'fatura', 'f1'); assert.strictEqual(s.faturas[0].status, 'aberta');
});
t('nunca marca como paga sozinha (listar/ler não muta)', function () {
  var s = est({ contas: [conta({ dia: 1 })] }); var antes = JSON.stringify(s); F.pendencias(s, HOJE, 7); F.listas(s, HOJE); F.historico(s, HOJE, 6); F.lembretesPara(s, HOJE, [3, 1, 0], {}); assert.strictEqual(JSON.stringify(s), antes);
});
t('lembretes do dia entram; feitos somem', function () {
  var s = est({ lembretes: [{ id: 'l1', titulo: 'Ligar para o dentista', dia: 10, feitos: {} }, { id: 'l2', titulo: 'Outro', dia: 10, feitos: { '2026-10': true } }] });
  var p = F.pendencias(s, HOJE, 7); assert.strictEqual(p.length, 1); assert.strictEqual(p[0].tipo, 'lembrete');
});
t('resumo conta níveis', function () {
  var s = est({ contas: [conta({ id: 'a', dia: 7 }), conta({ id: 'b', dia: 10 }), conta({ id: 'c', dia: 11 })] });
  var r = F.resumo(F.pendencias(s, HOJE, 7)); assert.strictEqual(r.vencidas, 1); assert.strictEqual(r.hoje, 1); assert.strictEqual(r.amanha, 1); assert.strictEqual(r.urgentes, 2); assert.strictEqual(r.valor, 300);
});
t('histórico: total por mês, Δ R$ e %, direção e categorias', function () {
  var s = est({ contas: [conta({ id: 'a', valor: 100, pagas: { '2026-08': '2026-08-10', '2026-09': '2026-09-10' }, valores: { '2026-08': 100, '2026-09': 120 }, cat: 'casa' })],
    faturas: [{ id: 'f1', cartao: 'k', mes: '2026-09', valor: 500, vencimento: '2026-09-20', status: 'paga' }, { id: 'f2', cartao: 'k', mes: '2026-10', valor: 400, vencimento: '2026-10-20', status: 'aberta' }],
    lancs: [{ fatura: 'f1', valor: 300, cat: 'mercado' }, { fatura: 'f1', valor: 200, cat: 'lazer' }, { fatura: 'f2', valor: 400, cat: 'mercado' }] });
  var h = F.historico(s, HOJE, 3), m = h.meses;
  assert.deepStrictEqual(m.map(function (x) { return x.mes; }), ['2026-08', '2026-09', '2026-10']);
  assert.strictEqual(m[0].total, 100); assert.strictEqual(m[1].total, 620); assert.strictEqual(m[2].total, 500);
  assert.strictEqual(m[1].vs.dir, 'subiu'); assert.strictEqual(m[1].vs.dv, 520); assert.strictEqual(m[1].vs.pct, 520);
  assert.strictEqual(m[2].vs.dir, 'caiu'); assert.strictEqual(m[2].vs.dv, -120); assert.strictEqual(m[2].vs.pct, -19.4);
  var lazer = h.porCategoria.filter(function (c) { return c.cat === 'lazer'; })[0]; assert.strictEqual(lazer.dir, 'caiu'); assert.strictEqual(lazer.dv, -200);
  assert.strictEqual(m[0].vs, null);
});
t('comparar: sem base anterior → pct nulo; igual', function () {
  assert.strictEqual(F.comparar(10, 0).pct, null); assert.strictEqual(F.comparar(10, 10).dir, 'igual');
});
t('totais do mês: a pagar / pago', function () {
  var s = est({ contas: [conta({ id: 'a', valor: 100 }), conta({ id: 'b', valor: 50, pagas: { '2026-10': HOJE } })] });
  var r = F.totaisDoMes(s, HOJE); assert.strictEqual(r.aPagar, 100); assert.strictEqual(r.pago, 50);
});
t('lembretes (relógio falso): 3, 1 e 0 dias; sem repetir; vencida 1x por dia; nada de madrugada', function () {
  var s = est({ contas: [conta({ dia: 13 })] });
  var enviados = {}, hoje = '2026-10-10';
  var l1 = F.lembretesPara(s, hoje, [3, 1, 0], enviados, 9); assert.strictEqual(l1.length, 1); assert.ok(/d3$/.test(l1[0].chave)); assert.ok(/em 3 dias/.test(l1[0].corpo));
  l1.forEach(function (x) { enviados[x.chave] = hoje; });
  assert.strictEqual(F.lembretesPara(s, hoje, [3, 1, 0], enviados, 15).length, 0);                           // já enviado
  assert.strictEqual(F.lembretesPara(s, '2026-10-11', [3, 1, 0], enviados, 9).length, 0);                    // 2 dias: não está na lista
  assert.strictEqual(F.lembretesPara(s, '2026-10-12', [3, 1, 0], enviados, 9).length, 1);                    // 1 dia
  assert.strictEqual(F.lembretesPara(s, '2026-10-13', [3, 1, 0], enviados, 9)[0].corpo.indexOf('hoje') >= 0, true); // dia
  var atras = F.lembretesPara(s, '2026-10-14', [3, 1, 0], {}, 9); assert.strictEqual(atras.length, 1); assert.ok(/Atrasada/.test(atras[0].titulo));
  assert.strictEqual(F.lembretesPara(s, '2026-10-12', [3, 1, 0], {}, 5).length, 0);                          // 05h
  assert.strictEqual(F.lembretesPara(s, '2026-10-12', [7], {}, 9).length, 0);                                // só 7 dias
  var paga = est({ contas: [conta({ dia: 13, pagas: { '2026-10': '2026-10-09' } })] }); assert.strictEqual(F.lembretesPara(paga, '2026-10-12', [3, 1, 0], {}, 9).length, 0);
});
t('podar enviados antigos', function () { var r = F.podarEnviados({ a: '2026-01-01', b: '2026-10-09' }, HOJE); assert.deepStrictEqual(Object.keys(r), ['b']); });
t('.ics válido: CRLF, BEGIN/END pareados, VALARM por antecedência, escape e dobra', function () {
  var s = est({ contas: [conta({ titulo: 'Condomínio, bloco; A\\B ' + new Array(90).join('x'), dia: 15, valor: 800 })], faturas: [{ id: 'f1', cartao: 'k', mes: '2026-10', valor: 1500, vencimento: '2026-10-20', status: 'aberta' }], cartoes: [{ id: 'k', apelido: 'Nubank' }] });
  var ics = F.icsDasPendencias(s, HOJE, [3, 1, 0], '2026-10-10T12:00:00.000Z');
  assert.ok(/^BEGIN:VCALENDAR\r\n/.test(ics) && /END:VCALENDAR\r\n$/.test(ics));
  assert.ok(ics.indexOf('\n') === ics.indexOf('\r\n') + 1);
  ['VEVENT', 'VALARM', 'VCALENDAR'].forEach(function (k) { assert.strictEqual((ics.match(new RegExp('BEGIN:' + k, 'g')) || []).length, (ics.match(new RegExp('END:' + k, 'g')) || []).length, k); });
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 3); assert.strictEqual((ics.match(/BEGIN:VALARM/g) || []).length, 9);
  ics.split('\r\n').forEach(function (l) { assert.ok(Buffer.byteLength(l) <= 75, 'linha longa: ' + l.length); });
  assert.ok(ics.indexOf('DTSTART;VALUE=DATE:20261015') >= 0 && ics.indexOf('DTEND;VALUE=DATE:20261016') >= 0);
  assert.ok(ics.indexOf('TRIGGER:-P2DT15H') >= 0 && ics.indexOf('TRIGGER:PT9H') >= 0 && ics.indexOf('TRIGGER:-P0DT15H') >= 0);
  assert.ok(/UID:[A-Za-z0-9_.@-]+@painel-sala/.test(ics)); assert.ok(ics.indexOf('DTSTAMP:20261010T120000Z') >= 0);
  var un = ics.replace(/\r\n /g, ''); assert.ok(un.indexOf('Condomínio\\, bloco\\; A\\\\B') >= 0);
  assert.ok(ics.indexOf('não confirma pagamento') >= 0);
});
t('agenda para o service worker', function () {
  var s = est({ contas: [conta({ dia: 15 })] }); var a = F.agendaParaSW(s, HOJE, [3, 1, 0]);
  assert.deepStrictEqual(a.map(function (x) { return x.avisar; }).sort(), ['2026-10-12', '2026-10-14', '2026-10-15', '2026-11-12', '2026-11-14', '2026-11-15'].sort());
});
console.log('\n' + ok + ' ok, ' + falhas + ' falhas'); process.exit(falhas ? 1 : 0);
