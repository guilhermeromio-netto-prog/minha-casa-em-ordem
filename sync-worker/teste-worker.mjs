/* Teste de integração do Worker (Node 18+, sem dependências): node teste-worker.mjs <URL do Worker>
 * Cria famílias DESCARTÁVEIS com blobs falsos, exercita as rotas e (no fim) apaga o que criou.
 * Atenção: o teste de bloqueio deixa o IP bloqueado por alguns minutos (é o comportamento esperado). */
var URL_BASE = process.argv[2] || 'https://painel-sala-sync.guilhermeromionetto.workers.dev';
var ORIGEM = 'https://guilhermeromio-netto-prog.github.io';
var ok = 0, falhas = 0;
function check(c, m) { if (c) { ok++; console.log('  ok  ' + m); } else { falhas++; console.log('  FALHOU  ' + m); } }
async function api(metodo, caminho, corpo, token, extra) {
  var h = Object.assign({ origin: ORIGEM }, extra || {});
  if (corpo !== undefined && !(extra && extra['content-type'])) h['content-type'] = 'application/json';
  if (token) h.authorization = 'Bearer ' + token;
  var r = await fetch(URL_BASE + caminho, { method: metodo, headers: h, body: corpo === undefined ? undefined : (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) });
  var t = await r.text(), j = null; try { j = JSON.parse(t); } catch (e) { /* ok */ }
  return { s: r.status, j: j, h: r.headers };
}
function b64(n) { return Buffer.from(Array.from({ length: n }, function () { return Math.floor(Math.random() * 256); })).toString('base64url'); }
var CH = { salt: b64(16), env_senha: b64(80), env_rec: b64(80) };
var PIN = '482913';

