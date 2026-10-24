/* Tela #/sincronizar: criar a família, entrar com código + PIN + senha, e gerenciar a conexão. Teclado numérico na tela. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u, h = U.h, S = PS.store, I = PS.icone;
  var passo = '', F = {}, ocupado = false, erroMsg = '', recuperacaoUnica = '', lista = null, carregandoLista = false;
  var teclasAtivo = null;

  /* ---------- teclado numérico (D-pad / toque / teclado físico) ---------- */
  function teclado(op) {
    var valor = op.valor || '', max = op.max || 8;
    var visor = h('div', { class: 'visor', role: 'status', 'aria-live': 'polite', 'aria-label': op.rotulo });
    function pintar() {
      var t = '';
      if (op.mascarar) { for (var i = 0; i < Math.max(valor.length, op.min || 4); i++) t += i < valor.length ? '●' : '○'; }
      else { t = valor.replace(/(\d{4})(?=\d)/g, '$1 '); if (!t) t = '— — — —'; }
      visor.textContent = t;
    }
    function dig(d) { if (valor.length < max) { valor += d; pintar(); op.aoMudar && op.aoMudar(valor); } }
    function apagar() { valor = valor.slice(0, -1); pintar(); op.aoMudar && op.aoMudar(valor); }
    function ok() { if (valor.length < (op.min || 1)) { PS.aviso('Faltam dígitos (mínimo ' + (op.min || 1) + ')'); return; } op.aoOk(valor); }
    var teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'apagar', '0', 'ok'].map(function (k) {
      var rot = k === 'apagar' ? '⌫' : k === 'ok' ? 'OK' : k;
      return h('button', { type: 'button', class: 'tecla' + (k === 'ok' ? ' tecla-ok' : ''), 'data-fid': 'tk:' + k, 'aria-label': k === 'apagar' ? 'Apagar' : k === 'ok' ? 'Confirmar' : k,
        onclick: function () { if (k === 'apagar') apagar(); else if (k === 'ok') ok(); else dig(k); } }, rot);
    });
    teclasAtivo = function (e) {
      var k = e.key;
      if (/^\d$/.test(k || '') && !e.shiftKey) { dig(k); e.preventDefault(); return true; }
      if (k === 'Backspace' || e.keyCode === 8) { apagar(); e.preventDefault(); return true; }
      return false;
    };
    pintar();
    return h('div', { class: 'teclado-caixa' }, visor, h('div', { class: 'teclado', role: 'group', 'aria-label': 'Teclado numérico' }, teclas));
  }
  PS.capturaTecla = function (e) {
    if (PS.rotaAtual !== 'sincronizar' && !(PS.bloqueio && PS.bloqueio.aberto())) { teclasAtivo = null; return false; }
    var a = e.target; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    return teclasAtivo ? teclasAtivo(e) : false;
  };
  PS.ui = PS.ui || {}; PS.ui.teclado = teclado;
  PS.ui.setTeclas = function (f) { teclasAtivo = f; };

  function agrupar(c) { return String(c || '').replace(/(\d{4})(?=\d)/g, '$1 '); }
  function ir(p, msg) { passo = p; erroMsg = msg || ''; ocupado = false; PS.redesenhar(); setTimeout(function () { PS.nav.focarPrimeiro(); }, 30); }
  function falha(e, voltarPara) {
    ocupado = false;
    var m = (e && e.message) || 'Algo deu errado.';
    if (e && e.message === 'senha_errada') m = 'Senha da família incorreta.';
    if (e && e.message === 'envelope_invalido') m = 'Dados de segurança inválidos. Confira o código.';
    PS.aviso(m); ir(voltarPara || passo, m);
  }
  function campoSenha(id, rotulo, dica, extra) {
    return h('label', { class: 'campo' }, h('span', null, rotulo), h('input', { type: 'password', id: id, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: dica || null, 'data-fid': 'in:' + id }));
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function msgErro() { return erroMsg ? h('p', { class: 'nota aviso', role: 'alert' }, erroMsg) : null; }

  /* ---------- telas ---------- */
  var T = {};
  T.inicio = function () {
    if (!PS.cripto || !PS.cripto.disponivel) return h('div', { class: 'cartao' }, h('h2', null, 'Criptografia indisponível'), h('p', { class: 'nota aviso' }, 'Este navegador não oferece WebCrypto (precisa de https). A sincronização protegida não pode ser usada aqui; o painel continua funcionando só neste aparelho.'));
    return h('div', null,
      h('div', { class: 'cartao' }, h('h2', null, 'Compartilhar com a família'),
        h('p', { class: 'nota' }, 'Mantém o seu celular e o celular da sua esposa com os MESMOS dados. Tudo é cifrado neste aparelho antes de sair: o servidor guarda só texto ilegível.'),
        h('p', { class: 'nota' }, 'São três segredos diferentes: o ', h('b', null, 'código da família'), ' (8 números, identifica a família), o ', h('b', null, 'PIN'), ' (4 a 8 números, deixa um aparelho entrar) e a ', h('b', null, 'senha da família'), ' (cifra os dados; o servidor nunca a recebe).'),
        h('p', { class: 'nota aviso' }, 'Se perder a senha E a chave de recuperação, ninguém consegue recuperar os dados da nuvem — nem eu, nem a Cloudflare. Os dados deste aparelho continuam aqui.'),
        h('div', { class: 'acoes' },
          h('button', { class: 'btn primario', type: 'button', 'data-fid': 'sy:criar', onclick: function () { F = {}; ir('c-pin'); } }, 'Criar a família (primeiro aparelho)'),
          h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:entrar', onclick: function () { F = {}; ir('e-codigo'); } }, 'Entrar numa família que já existe'))),
      h('p', { class: 'nota' }, 'Dica: crie a família no seu celular e entre no outro aparelho usando o código, o PIN e a senha.'));
  };
  function tituloPasso(t, sub) { return [h('h2', { class: 'passo-titulo' }, t), sub ? h('p', { class: 'nota' }, sub) : null]; }
  T['c-pin'] = function () {
    return h('div', { class: 'cartao' }, tituloPasso('1 de 3 · Escolha um PIN', 'De 4 a 8 números. Evite 1234 ou 0000 (o servidor recusa). O PIN autoriza um aparelho novo a entrar; ele NÃO cifra os dados.'), msgErro(),
      teclado({ rotulo: 'PIN', mascarar: true, min: 4, max: 8, aoOk: function (v) { if (/^(\d)\1+$/.test(v) || '01234567890123456789'.indexOf(v) >= 0 || '98765432109876543210'.indexOf(v) >= 0) { PS.aviso('PIN fácil demais. Escolha outro.'); return; } F.pin = v; ir('c-pin2'); } }),
      h('div', { class: 'acoes' }, h('button', { class: 'btn', type: 'button', onclick: function () { ir('inicio'); } }, 'Cancelar')));
  };
  T['c-pin2'] = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Repita o PIN'), msgErro(),
      teclado({ rotulo: 'Repita o PIN', mascarar: true, min: 4, max: 8, aoOk: function (v) { if (v !== F.pin) { F.pin = ''; ir('c-pin', 'Os PINs não conferem. Comece de novo.'); return; } ir('c-senha'); } }),
      h('div', { class: 'acoes' }, h('button', { class: 'btn', type: 'button', onclick: function () { ir('c-pin'); } }, 'Voltar')));
  };
  T['c-senha'] = function () {
    var forca = h('p', { class: 'nota', 'aria-live': 'polite', id: 'forca' }, 'Mínimo 8 caracteres. Uma frase de 3–4 palavras é forte e fácil de lembrar.');
    function atualiza() { var f = PS.cripto.forcaSenha(val('s1')); forca.textContent = 'Força: ' + f.rotulo + (f.ok ? '' : ' — escolha algo mais longo/variado'); forca.className = 'nota' + (f.ok ? '' : ' aviso'); }
    var s1 = campoSenha('s1', 'Senha da família', 'ex.: gato azul cafe 2026'), s2 = campoSenha('s2', 'Repita a senha');
    s1.querySelector('input').addEventListener('input', atualiza);
    return h('div', { class: 'cartao' }, tituloPasso('2 de 3 · Senha da família', 'Esta senha cifra tudo neste aparelho e nunca é enviada ao servidor. Ela é diferente do PIN. Todos os aparelhos precisam dela para ler os dados.'), msgErro(), s1, s2, forca,
      h('p', { class: 'nota aviso' }, 'Se esquecer a senha, a única saída é a chave de recuperação (mostrada a seguir, uma única vez).'),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn primario', type: 'button', 'data-fid': 'sy:criarfam', disabled: ocupado ? 'disabled' : null, onclick: function () {
          var a = val('s1'), b = val('s2'), f = PS.cripto.forcaSenha(a);
          if (a.length < 8) { PS.aviso('A senha precisa de pelo menos 8 caracteres.'); return; }
          if (!f.ok) { PS.aviso('Senha fraca: use mais caracteres ou misture letras e números.'); return; }
          if (a !== b) { PS.aviso('As senhas não conferem.'); return; }
          ocupado = true; PS.aviso('Gerando chaves e criando a família…'); var bt = this; bt.disabled = true;
          PS.sync.criar(F.pin, a).then(function (r) { F = { codigo: r.codigo, guardou: r.guardouChaves }; recuperacaoUnica = r.recuperacao; ir('c-feito'); }, function (e) { falha(e, 'c-senha'); });
        } }, ocupado ? 'Criando…' : 'Criar a família'),
        h('button', { class: 'btn', type: 'button', onclick: function () { ir('c-pin2'); } }, 'Voltar')));
  };
  T['c-feito'] = function () {
    var chk = h('input', { type: 'checkbox', id: 'anotei', 'data-fid': 'sy:anotei' }), bt = h('button', { class: 'btn primario', type: 'button', disabled: 'disabled', 'data-fid': 'sy:concluir', onclick: function () { recuperacaoUnica = ''; F = {}; ir('conectado'); } }, 'Concluir');
    chk.addEventListener('change', function () { bt.disabled = !chk.checked; });
    return h('div', { class: 'cartao' }, tituloPasso('3 de 3 · Família criada', 'Anote agora. A chave de recuperação aparece só desta vez.'),
      h('div', { class: 'segredo' }, h('span', { class: 'rot' }, 'Código da família'), h('b', { class: 'codigo-grande', id: 'cod' }, agrupar(F.codigo))),
      h('div', { class: 'segredo' }, h('span', { class: 'rot' }, 'Chave de recuperação (só aparece agora)'), h('b', { class: 'chave', id: 'rec' }, recuperacaoUnica)),
      h('p', { class: 'nota' }, 'Para outro aparelho entrar: código + PIN + senha da família. Guarde a chave de recuperação num lugar seguro (papel, gerenciador de senhas): ela abre os dados se você esquecer a senha.'),
      h('p', { class: 'nota aviso' }, 'Perdendo a senha E a chave de recuperação, os dados da nuvem NÃO podem ser recuperados.'),
      F.guardou === false ? h('p', { class: 'nota aviso' }, 'Este navegador não guardou a chave de criptografia (modo privado?). Será preciso digitar a senha a cada abertura.') : null,
      h('div', { class: 'acoes' }, h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:bkp0', onclick: function () { PS.sync.exportarCifrado().then(function (t) { PS.arq.baixar('minha-casa-backup-cifrado-' + U.hoje() + '.json', t, 'application/json'); PS.aviso('Backup cifrado baixado'); }, function (e) { PS.aviso(e.message); }); } }, 'Baixar backup cifrado agora')),
      h('label', { class: 'campo marcar' }, chk, h('span', null, 'Anotei o código e a chave de recuperação')), h('div', { class: 'acoes' }, bt));
  };
  T['e-codigo'] = function () {
    return h('div', { class: 'cartao' }, tituloPasso('1 de 3 · Código da família', 'Os 8 números mostrados no aparelho onde a família foi criada (Gerenciar → Sincronização).'), msgErro(),
      teclado({ rotulo: 'Código da família', min: 8, max: 8, aoOk: function (v) { F.codigo = v; ir('e-pin'); } }),
      h('div', { class: 'acoes' }, h('button', { class: 'btn', type: 'button', onclick: function () { ir('inicio'); } }, 'Cancelar')));
  };
  T['e-pin'] = function () {
    return h('div', { class: 'cartao' }, tituloPasso('2 de 3 · PIN'), msgErro(),
      teclado({ rotulo: 'PIN', mascarar: true, min: 4, max: 8, aoOk: function (v) { F.pin = v; ir('e-senha'); } }),
      h('div', { class: 'acoes' }, h('button', { class: 'btn', type: 'button', onclick: function () { ir('e-codigo'); } }, 'Voltar')));
  };
  T['e-senha'] = function () {
    var rec = !!F.usaRec;
    return h('div', { class: 'cartao' }, tituloPasso('3 de 3 · ' + (rec ? 'Chave de recuperação' : 'Senha da família'), rec ? 'Digite a chave de 26 letras e números (os traços são opcionais).' : 'A senha que cifra os dados. Ela não é enviada ao servidor.'), msgErro(),
      rec ? h('label', { class: 'campo' }, h('span', null, 'Chave de recuperação'), h('input', { type: 'text', id: 'seg', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'data-fid': 'in:seg' })) : campoSenha('seg', 'Senha da família'),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn primario', type: 'button', 'data-fid': 'sy:entrarfam', disabled: ocupado ? 'disabled' : null, onclick: function () {
          var s = val('seg'); if (!s) { PS.aviso('Digite para continuar.'); return; }
          ocupado = true; this.disabled = true; PS.aviso('Entrando… (a derivação da chave leva alguns segundos)');
          PS.sync.entrar(F.codigo, F.pin, s, rec).then(function (r) {
            if (!r.temDadosLocais) return PS.sync.confirmarEntrada('juntar').then(function () { F = {}; ir('conectado'); });
            ir('e-modo');
          }, function (e) {
            var m = e.message === 'senha_errada' ? 'Senha incorreta.' : e.message; ocupado = false;
            if (e.status === 403 || e.status === 429 || e.rede) { F.pin = ''; ir(e.status === 403 ? 'e-codigo' : 'e-senha', m); } else ir('e-senha', m);
          });
        } }, ocupado ? 'Entrando…' : 'Entrar'),
        h('button', { class: 'btn', type: 'button', onclick: function () { F.usaRec = !F.usaRec; ir('e-senha'); } }, rec ? 'Usar a senha' : 'Esqueci a senha: usar chave de recuperação'),
        h('button', { class: 'btn', type: 'button', onclick: function () { ir('e-pin'); } }, 'Voltar')));
  };
  T['e-modo'] = function () {
    function seguir(modo) { ocupado = true; PS.aviso('Sincronizando…'); PS.sync.confirmarEntrada(modo).then(function () { F = {}; ir('conectado'); }, function (e) { falha(e, 'e-modo'); }); }
    return h('div', { class: 'cartao' }, tituloPasso('Este aparelho já tem dados', 'Como combinar com os dados da família?'),
      h('div', { class: 'acoes', style: 'flex-direction:column;align-items:stretch' },
        h('button', { class: 'btn primario', type: 'button', 'data-fid': 'sy:juntar', onclick: function () { seguir('juntar'); } }, 'Juntar os dados deste aparelho com a família (recomendado)'),
        h('p', { class: 'nota' }, 'Itens novos daqui são enviados; itens com o mesmo identificador que já existem na família ficam como estão na família. Nada é apagado.'),
        h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:familia', onclick: function () {
          PS.modal.abrir('Descartar os dados deste aparelho?', h('p', null, 'Os dados que estão só neste aparelho serão apagados e substituídos pelos da família. Faça um backup antes se tiver dúvida.'), [{ rotulo: 'Descartar e usar os da família', tipo: 'perigo', acao: function () { seguir('familia'); } }, { rotulo: 'Voltar' }]);
        } }, 'Usar só os dados da família (descarta os deste aparelho)'),
        h('button', { class: 'btn', type: 'button', onclick: function () { PS.sync.cancelarEntrada().then(function () { F = {}; ir('inicio'); }); } }, 'Cancelar')));
  };
  T.bloqueado = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Digite a senha da família', 'Este navegador não guardou a chave de criptografia. A senha fica só na memória.'), msgErro(), campoSenha('seg', 'Senha da família'),
      h('div', { class: 'acoes' }, h('button', { class: 'btn primario', type: 'button', 'data-fid': 'sy:desb', onclick: function () { PS.aviso('Abrindo…'); PS.sync.desbloquear(val('seg')).then(function () { ir('conectado'); }, function (e) { falha({ message: e.message === 'senha_errada' ? 'Senha incorreta.' : e.message }, 'bloqueado'); }); } }, 'Desbloquear'),
        h('button', { class: 'btn perigo', type: 'button', onclick: function () { PS.sync.sair().then(function () { ir('inicio'); }); } }, 'Sair deste aparelho')));
  };
  function pinInput(id, rotulo) { return h('label', { class: 'campo' }, h('span', null, rotulo), h('input', { type: 'password', id: id, inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', autocomplete: 'off', 'data-fid': 'in:' + id })); }
  T.pinNovo = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Trocar o PIN', 'Os outros aparelhos serão desconectados e precisarão entrar de novo com o PIN novo.'), msgErro(), pinInput('p0', 'PIN atual'), pinInput('p1', 'PIN novo (4 a 8 números)'), pinInput('p2', 'Repita o PIN novo'),
      h('div', { class: 'acoes' }, h('button', { class: 'btn primario', type: 'button', onclick: function () {
        if (val('p1') !== val('p2')) { PS.aviso('Os PINs novos não conferem.'); return; }
        PS.sync.trocarPin(val('p0'), val('p1')).then(function () { PS.aviso('PIN trocado'); ir('conectado'); }, function (e) { falha(e, 'pinNovo'); });
      } }, 'Trocar PIN'), h('button', { class: 'btn', type: 'button', onclick: function () { ir('conectado'); } }, 'Voltar')));
  };
  T.senhaNova = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Trocar a senha da família', 'Os dados não precisam ser recifrados. Os outros aparelhos já conectados continuam funcionando; novos aparelhos usarão a senha nova.'), msgErro(), pinInput('p0', 'PIN'), campoSenha('s0', 'Senha atual'), campoSenha('s1', 'Senha nova (mín. 8)'), campoSenha('s2', 'Repita a senha nova'),
      h('div', { class: 'acoes' }, h('button', { class: 'btn primario', type: 'button', onclick: function () {
        var n = val('s1'); if (n.length < 8 || !PS.cripto.forcaSenha(n).ok) { PS.aviso('Senha nova fraca ou curta.'); return; } if (n !== val('s2')) { PS.aviso('As senhas novas não conferem.'); return; }
        PS.aviso('Trocando…'); PS.sync.trocarSenha(val('p0'), val('s0'), n).then(function () { PS.aviso('Senha trocada'); ir('conectado'); }, function (e) { falha({ message: e.message === 'senha_errada' ? 'Senha atual incorreta.' : e.message }, 'senhaNova'); });
      } }, 'Trocar senha'), h('button', { class: 'btn', type: 'button', onclick: function () { ir('conectado'); } }, 'Voltar')));
  };
  T.recNova = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Gerar nova chave de recuperação', 'A chave antiga deixa de funcionar. A nova aparece uma única vez.'), msgErro(), pinInput('p0', 'PIN'), campoSenha('s0', 'Senha da família'),
      h('div', { class: 'acoes' }, h('button', { class: 'btn primario', type: 'button', onclick: function () {
        PS.aviso('Gerando…'); PS.sync.novaRecuperacao(val('p0'), val('s0')).then(function (r) { recuperacaoUnica = r; F = { codigo: PS.sync.estado().codigo, guardou: true }; ir('c-feito'); }, function (e) { falha({ message: e.message === 'senha_errada' ? 'Senha incorreta.' : e.message }, 'recNova'); });
      } }, 'Gerar'), h('button', { class: 'btn', type: 'button', onclick: function () { ir('conectado'); } }, 'Voltar')));
  };
  T.excluir = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Excluir a família do servidor', 'Apaga TODOS os dados cifrados da nuvem e desconecta todos os aparelhos. Os dados que estão neste aparelho continuam aqui.'), msgErro(), pinInput('p0', 'PIN'),
      h('div', { class: 'acoes' }, h('button', { class: 'btn perigo', type: 'button', onclick: function () {
        PS.modal.abrir('Excluir a família?', h('p', null, 'Isto não pode ser desfeito.'), [{ rotulo: 'Excluir da nuvem', tipo: 'perigo', acao: function () { PS.sync.excluirFamilia(val('p0')).then(function () { PS.aviso('Família excluída'); ir('inicio'); }, function (e) { falha(e, 'excluir'); }); } }, { rotulo: 'Cancelar' }]);
      } }, 'Excluir da nuvem'), h('button', { class: 'btn', type: 'button', onclick: function () { ir('conectado'); } }, 'Voltar')));
  };
  T.importarCif = function () {
    return h('div', { class: 'cartao' }, tituloPasso('Restaurar backup cifrado', 'Escolha o arquivo .json cifrado e digite a senha (ou a chave de recuperação) da época do backup.'), msgErro(),
      h('label', { class: 'campo' }, h('span', null, 'Senha da família ou chave de recuperação'), h('input', { type: 'password', id: 'seg', autocomplete: 'off', 'data-fid': 'in:seg' })),
      h('div', { class: 'acoes' }, h('button', { class: 'btn primario', type: 'button', onclick: function () {
        var seg = val('seg'); if (!seg) { PS.aviso('Digite a senha ou a chave.'); return; }
        PS.arq.escolher('.json,application/json', function (txt) {
          var rec = /^[0-9A-Za-z]{4}(-?[0-9A-Za-z]{4}){5}-?[0-9A-Za-z]{2}$/.test(seg.replace(/\s/g, '')) && seg.replace(/[-\s]/g, '').length === 26;
          PS.aviso('Abrindo o backup…');
          PS.sync.lerBackupCifrado(txt, seg, rec).then(function (dados) {
            var aviso = PS.sync.ativo() ? 'Isto SUBSTITUI os dados deste aparelho e, como a sincronização está ligada, também os da família em todos os aparelhos (itens que não estão no backup serão apagados em todos).' : 'Isto SUBSTITUI os dados deste aparelho.';
            PS.modal.abrir('Restaurar backup?', h('p', null, aviso), [{ rotulo: 'Restaurar', tipo: 'perigo', acao: function () { S.substituir(dados, false); PS.aplicarConfig(); PS.aviso('Backup restaurado'); ir('conectado'); } }, { rotulo: 'Cancelar' }]);
          }, function (e) { falha({ message: e.message === 'senha_errada' ? 'Senha ou chave incorreta para este backup.' : e.message }, 'importarCif'); });
        });
      } }, 'Escolher arquivo'), h('button', { class: 'btn', type: 'button', onclick: function () { ir('conectado'); } }, 'Voltar')));
  };

  function agoraRel(ms) { if (!ms) return 'nunca'; var s = Math.round((Date.now() - ms) / 1000); return s < 10 ? 'agora' : s < 60 ? 'há ' + s + ' s' : s < 3600 ? 'há ' + Math.round(s / 60) + ' min' : 'há ' + Math.round(s / 3600) + ' h'; }
  function quando(ms) { if (!ms) return '—'; var a = U.agora(new Date(ms)); return U.dataCurta(a.iso) + ' ' + a.hhmm; }

  T.conectado = function () {
    var e = PS.sync.estado();
    var painel = h('div', { class: 'status-sync ' + e.nivel, id: 'painel-status' });
    function pintar(x) { U.limpar(painel); painel.className = 'status-sync ' + x.nivel; painel.appendChild(h('span', { class: 'ic-status' }, I(x.nivel === 'ok' ? 'check' : x.nivel === 'perigo' ? 'alerta' : 'relogio'))); painel.appendChild(h('span', null, x.rotulo)); }
    pintar(e);
    var off = PS.sync.aoMudar(function (x) { if (!document.contains(painel)) { off(); return; } pintar(x); });
    var aps = h('div', { id: 'aps' });
    function listar() {
      U.limpar(aps); aps.appendChild(h('p', { class: 'nota' }, 'Carregando…'));
      PS.sync.aparelhos().then(function (l) {
        U.limpar(aps);
        l.forEach(function (a) {
          aps.appendChild(h('div', { class: 'ap-linha' }, h('span', { class: 't' }, a.rotulo + (a.atual ? ' (este aparelho)' : '')), h('span', { class: 'meta' }, 'entrou ' + quando(a.criada_em) + ' · visto ' + quando(a.ultimo_uso)),
            a.atual ? null : h('button', { class: 'btn perigo', type: 'button', onclick: function () { PS.sync.revogar(a.id).then(function () { PS.aviso('Aparelho desconectado'); listar(); }, function (er) { PS.aviso(er.message); }); } }, 'Desconectar')));
        });
        if (!l.length) aps.appendChild(h('p', { class: 'vazio' }, 'Nenhum aparelho.'));
      }, function (er) { U.limpar(aps); aps.appendChild(h('p', { class: 'nota aviso' }, er.status === 401 ? 'Sessão encerrada: entre de novo.' : er.message)); });
    }
    return h('div', null,
      h('div', { class: 'cartao' }, h('h2', null, 'Família conectada'), painel,
        h('div', { class: 'segredo' }, h('span', { class: 'rot' }, 'Código da família'), h('b', { class: 'codigo-grande' }, agrupar(e.codigo))),
        h('p', { class: 'nota' }, 'Este aparelho: ' + e.aparelho + ' · última sincronização completa: ' + quando(e.ultimaOk)),
        h('p', { class: 'nota' }, 'Para outro aparelho entrar: Gerenciar → Sincronização → “Entrar numa família”, com este código, o PIN e a senha da família.'),
        h('div', { class: 'acoes' }, h('button', { class: 'btn primario', type: 'button', 'data-fid': 'sy:agora', onclick: function () { PS.aviso('Sincronizando…'); PS.sync.sincronizarAgora(); } }, 'Sincronizar agora'))),
      h('div', { class: 'cartao' }, h('h2', null, 'Aparelhos conectados'), aps, h('div', { class: 'acoes' }, h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:aps', onclick: listar }, 'Ver aparelhos'))),
      h('div', { class: 'cartao' }, h('h2', null, 'Segurança e backup'),
        h('div', { class: 'acoes' },
          h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:bkp', onclick: function () { PS.sync.exportarCifrado().then(function (t) { PS.arq.baixar('minha-casa-backup-cifrado-' + U.hoje() + '.json', t, 'application/json'); PS.aviso('Backup cifrado baixado'); }, function (er) { PS.aviso(er.message); }); } }, 'Baixar backup cifrado'),
          h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:rest', onclick: function () { ir('importarCif'); } }, 'Restaurar backup cifrado'),
          h('button', { class: 'btn', type: 'button', onclick: function () { ir('pinNovo'); } }, 'Trocar PIN'),
          h('button', { class: 'btn', type: 'button', onclick: function () { ir('senhaNova'); } }, 'Trocar senha da família'),
          h('button', { class: 'btn', type: 'button', onclick: function () { ir('recNova'); } }, 'Nova chave de recuperação'))),
      h('div', { class: 'cartao' }, h('h2', null, 'Sair'),
        h('div', { class: 'acoes' },
          h('button', { class: 'btn', type: 'button', 'data-fid': 'sy:sair', onclick: function () { PS.modal.abrir('Sair deste aparelho?', h('p', null, 'Os dados continuam aqui, mas deixam de ser sincronizados.'), [{ rotulo: 'Sair deste aparelho', acao: function () { PS.sync.sair().then(function () { ir('inicio'); }); } }, { rotulo: 'Cancelar' }]); } }, 'Sair deste aparelho'),
          h('button', { class: 'btn perigo', type: 'button', onclick: function () { PS.modal.abrir('Sair de todos os aparelhos?', h('p', null, 'Todos os aparelhos serão desconectados (inclusive este). Para voltar, cada um precisa entrar com código, PIN e senha.'), [{ rotulo: 'Desconectar todos', tipo: 'perigo', acao: function () { PS.sync.sairTodos().then(function () { ir('inicio'); }, function (er) { PS.aviso(er.message); }); } }, { rotulo: 'Cancelar' }]); } }, 'Sair de todos os aparelhos'),
          h('button', { class: 'btn perigo', type: 'button', onclick: function () { ir('excluir'); } }, 'Excluir família da nuvem'))));
  };

  PS.views.sincronizar = { reativo: false, titulo: 'Sincronizar', render: function () {
    teclasAtivo = null;
    var e = PS.sync.estado();
    var p = passo;
    if (!p || (!e.ativo && /^(conectado|bloqueado|pinNovo|senhaNova|recNova|excluir|importarCif)$/.test(p))) p = '';
    if (!p) p = e.ativo ? (e.fase === 'bloqueado' ? 'bloqueado' : 'conectado') : 'inicio';
    if (p === 'c-feito' && !recuperacaoUnica) p = e.ativo ? 'conectado' : 'inicio';
    if (e.ativo && p === 'inicio') p = 'conectado';
    passo = p;
    return h('div', { class: 'tela-sync' }, h('h1', { class: 'titulo-tela' }, 'Sincronizar', h('small', null, 'família · criptografia ponta a ponta')), (T[p] || T.inicio)());
  } };
  PS.atualizarChipSync = function (a) {
    var e = PS.sync.estado();
    U.limpar(a); a.className = 'sync-chip ' + e.nivel;
    a.setAttribute('aria-label', 'Sincronização: ' + e.rotulo);
    var nome = e.fase === 'ok' ? 'check' : e.fase === 'desligado' ? 'nuvem' : e.fase === 'offline' ? 'x' : 'alerta';
    a.appendChild(I(nome)); a.appendChild(h('span', null, e.fase === 'desligado' ? 'Sem sincronização · ativar' : e.rotulo));
  };
  PS.sincronizarIr = function (p) { passo = p || ''; };
})(window);
