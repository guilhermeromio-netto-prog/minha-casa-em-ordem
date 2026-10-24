/* Dados: localStorage versionado, sementes (dados.json), export/import JSON e link de configuração. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u;
  var CHAVE = 'painelsala.dados';
  var VERSAO = 1;
  var estado = null, ouvintes = [];

  var PADRAO_CONFIG = { cidade: 'Osasco, SP', lat: -23.5325, lon: -46.7917, fonte: 1, contraste: false, noiteAuto: true, escurecerMin: 10, nome: '' };
  var PRIORIDADES = ['alta', 'media', 'baixa'];

  function vazio() {
    return { app: 'painel-sala', versao: VERSAO, config: copia(PADRAO_CONFIG), habitos: [], listas: ['Casa', 'Trabalho', 'Maria Alice'], tarefas: [], compromissos: [], lembretes: [], contas: [], links: [], foco: [], checks: {} };
  }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function str(v, n) { return U.limitar(v == null ? '' : String(v).replace(/[\u0000-\u001f]/g, ' '), n || 120).trim(); }
  function num(v, a, b, d) { v = Number(v); return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; }
  function urlOk(u) { return typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u) && u.length <= 600; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function id(x) { return (x && typeof x.id === 'string' && x.id) ? x.id.slice(0, 20) : U.uid(); }

  /* Valida e normaliza QUALQUER objeto vindo de fora (import/backup/link) */
  function sanear(o) {
    var s = vazio();
    if (!o || typeof o !== 'object') return s;
    var c = o.config || {};
    s.config = {
      cidade: str(c.cidade, 80) || PADRAO_CONFIG.cidade,
      lat: num(c.lat, -90, 90, PADRAO_CONFIG.lat), lon: num(c.lon, -180, 180, PADRAO_CONFIG.lon),
      fonte: Math.round(num(c.fonte, 1, 3, 1)), contraste: !!c.contraste, noiteAuto: c.noiteAuto !== false,
      escurecerMin: Math.round(num(c.escurecerMin, 0, 120, 10)), nome: str(c.nome, 40)
    };
    s.habitos = arr(o.habitos).slice(0, 30).map(function (x) {
      return { id: id(x), nome: str(x.nome, 40) || 'Hábito', icone: PS.iconesLista.indexOf(x.icone) >= 0 ? x.icone : 'check', exemplo: !!x.exemplo };
    });
    s.listas = arr(o.listas).slice(0, 12).map(function (x) { return str(typeof x === 'string' ? x : (x && x.nome), 30); }).filter(Boolean);
    if (!s.listas.length) s.listas = ['Casa', 'Trabalho', 'Maria Alice'];
    s.tarefas = arr(o.tarefas).slice(0, 400).map(function (x) {
      return { id: id(x), lista: str(x.lista, 30) || s.listas[0], titulo: str(x.titulo, 120) || 'Tarefa', prio: PRIORIDADES.indexOf(x.prio) >= 0 ? x.prio : 'media', vence: U.dataValida(x.vence) ? x.vence : '', feita: !!x.feita, exemplo: !!x.exemplo };
    });
    s.compromissos = arr(o.compromissos).slice(0, 600).filter(function (x) { return U.dataValida(x.data); }).map(function (x) {
      return { id: id(x), titulo: str(x.titulo, 120) || 'Compromisso', data: x.data, hora: U.horaValida(x.hora) ? x.hora : '', local: str(x.local, 80), fonte: x.fonte === 'ics' ? 'ics' : 'manual', exemplo: !!x.exemplo };
    });
    s.lembretes = arr(o.lembretes).slice(0, 60).map(function (x) {
      var feitos = {}; if (x.feitos && typeof x.feitos === 'object') Object.keys(x.feitos).slice(0, 36).forEach(function (k) { if (/^\d{4}-\d{2}$/.test(k) && x.feitos[k]) feitos[k] = true; });
      return { id: id(x), titulo: str(x.titulo, 100) || 'Lembrete', dia: Math.round(num(x.dia, 1, 31, 1)), obs: str(x.obs, 160), feitos: feitos, exemplo: !!x.exemplo };
    });
    s.contas = arr(o.contas).slice(0, 80).map(function (x) {
      var pagas = {}; if (x.pagas && typeof x.pagas === 'object') Object.keys(x.pagas).slice(0, 36).forEach(function (k) { if (/^\d{4}-\d{2}$/.test(k) && x.pagas[k]) pagas[k] = true; });
      var v = (x.valor === '' || x.valor == null) ? null : num(x.valor, 0, 1e9, null);
      return { id: id(x), titulo: str(x.titulo, 80) || 'Conta', mensal: x.mensal !== false, dia: Math.round(num(x.dia, 1, 31, 1)), data: U.dataValida(x.data) ? x.data : '', valor: v, paga: !!x.paga, pagas: pagas, exemplo: !!x.exemplo };
    });
    s.links = arr(o.links).slice(0, 40).filter(function (x) { return urlOk(x.url); }).map(function (x) {
      return { id: id(x), titulo: str(x.titulo, 40) || 'Link', url: x.url, icone: PS.iconesLista.indexOf(x.icone) >= 0 ? x.icone : 'globo', exemplo: !!x.exemplo };
    });
    s.foco = arr(o.foco).slice(0, 60).map(function (x) { return { id: id(x), texto: str(typeof x === 'string' ? x : x.texto, 140), exemplo: !!(x && x.exemplo) }; }).filter(function (x) { return x.texto; });
    if (o.checks && typeof o.checks === 'object') {
      Object.keys(o.checks).forEach(function (k) {
        if (U.dataValida(k) && Array.isArray(o.checks[k])) s.checks[k] = o.checks[k].filter(function (v) { return typeof v === 'string'; }).slice(0, 40);
      });
    }
    return s;
  }

  /* Migrações futuras: migracoes[N] converte do schema N para N+1 */
  var migracoes = {};
  function migrar(o) {
    var v = (o && o.versao) || 1;
    while (v < VERSAO && migracoes[v]) { o = migracoes[v](o); v++; o.versao = v; }
    return o;
  }

  function persistir() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); return true; } catch (e) { PS.aviso && PS.aviso('Não foi possível salvar neste navegador'); return false; }
  }
  function notificar() { ouvintes.slice().forEach(function (f) { try { f(estado); } catch (e) { console.error(e); } }); }

  /* Converte a semente (dados.json, com "dias" relativos) em estado real */
  function semear(seed) {
    var hoje = U.hoje();
    var o = copia(seed);
    o.tarefas = arr(o.tarefas).map(function (t) { t.vence = t.dias == null ? '' : U.somaDias(hoje, t.dias); return t; });
    o.compromissos = arr(o.compromissos).map(function (c) { c.data = U.somaDias(hoje, c.dias || 0); return c; });
    o.contas = arr(o.contas).map(function (c) { var d = U.somaDias(hoje, c.diasAteVencer || 0); c.dia = +d.slice(8, 10); return c; });
    var s = sanear(o); s.checks = {};
    var m0 = U.ym(hoje), d0 = +hoje.slice(8);
    s.contas.forEach(function (c) { if (c.mensal && c.exemplo && c.dia < d0) c.pagas[m0] = true; });       /* exemplos não nascem "atrasados" */
    s.lembretes.forEach(function (l) { if (l.exemplo && l.dia < d0) l.feitos[m0] = true; });
    return s;
  }

  var store = {
    VERSAO: VERSAO,
    iniciar: function (urlSemente) {
      var bruto = null;
      try { bruto = localStorage.getItem(CHAVE); } catch (e) { /* modo privado */ }
      if (bruto) {
        try { estado = sanear(migrar(JSON.parse(bruto))); return Promise.resolve(estado); } catch (e) { console.warn('Dados corrompidos; recriando', e); }
      }
      return fetch(urlSemente || 'dados.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
        .then(function (seed) { estado = semear(seed); }, function () { estado = vazio(); })
        .then(function () { persistir(); return estado; });
    },
    get: function () { return estado; },
    /* altera e salva; quem chama pode passar silencioso=true para não re-renderizar */
    alterar: function (fn, silencioso) { fn(estado); persistir(); if (!silencioso) notificar(); },
    aoMudar: function (f) { ouvintes.push(f); return function () { ouvintes = ouvintes.filter(function (x) { return x !== f; }); }; },
    substituir: function (o, mantemChecks) {
      var checks = estado ? estado.checks : {};
      estado = sanear(migrar(o));
      if (mantemChecks) estado.checks = checks;
      persistir(); notificar();
    },
    apagarTudo: function (urlSemente) {
      return fetch(urlSemente || 'dados.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
        .then(function (seed) { estado = semear(seed); }, function () { estado = vazio(); })
        .then(function () { persistir(); notificar(); });
    },
    limparExemplos: function () {
      store.alterar(function (s) {
        ['habitos', 'tarefas', 'compromissos', 'lembretes', 'contas', 'links', 'foco'].forEach(function (k) { s[k] = s[k].filter(function (x) { return !x.exemplo; }); });
      });
    },
    temExemplos: function () {
      var s = estado; return ['habitos', 'tarefas', 'compromissos', 'lembretes', 'contas', 'links', 'foco'].some(function (k) { return s[k].some(function (x) { return x.exemplo; }); });
    },
    /* ---- backup JSON ---- */
    exportarJSON: function () { return JSON.stringify({ app: 'painel-sala', versao: VERSAO, exportadoEm: new Date().toISOString(), dados: estado }, null, 2); },
    lerBackup: function (texto) {
      var o = JSON.parse(texto);
      if (!o || typeof o !== 'object') throw new Error('Arquivo inválido');
      var d = o.dados || o;
      if (o.app && o.app !== 'painel-sala') throw new Error('Este arquivo não é do Painel da Sala');
      if ((o.versao || d.versao || 1) > VERSAO) throw new Error('Backup de uma versão mais nova do app');
      return d;
    },
    /* ---- link de configuração (#/importar/<base64url>) ---- */
    montarPayload: function () {
      var s = copia(estado);
      delete s.checks;
      s.tarefas = s.tarefas.filter(function (t) { return !t.feita; });
      ['habitos', 'tarefas', 'compromissos', 'lembretes', 'contas', 'links', 'foco'].forEach(function (k) {
        s[k] = s[k].map(function (x) { delete x.exemplo; if (k !== 'habitos') delete x.id; if (k === 'tarefas') delete x.feita; if (k === 'compromissos' && x.fonte === 'manual') delete x.fonte; return x; });
      });
      s.contas.forEach(function (c) { if (c.valor === null) delete c.valor; if (!c.data) delete c.data; if (!c.paga) delete c.paga; if (c.pagas && !Object.keys(c.pagas).length) delete c.pagas; });
      s.lembretes.forEach(function (c) { if (c.feitos && !Object.keys(c.feitos).length) delete c.feitos; if (!c.obs) delete c.obs; });
      return s;
    },
    gerarLink: function () {
      var json = JSON.stringify(store.montarPayload());
      var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      var base = location.href.split('#')[0];
      var link = base + '#/importar/' + b64;
      return { link: link, tamanho: link.length, jsonBytes: json.length };
    },
    lerLink: function (b64) {
      var t = b64.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
      var o = JSON.parse(decodeURIComponent(escape(atob(t))));
      return o;
    },
    sanear: sanear,
    /* ---- hábitos ---- */
    habitoFeito: function (hid, iso) { return (estado.checks[iso] || []).indexOf(hid) >= 0; },
    alternarHabito: function (hid, iso) {
      store.alterar(function (s) {
        var l = s.checks[iso] || (s.checks[iso] = []); var i = l.indexOf(hid);
        if (i >= 0) l.splice(i, 1); else l.push(hid);
        if (!l.length) delete s.checks[iso];
        var corte = U.somaDias(U.hoje(), -400);
        Object.keys(s.checks).forEach(function (k) { if (k < corte) delete s.checks[k]; });
      });
    },
    sequencia: function (hid) {
      var d = U.hoje(); if (!store.habitoFeito(hid, d)) d = U.somaDias(d, -1);
      var n = 0; while (n < 3650 && store.habitoFeito(hid, d)) { n++; d = U.somaDias(d, -1); }
      return n;
    }
  };
  PS.store = store;
})(window);