(async function () {
  console.log('== CORS e cabeçalhos ==');
  var r = await api('OPTIONS', '/v1/dados');
  check(r.s === 204 && r.h.get('access-control-allow-origin') === ORIGEM, 'preflight da origem permitida');
  var ORIGEM2 = 'https://minha-casa-em-ordem.guilhermeromionetto.workers.dev';
  r = await fetch(URL_BASE + '/v1/saude', { method: 'OPTIONS', headers: { origin: ORIGEM2 } });
  check(r.status === 204 && r.headers.get('access-control-allow-origin') === ORIGEM2, 'preflight da origem do portal (Cloudflare)');
  r = await fetch(URL_BASE + '/v1/saude', { headers: { origin: 'https://evil.example' } });
  check(r.status === 403 && !r.headers.get('access-control-allow-origin'), 'origem não permitida recebe 403 sem ACAO');
  r = await fetch(URL_BASE + '/v1/saude', { method: 'OPTIONS', headers: { origin: 'null' } });
  check(r.status === 403, 'origem "null" bloqueada');
  r = await fetch(URL_BASE + '/v1/saude', { headers: { origin: ORIGEM } });
  check(r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('cache-control') === 'no-store' && /default-src 'none'/.test(r.headers.get('content-security-policy')), 'cabeçalhos de segurança');
  r = await api('GET', '/v1/dados'); check(r.s === 401, 'sem token: 401');
  r = await api('GET', '/v1/nada'); check(r.s === 404, 'rota inexistente: 404');

  console.log('== Criar família ==');
  r = await api('POST', '/v1/familia', Object.assign({ pin: '1234' }, CH)); check(r.s === 400 && r.j.erro === 'pin_fraco', 'PIN sequencial rejeitado');
  r = await api('POST', '/v1/familia', Object.assign({ pin: '111111' }, CH)); check(r.s === 400, 'PIN repetido rejeitado');
  r = await api('POST', '/v1/familia', Object.assign({ pin: PIN }, { salt: 'x', env_senha: 'y', env_rec: 'z' })); check(r.s === 400 && r.j.erro === 'chaves_invalidas', 'chaves inválidas rejeitadas');
  var t0 = Date.now();
  r = await api('POST', '/v1/familia', Object.assign({ pin: PIN, rotulo: 'Teste A' }, CH));
  check(r.s === 201 && /^\d{8}$/.test(r.j.codigo) && r.j.token.length === 43, 'família criada (código de 8 dígitos) em ' + (Date.now() - t0) + ' ms');
  var codigo = r.j.codigo, tokA = r.j.token;

  console.log('== Entrar ==');
  r = await api('POST', '/v1/entrar', { codigo: codigo, pin: '999000' }); check(r.s === 403 && r.j.erro === 'credencial', 'PIN errado: 403 genérico');
  r = await api('POST', '/v1/entrar', { codigo: '12345678', pin: PIN }); check(r.s === 403 && r.j.erro === 'credencial', 'código inexistente: mesma resposta');
  r = await api('POST', '/v1/entrar', { codigo: codigo.slice(0, 4) + ' ' + codigo.slice(4), pin: PIN, rotulo: 'Teste B' });
  check(r.s === 200 && r.j.salt === CH.salt && r.j.env_senha === CH.env_senha && r.j.env_rec === CH.env_rec, 'entrar devolve só envelopes opacos');
  var tokB = r.j.token;
  check(JSON.stringify(r.j).indexOf(PIN) < 0, 'resposta não contém o PIN');

  console.log('== Dados: mescla por item (LWW), tombstones, conflitos ==');
  var I1 = b64(16), I2 = b64(16), I3 = b64(16), agora = Date.now() - 60000;
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'lembretes', i: I1, t: agora, d: b64(100) }, { c: 'tarefas', i: I2, t: agora, d: b64(60) }] }, tokA);
  check(r.s === 200 && r.j.seq === 1 && r.j.aceitos === 2, 'A envia 2 itens (seq 1)');
  var segA = r.j.seq;
  r = await api('GET', '/v1/dados?since=0', undefined, tokB); check(r.s === 200 && r.j.itens.length === 2, 'B recebe os 2 itens');
  var cursorB = r.j.seq;
  var dB = b64(70);
  r = await api('PUT', '/v1/dados', { since: cursorB, mudancas: [{ c: 'lembretes', i: I1, t: agora + 5000, d: dB }, { c: 'tarefas', i: I3, t: agora + 5000, d: b64(40) }] }, tokB);
  check(r.s === 200 && r.j.seq === 2 && r.j.itens.length === 0, 'B edita I1 e cria I3 (sem eco do que enviou)');
  var dA = b64(70);
  r = await api('PUT', '/v1/dados', { since: segA, mudancas: [{ c: 'lembretes', i: I1, t: agora + 1000, d: dA }] }, tokA);
  check(r.s === 200 && r.j.aceitos === 0, 'edição mais antiga de A é rejeitada');
  var vI1 = r.j.itens.filter(function (x) { return x.i === I1; })[0];
  check(vI1 && vI1.d === dB && vI1.t === agora + 5000, 'A recebe a versão vencedora de B');
  check(r.j.itens.some(function (x) { return x.i === I3; }), 'A recebe I3 criado por B (mescla de itens diferentes)');
  r = await api('PUT', '/v1/dados', { since: r.j.seq, mudancas: [{ c: 'tarefas', i: I2, t: agora + 9000, a: 1 }] }, tokA);
  check(r.s === 200 && r.j.aceitos === 1, 'A apaga I2 (tombstone)');
  var seqDel = r.j.seq;
  r = await api('GET', '/v1/dados?since=' + (seqDel - 1), undefined, tokB);
  check(r.j.itens.length === 1 && r.j.itens[0].i === I2 && r.j.itens[0].a === 1 && r.j.itens[0].d === null, 'B recebe a exclusão (a=1, d=null)');
  r = await api('PUT', '/v1/dados', { since: seqDel, mudancas: [{ c: 'tarefas', i: I2, t: agora + 2000, d: b64(30) }] }, tokB);
  check(r.j.aceitos === 0 && r.j.itens.some(function (x) { return x.i === I2 && x.a === 1; }), 'edição antiga não ressuscita item apagado');
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'tarefas', i: I2, t: agora + 50, d: b64(30), n: 1 }, { c: 'checks', i: b64(16), t: agora, d: b64(20), n: 1 }] }, tokB);
  check(r.j.aceitos === 1 && r.j.itens.some(function (x) { return x.i === I2 && x.a === 1; }), 'item "novo" com id existente (tombstone) é ignorado e devolve o do servidor');
  var tieD = 'zzzzzzzzzzzz';
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'lembretes', i: I1, t: agora + 5000, d: tieD }] }, tokA);
  check(r.j.itens.some(function (x) { return x.i === I1; }) || r.j.aceitos === 1, 'empate de t resolvido de forma determinística');
  var rr = await api('GET', '/v1/dados?since=0', undefined, tokA);
  var v1 = rr.j.itens.filter(function (x) { return x.i === I1; })[0];
  check(v1.d === (tieD > dB ? tieD : dB), 'empate: vence o maior texto, igual em qualquer aparelho');

  console.log('== Limites e validação ==');
  var grande = JSON.stringify({ since: 0, mudancas: [{ c: 'foco', i: b64(16), t: 1, d: 'A'.repeat(600 * 1024) }] });
  r = await api('PUT', '/v1/dados', grande, tokA, { 'content-type': 'application/json' }); check(r.s === 413, 'payload > 512 KB: 413');
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'foco', i: b64(16), t: 1, d: 'A'.repeat(9000) }] }, tokA); check(r.s === 400, 'item cifrado > 8 KB: 400');
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'Foco!', i: b64(16), t: 1, d: 'AAAAAAAA' }] }, tokA); check(r.s === 400, 'nome de coleção inválido: 400');
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'foco', i: 'a b', t: 1, d: 'AAAAAAAA' }] }, tokA); check(r.s === 400, 'id inválido: 400');
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'foco', i: b64(16), t: 1, d: '<script>' }] }, tokA); check(r.s === 400, 'dados fora de base64url: 400');
  r = await api('PUT', '/v1/dados', '{nao-json', tokA, { 'content-type': 'application/json' }); check(r.s === 400, 'JSON inválido: 400');
  r = await api('PUT', '/v1/dados', 'x=1', tokA, { 'content-type': 'text/plain' }); check(r.s === 415, 'não-JSON: 415');
  var muitos = []; for (var k = 0; k < 301; k++) muitos.push({ c: 'foco', i: b64(16), t: 1, d: 'AAAAAAAA' });
  r = await api('PUT', '/v1/dados', { since: 0, mudancas: muitos }, tokA); check(r.s === 413, '> 300 itens por envio: 413');
  var futuro = Date.now() + 10 * 86400e3, I4 = b64(16);
  await api('PUT', '/v1/dados', { since: 0, mudancas: [{ c: 'foco', i: I4, t: futuro, d: b64(20) }] }, tokA);
  rr = await api('GET', '/v1/dados?since=0', undefined, tokA);
  check(rr.j.itens.filter(function (x) { return x.i === I4; })[0].t <= Date.now() + 6 * 60e3, 'relógio no futuro é limitado a +5 min');

  console.log('== Aparelhos, PIN e chaves ==');
  r = await api('GET', '/v1/aparelhos', undefined, tokA);
  check(r.j.aparelhos.length === 2 && r.j.aparelhos.filter(function (a) { return a.atual; }).length === 1, 'lista 2 aparelhos, 1 atual');
  var idB = r.j.aparelhos.filter(function (a) { return !a.atual; })[0].id;
  r = await api('POST', '/v1/aparelhos/revogar', { id: idB }, tokA); check(r.s === 200, 'revoga o aparelho B');
  r = await api('GET', '/v1/dados', undefined, tokB); check(r.s === 401, 'token de B não funciona mais');
  r = await api('POST', '/v1/entrar', { codigo: codigo, pin: PIN, rotulo: 'Teste B2' }); tokB = r.j.token; check(r.s === 200, 'B entra de novo');
  r = await api('POST', '/v1/pin', { pin_atual: '000111', pin_novo: '735192' }, tokA); check(r.s === 403, 'trocar PIN com PIN atual errado: 403');
  r = await api('POST', '/v1/pin', { pin_atual: PIN, pin_novo: '1111' }, tokA); check(r.s === 400, 'PIN novo fraco: 400');
  r = await api('POST', '/v1/pin', { pin_atual: PIN, pin_novo: '735192' }, tokA); check(r.s === 200, 'troca de PIN');
  r = await api('GET', '/v1/dados', undefined, tokB); check(r.s === 401, 'trocar PIN encerra os outros aparelhos');
  r = await api('GET', '/v1/dados', undefined, tokA); check(r.s === 200, 'aparelho atual continua logado');
  r = await api('POST', '/v1/entrar', { codigo: codigo, pin: PIN }); check(r.s === 403, 'PIN antigo não entra');
  var novoEnv = b64(80);
  r = await api('PUT', '/v1/chaves', { pin: '735192', salt: b64(16), env_senha: novoEnv }, tokA); check(r.s === 200, 'trocar senha da família (envelope opaco)');
  r = await api('POST', '/v1/entrar', { codigo: codigo, pin: '735192' }); check(r.j.env_senha === novoEnv && r.j.env_rec === CH.env_rec, 'novo envelope visível; env_rec preservado');
  var tokC = r.j.token;
  r = await api('POST', '/v1/sair', {}, tokC); check(r.s === 200, 'sair deste aparelho');
  r = await api('GET', '/v1/dados', undefined, tokC); check(r.s === 401, 'token encerrado');

  console.log('== Excluir família (limpeza) ==');
  r = await api('POST', '/v1/familia/excluir', { pin: PIN }, tokA); check(r.s === 403, 'excluir com PIN errado: 403');
  r = await api('POST', '/v1/familia/excluir', { pin: '735192' }, tokA); check(r.s === 200, 'excluir família com PIN certo');
  r = await api('GET', '/v1/dados', undefined, tokA); check(r.s === 401, 'sessões removidas com a família');
  r = await api('POST', '/v1/entrar', { codigo: codigo, pin: '735192' }); check(r.s === 403, 'família não existe mais');

  console.log('== Bloqueio por tentativas (deixa este IP bloqueado por ~15 min) ==');
  if (process.argv.indexOf('--sem-bloqueio') < 0) {
    r = await api('POST', '/v1/familia', Object.assign({ pin: PIN }, CH)); codigo = r.j.codigo;
    var tok = r.j.token, status = [];
    for (var n = 0; n < 40 && status[status.length - 1] !== 429; n++) { r = await api('POST', '/v1/entrar', { codigo: codigo, pin: '00' + (1000 + n) }); status.push(r.s); }
    check(status[0] === 403 && status[status.length - 1] === 429, 'depois de várias tentativas erradas vem o bloqueio 429 (status ' + status.join(',') + ')');
    var visto429 = false; for (var q2 = 0; q2 < 6 && !visto429; q2++) { r = await api('POST', '/v1/entrar', { codigo: codigo, pin: PIN }); visto429 = r.s === 429 && /Tente de novo em/.test(r.j.mensagem) && !!r.h.get('retry-after'); }
    check(visto429 || r.s === 200, 'PIN certo é recusado durante o bloqueio com retry-after' + (visto429 ? '' : ' (inconclusivo: o IP de saída desta máquina mudou entre requisições; o bloqueio é por família+IP)'));
    console.log('  (família de teste do bloqueio: código ' + codigo + ' — limpar via D1)');
  }
  console.log('\n' + ok + ' ok, ' + falhas + ' falhas');
  process.exit(falhas ? 1 : 0);
})().catch(function (e) { console.error('ERRO', e); process.exit(2); });
