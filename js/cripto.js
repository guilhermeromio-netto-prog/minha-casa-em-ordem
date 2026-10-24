/* Minha Casa em Ordem — criptografia ponta a ponta (WebCrypto). Sem dependências.
   Modelo: uma chave-mestra aleatória (64 bytes: 32 AES-GCM + 32 HMAC) cifra cada item; ela fica "embrulhada" em dois envelopes:
   (1) pela chave derivada da SENHA DA FAMÍLIA (PBKDF2-SHA256, >= 300 mil iterações, sal aleatório) e
   (2) pela CHAVE DE RECUPERAÇÃO (aleatória, mostrada uma única vez). O servidor guarda só os envelopes (opacos).
   UMD: no navegador vira PS.cripto; no Node (testes) é module.exports. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(globalThis);
  else { raiz.PS = raiz.PS || {}; raiz.PS.cripto = fabrica(raiz); }
})(typeof window !== 'undefined' ? window : this, function (g) {
  'use strict';
  var subtle = (g.crypto && g.crypto.subtle) || null;
  var ITER_SENHA = 310000, ITER_REC = 100000;
  var ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   /* Crockford base32 */

  function aleatorio(n) { var b = new Uint8Array(n); g.crypto.getRandomValues(b); return b; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function deUtf8(b) { return new TextDecoder().decode(b); }
  function b64u(bytes) {
    var s = '', i; for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    var b = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deB64u(t) {
    t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
    var s = typeof atob === 'function' ? atob(t) : Buffer.from(t, 'base64').toString('binary');
    var b = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b;
  }
  function junta(a, b) { var r = new Uint8Array(a.length + b.length); r.set(a, 0); r.set(b, a.length); return r; }

  /* chave de recuperação: 16 bytes aleatórios => 26 caracteres, exibida em grupos de 4 */
  function novaRecuperacao() {
    var b = aleatorio(16), bits = '', i, out = '';
    for (i = 0; i < b.length; i++) bits += ('00000000' + b[i].toString(2)).slice(-8);
    while (bits.length % 5) bits += '0';
    for (i = 0; i < bits.length; i += 5) out += ALFA.charAt(parseInt(bits.substr(i, 5), 2));
    return out.match(/.{1,4}/g).join('-');
  }
  function normRecuperacao(t) {
    return String(t || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  }

  function derivarKek(texto, sal, iteracoes) {
    return subtle.importKey('raw', utf8(texto), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function selar(kek, bytes, aad) {
    var iv = aleatorio(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: aad }, kek, bytes).then(function (ct) { return b64u(junta(iv, new Uint8Array(ct))); });
  }
  function abrir(kek, texto, aad) {
    var b; try { b = deB64u(texto); } catch (e) { return Promise.reject(new Error('envelope_invalido')); }
    if (b.length < 28) return Promise.reject(new Error('envelope_invalido'));
    return subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12), additionalData: aad }, kek, b.slice(12)).then(function (pt) { return new Uint8Array(pt); }, function () { throw new Error('senha_errada'); });
  }
  var AAD_SENHA = utf8('painelsala/env/senha/v1'), AAD_REC = utf8('painelsala/env/rec/v1');
  function salRec(sal) { return junta(utf8('rec:'), sal); }

  /* mestre (64 bytes) -> chaves não extraíveis */
  function chavesDoMestre(m) {
    return Promise.all([
      subtle.importKey('raw', m.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']),
      subtle.importKey('raw', m.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    ]).then(function (k) { return { aes: k[0], hmac: k[1] }; });
  }
  function envelopes(mestre, senha, salB64, recTexto) {
    var sal = deB64u(salB64);
    return Promise.all([derivarKek(senha, sal, ITER_SENHA), derivarKek(normRecuperacao(recTexto), salRec(sal), ITER_REC)]).then(function (k) {
      return Promise.all([selar(k[0], mestre, AAD_SENHA), selar(k[1], mestre, AAD_REC)]);
    }).then(function (e) { return { env_senha: e[0], env_rec: e[1] }; });
  }

  /* Cria o cofre de uma família nova. Devolve também o mestre (só para uso imediato e descarte). */
  function novoCofre(senha) {
    var mestre = aleatorio(64), sal = b64u(aleatorio(16)), rec = novaRecuperacao();
    return envelopes(mestre, senha, sal, rec).then(function (e) {
      return chavesDoMestre(mestre).then(function (chaves) { return { salt: sal, env_senha: e.env_senha, env_rec: e.env_rec, recuperacao: rec, chaves: chaves }; });
    });
  }
  /* Abre com a senha; erro 'senha_errada' se não confere. Devolve chaves (e o mestre cru só se pedido). */
  function abrirComSenha(senha, salB64, envSenha, querMestre) {
    return derivarKek(senha, deB64u(salB64), ITER_SENHA).then(function (k) { return abrir(k, envSenha, AAD_SENHA); }).then(function (m) {
      return chavesDoMestre(m).then(function (c) { return querMestre ? { chaves: c, mestre: m } : c; });
    });
  }
  function abrirComRecuperacao(rec, salB64, envRec, querMestre) {
    return derivarKek(normRecuperacao(rec), salRec(deB64u(salB64)), ITER_REC).then(function (k) { return abrir(k, envRec, AAD_REC); }).then(function (m) {
      return chavesDoMestre(m).then(function (c) { return querMestre ? { chaves: c, mestre: m } : c; });
    });
  }
  /* Nova senha (e, opcionalmente, nova chave de recuperação) a partir do mestre já aberto. */
  function reembrulhar(mestre, novaSenha, salB64, novaRec) {
    var sal = salB64 || b64u(aleatorio(16)), rec = novaRec || novaRecuperacao();
    return envelopes(mestre, novaSenha, sal, rec).then(function (e) { return { salt: sal, env_senha: e.env_senha, env_rec: e.env_rec, recuperacao: rec }; });
  }

  /* Só a senha muda (mesmo sal): o envelope da chave de recuperação continua válido. */
  function reembrulharSenha(mestre, novaSenha, salB64) {
    return derivarKek(novaSenha, deB64u(salB64), ITER_SENHA).then(function (k) { return selar(k, mestre, AAD_SENHA); }).then(function (e) { return { salt: salB64, env_senha: e }; });
  }

  /* ---- itens ---- */
  function idOpaco(chaves, colecao, id) {
    return subtle.sign('HMAC', chaves.hmac, utf8(colecao + '|' + id)).then(function (s) { return b64u(new Uint8Array(s)).slice(0, 32); });
  }
  function cifrar(chaves, colecao, opaco, obj) {
    var iv = aleatorio(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(colecao + '|' + opaco) }, chaves.aes, utf8(JSON.stringify(obj))).then(function (ct) { return b64u(junta(iv, new Uint8Array(ct))); });
  }
  function decifrar(chaves, colecao, opaco, texto) {
    var b = deB64u(texto);
    return subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12), additionalData: utf8(colecao + '|' + opaco) }, chaves.aes, b.slice(12)).then(function (pt) { return JSON.parse(deUtf8(new Uint8Array(pt))); });
  }

  /* ---- guarda local das chaves (IndexedDB guarda CryptoKey não extraível) ---- */
  function bd() {
    return new Promise(function (ok, erro) {
      if (!g.indexedDB) return erro(new Error('sem_indexeddb'));
      var r = g.indexedDB.open('painelsala-chaves', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('k'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { erro(r.error || new Error('idb')); };
    });
  }
  function guardar(chaves) {
    return bd().then(function (db) { return new Promise(function (ok, erro) { var t = db.transaction('k', 'readwrite'); t.objectStore('k').put(chaves, 'atual'); t.oncomplete = function () { db.close(); ok(true); }; t.onerror = function () { erro(t.error); }; }); });
  }
  function ler() {
    return bd().then(function (db) { return new Promise(function (ok, erro) { var q = db.transaction('k', 'readonly').objectStore('k').get('atual'); q.onsuccess = function () { db.close(); ok(q.result || null); }; q.onerror = function () { erro(q.error); }; }); });
  }
  function esquecer() {
    return bd().then(function (db) { return new Promise(function (ok) { var t = db.transaction('k', 'readwrite'); t.objectStore('k').delete('atual'); t.oncomplete = function () { db.close(); ok(true); }; t.onerror = function () { ok(false); }; }); }, function () { return false; });
  }

  /* força da senha: só uma dica (não substitui o tamanho mínimo) */
  function forcaSenha(s) {
    s = String(s || ''); var pts = 0;
    if (s.length >= 8) pts++; if (s.length >= 12) pts++; if (s.length >= 16) pts++;
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) pts++;
    if (/\d/.test(s)) pts++; if (/[^A-Za-z0-9]/.test(s)) pts++;
    if (/^(.)\1+$/.test(s) || /^(12345678|password|senha123|qwertyui|11111111)/i.test(s)) pts = 0;
    var n = pts <= 2 ? 0 : pts <= 3 ? 1 : pts <= 4 ? 2 : 3;
    return { nivel: n, rotulo: ['Fraca', 'Razoável', 'Boa', 'Forte'][n], ok: s.length >= 8 && pts > 2 };
  }

  return {
    ITER_SENHA: ITER_SENHA, disponivel: !!subtle,
    novoCofre: novoCofre, abrirComSenha: abrirComSenha, abrirComRecuperacao: abrirComRecuperacao, reembrulhar: reembrulhar, reembrulharSenha: reembrulharSenha,
    idOpaco: idOpaco, cifrar: cifrar, decifrar: decifrar, guardar: guardar, ler: ler, esquecer: esquecer,
    forcaSenha: forcaSenha, novaRecuperacao: novaRecuperacao, normRecuperacao: normRecuperacao, b64u: b64u, deB64u: deB64u
  };
});
