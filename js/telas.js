/* Telas de exibição da TV: Hoje, Rotina, Tarefas, Agenda, Família, Relaxar, Teclas, Importar, Instalar. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u, h = U.h, I = PS.icone, S = PS.store, D = PS.dom;
  var views = PS.views = {};
  var listaAtual = null, climaMem = null;

  function cartao(titulo, icone, filhos, mais) {
    return h('section', { class: 'cartao' },
      h('h2', null, I(icone), h('span', null, titulo), mais ? h('span', { class: 'mais' }, mais) : null), filhos);
  }
  function tagExemplo(x) { return x.exemplo ? h('span', { class: 'exemplo' }, 'exemplo') : null; }
  function nada() { return null; }
  function caixa(on) { return h('span', { class: 'caixa' + (on ? ' on' : ''), 'aria-hidden': 'true' }, I('check')); }
  function selo(tipo, icone, texto) { return h('span', { class: 'selo ' + tipo }, I(icone), texto); }

  function relogio() {
    return h('div', { class: 'relogio', 'aria-label': 'Hora atual' }, h('span', { class: 'rh' }, '--'), h('span', { class: 'dp' }, ':'), h('span', { class: 'rm' }, '--'));
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function seloVenc(estado, data, hoje, paga, rotuloPaga, curto) {
    if (paga) return selo('ok', 'check', rotuloPaga || 'Paga');
    var n = U.difDias(data, hoje), txt = cap(U.rotuloRelativo(data, hoje));
    if (n < 0) return selo('perigo', 'alerta', curto ? txt : 'Atrasada · ' + txt.toLowerCase());
    if (n <= 3) return selo('aviso', 'sino', txt);
    return selo('neutro', 'calendario', txt);
  }

  /* ---------- HOJE ---------- */
  function climaConteudo(box, d, erro) {
    U.limpar(box);
    if (!d) { box.appendChild(h('p', { class: 'vazio' }, erro ? 'Sem conexão com o clima agora.' : 'Carregando clima…')); return; }
    var info = PS.clima.descricao(d.cod);
    box.appendChild(h('div', { class: 'clima' }, I(info[1], 'grande'),
      h('div', null, h('div', { class: 'temp' }, d.temp + '°'), h('div', { class: 'desc' }, info[0])),
      h('div', { class: 'det' }, h('div', null, 'Sensação ' + d.sens + '°'), h('div', null, d.min + '° / ' + d.max + '°'), h('div', null, 'Chuva ' + (d.chuva == null ? '–' : d.chuva + '%') + (d.offline ? ' (offline)' : '')))));
  }
  views.hoje = { reativo: true, titulo: 'Hoje', render: function () {
    var s = S.get(), ag = U.agora(), hoje = ag.iso, nome = s.config.nome;
    var boxClima = h('div');
    climaConteudo(boxClima, climaMem, false);
    PS.clima.obter(s.config).then(function (d) { climaMem = d; if (boxClima.isConnected !== false) climaConteudo(boxClima, d); }, function () { if (!climaMem) climaConteudo(boxClima, null, true); });

    var comp = D.proximosCompromissos(s, ag, 7), nComp = comp.length;
    var listaComp = comp.slice(0, 3).map(function (c) {
      return h('a', { class: 'item', href: '#/agenda', 'data-fid': 'cp:' + c.id },
        h('span', { class: 'hora' }, c.hora || 'Dia'), h('span', { class: 't' }, c.titulo, nada()), h('span', { class: 'meta' }, c.data === hoje ? 'hoje' : U.dataCurta(c.data).split(',')[0]));
    });
    var tars = D.tarefasDoDia(s, hoje), nT = tars.length;
    var listaT = tars.slice(0, 3).map(function (t) {
      return h('button', { class: 'item', type: 'button', 'data-fid': 'tr:' + t.id, onclick: function () { S.alterar(function (st) { st.tarefas.forEach(function (x) { if (x.id === t.id) x.feita = true; }); }); } },
        caixa(false), h('span', { class: 't' }, t.titulo, nada()));
    });
    var feitosHoje = s.habitos.filter(function (x) { return S.habitoFeito(x.id, hoje); }).length, totH = s.habitos.length;
    var pct = totH ? Math.round(feitosHoje * 100 / totH) : 0;
    var chips = s.habitos.slice(0, 4).map(function (x) {
      var on = S.habitoFeito(x.id, hoje);
      return h('button', { class: 'item' + (on ? ' feito' : ''), type: 'button', 'data-fid': 'hb:' + x.id, 'aria-pressed': on ? 'true' : 'false', onclick: function () { S.alternarHabito(x.id, hoje); } }, caixa(on), h('span', { class: 't' }, x.nome));
    });
    var venc = D.aVencer(s, hoje, 7), nV = venc.length;
    var listaV = venc.slice(0, 3).map(function (v) {
      return h('a', { class: 'item dupla', href: '#/familia', 'data-fid': 'vc:' + v.tipo + v.data + v.titulo },
        I(v.tipo === 'conta' ? 'carteira' : 'sino'), h('span', { class: 't' }, v.titulo, h('small', null, seloVenc(v.estado, v.data, hoje, false, null, true), v.valor != null ? ' ' + U.valorBRL(v.valor) : '')));
    });
    var frase = D.fraseDoDia(s, hoje);

    return h('div', { class: 'hoje' },
      h('div', { class: 'coluna' },
        h('section', { class: 'cartao relogio-cartao' }, relogio(), h('div', { class: 'data-grande' }, cap(U.dataLonga(hoje))), h('div', { class: 'saudacao' }, D.saudacao(ag.h) + (nome ? ', ' + nome : '') + ' · ' + s.config.cidade)),
        cartao('Clima', 'sol', boxClima),
        frase ? cartao('Foco do dia', 'alvo', h('p', { class: 'foco' }, frase)) : null),
      h('div', { class: 'coluna' },
        cartao('Compromissos', 'calendario', listaComp.length ? listaComp : h('p', { class: 'vazio' }, 'Nada marcado nos próximos 7 dias.'), nComp > 3 ? '+' + (nComp - 3) : null),
        cartao('Tarefas do dia', 'lista', listaT.length ? listaT : h('p', { class: 'vazio' }, 'Nenhuma tarefa para hoje. Tudo em dia!'), nT > 3 ? '+' + (nT - 3) : null)),
      h('div', { class: 'coluna' },
        cartao('Hábitos de hoje', 'chama', totH ? [
          h('div', { class: 'progresso-txt' }, h('strong', null, feitosHoje + '/' + totH), h('span', null, pct + '% do dia')),
          h('div', { class: 'barra', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + pct + '%' })),
          h('div', { class: 'chips-habitos' }, chips)] : h('p', { class: 'vazio' }, 'Cadastre hábitos em Gerenciar.')),
        cartao('A vencer · 7 dias', 'carteira', listaV.length ? listaV : h('p', { class: 'vazio' }, 'Nenhuma conta ou lembrete nos próximos 7 dias.'), nV > 3 ? '+' + (nV - 3) : null)));
  } };

  /* ---------- ROTINA ---------- */
  views.rotina = { reativo: true, titulo: 'Rotina', render: function () {
    var s = S.get(), hoje = U.hoje(), seg = U.somaDias(hoje, -((U.dowIso(hoje) + 6) % 7));
    var feitos = s.habitos.filter(function (x) { return S.habitoFeito(x.id, hoje); }).length, tot = s.habitos.length, pct = tot ? Math.round(feitos * 100 / tot) : 0;
    var lista = s.habitos.map(function (x) {
      var on = S.habitoFeito(x.id, hoje), seq = S.sequencia(x.id), dias = [];
      for (var i = 0; i < 7; i++) {
        var d = U.somaDias(seg, i), f = S.habitoFeito(x.id, d);
        dias.push(h('span', { class: 'dia' + (f ? ' on' : '') + (d === hoje ? ' hoje-d' : '') + (d > hoje ? ' futuro' : ''), title: U.dataCurta(d) }, h('span', null, U.DIAS_CURTOS[U.dowIso(d)].charAt(0)), h('i')));
      }
      return h('button', { class: 'habito', type: 'button', role: 'checkbox', 'aria-checked': on ? 'true' : 'false', 'data-fid': 'hb:' + x.id, onclick: function () { S.alternarHabito(x.id, hoje); } },
        I(x.icone, 'icone'),
        h('span', null, h('span', { class: 'nome' }, x.nome, tagExemplo(x)), h('span', { class: 'seq' }, seq ? [I('chama'), seq + (seq === 1 ? ' dia seguido' : ' dias seguidos')] : 'Sem sequência ainda')),
        h('span', { class: 'semana' }, dias), caixa(on));
    });
    return h('div', null,
      h('h1', { class: 'titulo-tela' }, 'Rotina', h('small', null, U.dataLonga(hoje))),
      tot ? h('div', { class: 'cartao resumo-rotina' }, h('div', { class: 'progresso-txt' }, h('strong', null, feitos + ' de ' + tot), h('span', null, pct + '% dos hábitos de hoje')),
        h('div', { class: 'barra' }, h('i', { style: 'width:' + pct + '%' }))) : null,
      lista.length ? lista : h('p', { class: 'vazio' }, 'Nenhum hábito cadastrado. Abra Gerenciar → Hábitos.'));
  } };

  /* ---------- TAREFAS ---------- */
  views.tarefas = { reativo: true, titulo: 'Tarefas', render: function () {
    var s = S.get(), hoje = U.hoje(), nomes = D.listasComTarefas(s);
    if (!listaAtual || nomes.indexOf(listaAtual) < 0) listaAtual = nomes[0];
    var abas = nomes.map(function (n) {
      var pend = s.tarefas.filter(function (t) { return t.lista === n && !t.feita; }).length;
      return h('button', { class: 'aba', type: 'button', role: 'tab', 'aria-selected': n === listaAtual ? 'true' : 'false', 'data-fid': 'aba:' + n, onclick: function () { listaAtual = n; PS.redesenhar(); } }, n, h('small', null, pend));
    });
    var ts = D.ordenarTarefas(s.tarefas.filter(function (t) { return t.lista === listaAtual; }));
    var itens = ts.map(function (t) {
      var p = t.prio;
      var sp = selo(p === 'alta' ? 'perigo' : p === 'media' ? 'aviso' : 'neutro', p === 'alta' ? 'alerta' : 'estrela', D.ROTULO_PRIO[p]);
      var venc = t.vence ? (t.feita ? selo('neutro', 'calendario', U.dataCurta(t.vence)) : seloVenc('', t.vence, hoje, false)) : null;
      return h('button', { class: 'item tarefa' + (t.feita ? ' feito' : ''), type: 'button', role: 'checkbox', 'aria-checked': t.feita ? 'true' : 'false', 'data-fid': 'tr:' + t.id, onclick: function () { S.alterar(function (st) { st.tarefas.forEach(function (x) { if (x.id === t.id) x.feita = !x.feita; }); }); } },
        caixa(t.feita), h('span', { class: 't' }, t.titulo, tagExemplo(t)), sp, venc);
    });
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Tarefas'),
      h('div', { class: 'abas', role: 'tablist' }, abas),
      itens.length ? itens : h('p', { class: 'vazio' }, 'Lista vazia. Adicione tarefas em Gerenciar → Tarefas.'));
  } };

  /* ---------- AGENDA ---------- */
  function detalheCompromisso(c) {
    PS.modal.abrir(c.titulo, h('div', null, h('p', null, U.dataLonga(c.data) + (c.hora ? ' às ' + c.hora : ' (dia todo)')), c.local ? h('p', null, 'Local: ' + c.local) : null, c.fonte === 'ics' ? h('p', { class: 'nota' }, 'Importado de arquivo .ics') : null), [{ rotulo: 'Fechar', tipo: 'primario' }]);
  }
  views.agenda = { reativo: true, titulo: 'Agenda', render: function () {
    var s = S.get(), ag = U.agora(), hoje = ag.iso, grupos = [];
    for (var i = 0; i < 7; i++) {
      var d = U.somaDias(hoje, i), evs = D.ordenarCompromissos(s.compromissos.filter(function (c) { return c.data === d; }));
      var rel = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : null;
      grupos.push(h('section', { class: 'dia-agenda' },
        h('h3', null, rel ? rel : U.DIAS[U.dowIso(d)], h('small', null, U.dataCurta(d).split(', ')[1])),
        evs.length ? evs.map(function (c) {
          var passou = c.data === hoje && c.hora && (+c.hora.slice(0, 2) * 60 + +c.hora.slice(3)) < ag.h * 60 + ag.mi - 30;
          return h('button', { class: 'item' + (passou ? ' passado' : ''), type: 'button', 'data-fid': 'cp:' + c.id, onclick: function () { detalheCompromisso(c); } },
            h('span', { class: 'hora' }, c.hora || 'Dia todo'), h('span', { class: 't' }, c.titulo, tagExemplo(c)), c.local ? h('span', { class: 'meta' }, [I('pin'), ' ' + c.local]) : null);
        }) : h('p', { class: 'vazio' }, 'Sem compromissos')));
    }
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Agenda', h('small', null, 'próximos 7 dias')), grupos,
      h('p', { class: 'nota' }, 'Para cadastrar ou importar um arquivo .ics, use Gerenciar → Agenda.'));
  } };

  /* ---------- FAMÍLIA ---------- */
  views.familia = { reativo: true, titulo: 'Família', render: function () {
    var s = S.get(), hoje = U.hoje(), m0 = U.ym(hoje);
    var lems = s.lembretes.map(function (l) { var o = D.ocorrenciaVisivel(D.ocorrenciasLembrete(l, hoje), hoje); return { l: l, data: o.data, chave: o.chave, feito: o.feito }; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    var contas = [];
    s.contas.forEach(function (c) {
      var ocs = D.ocorrenciasConta(c, hoje);
      if (c.mensal) contas.push(D.ocorrenciaVisivel(ocs, hoje));
      else ocs.forEach(function (o) { if (U.difDias(o.data, hoje) >= -30 && U.difDias(o.data, hoje) <= 60) contas.push(o); });
    });
    contas.sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    var li = lems.map(function (x) {
      return h('button', { class: 'item dupla' + (x.feito ? ' feito' : ''), type: 'button', role: 'checkbox', 'aria-checked': x.feito ? 'true' : 'false', 'data-fid': 'lm:' + x.l.id,
        onclick: function () { S.alterar(function (st) { st.lembretes.forEach(function (y) { if (y.id === x.l.id) { y.feitos = y.feitos || {}; if (y.feitos[x.chave]) delete y.feitos[x.chave]; else y.feitos[x.chave] = true; } }); }); } },
        caixa(x.feito), h('span', { class: 't' }, x.l.titulo, tagExemplo(x.l), x.l.obs ? h('small', null, x.l.obs) : null),
        x.feito ? selo('ok', 'check', 'Feito') : seloVenc('', x.data, hoje, false));
    });
    var ci = contas.map(function (o) {
      var c = o.conta;
      return h('button', { class: 'item dupla' + (o.paga ? ' feito' : ''), type: 'button', role: 'checkbox', 'aria-checked': o.paga ? 'true' : 'false', 'data-fid': 'ct:' + c.id,
        onclick: function () { S.alterar(function (st) { st.contas.forEach(function (y) { if (y.id === c.id) { if (y.mensal) { y.pagas = y.pagas || {}; if (y.pagas[o.chave]) delete y.pagas[o.chave]; else y.pagas[o.chave] = true; } else y.paga = !y.paga; } }); }); } },
        caixa(o.paga), h('span', { class: 't' }, c.titulo, tagExemplo(c), h('small', null, 'Vence ' + U.dataCurta(o.data) + (c.valor != null ? ' · ' + U.valorBRL(c.valor) : ''))),
        seloVenc('', o.data, hoje, o.paga));
    });
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Família e contas', h('small', null, 'toque OK para marcar')),
      h('div', { class: 'duas-colunas' },
        cartao('Lembretes do mês', 'sino', li.length ? li : h('p', { class: 'vazio' }, 'Nenhum lembrete. Cadastre em Gerenciar → Família.')),
        cartao('Contas a vencer', 'carteira', ci.length ? ci : h('p', { class: 'vazio' }, 'Nenhuma conta cadastrada.'))));
  } };

  /* ---------- RELAXAR ---------- */
  views.relaxar = { reativo: true, titulo: 'Relaxar', render: function () {
    var s = S.get();
    var tiles = s.links.map(function (l, i) {
      var host = ''; try { host = new URL(l.url).host.replace(/^www\./, ''); } catch (e) { /* ok */ }
      return h('a', { class: 'tile' + (l.url.indexOf('youtube.com/tv') >= 0 ? ' destaque' : ''), href: l.url, target: '_self', rel: 'noopener', 'data-fid': 'lk:' + l.id },
        I(l.icone), h('span', null, h('strong', null, l.titulo, tagExemplo(l)), h('small', null, host)));
    });
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Relaxar', h('small', null, 'abre no mesmo navegador')),
      tiles.length ? h('div', { class: 'tiles' }, tiles) : h('p', { class: 'vazio' }, 'Nenhum atalho. Adicione em Gerenciar → Links.'),
      h('p', { class: 'nota' }, 'Dica: para voltar do YouTube ao painel, use o botão Voltar do controle.'));
  } };

  /* ---------- TECLAS (diagnóstico do controle remoto) ---------- */
  var regTeclas = [], elUltima = null, elTabela = null;
  PS.tecla = function (e) {
    if (PS.rotaAtual !== 'teclas' || !elUltima) return;
    regTeclas.unshift({ key: e.key, code: e.code, kc: e.keyCode, w: e.which, loc: e.location, t: U.agora().hhmm + ':' + U.pad(U.agora().s) });
    regTeclas = regTeclas.slice(0, 10);
    var r = regTeclas[0];
    elUltima.textContent = (r.key === ' ' ? 'Espaço' : r.key) + '  ·  keyCode ' + r.kc;
    U.limpar(elTabela);
    elTabela.appendChild(h('tr', null, ['hora', 'key', 'code', 'keyCode', 'which'].map(function (x) { return h('th', null, x); })));
    regTeclas.forEach(function (x) { elTabela.appendChild(h('tr', null, [x.t, x.key, x.code || '–', x.kc, x.w].map(function (v) { return h('td', null, String(v)); }))); });
  };
  views.teclas = { reativo: false, titulo: 'Teclas', render: function () {
    regTeclas = [];
    elUltima = h('div', { class: 'teclas-ultima', 'aria-live': 'polite' }, 'Aperte um botão do controle…');
    elTabela = h('table', { class: 'tabela-teclas' });
    var info = 'Tela ' + g.screen.width + '×' + g.screen.height + ' · janela ' + g.innerWidth + '×' + g.innerHeight + ' · pixel ratio ' + g.devicePixelRatio + ' · ' + navigator.userAgent;
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Teste do controle remoto'),
      h('p', { class: 'nota' }, 'Aperte qualquer botão: setas, OK, Voltar, Menu, números… O código aparece abaixo. Nesta tela o botão Voltar NÃO sai: use o botão “Sair do teste”.'),
      h('div', { class: 'cartao' }, elUltima, elTabela),
      h('p', { class: 'info-disp' }, info),
      h('div', { class: 'acoes' }, h('a', { class: 'btn primario', href: '#/' }, 'Sair do teste')));
  } };

  /* ---------- IMPORTAR (link de configuração) ---------- */
  views.importar = { reativo: false, titulo: 'Importar', render: function (param) {
    var dados = null, erro = null;
    try { dados = S.sanear(S.lerLink(param || '')); } catch (e) { erro = 'Link inválido ou incompleto.'; }
    if (erro) return h('div', null, h('h1', { class: 'titulo-tela' }, 'Importar configuração'), h('p', { class: 'nota aviso' }, erro + ' Peça um novo link em Gerenciar → Backup, ou use o arquivo JSON.'), h('div', { class: 'acoes' }, h('a', { class: 'btn primario', href: '#/' }, 'Voltar ao Hoje')));
    var resumo = [dados.habitos.length + ' hábitos', dados.tarefas.length + ' tarefas', dados.compromissos.length + ' compromissos', dados.lembretes.length + ' lembretes', dados.contas.length + ' contas', dados.links.length + ' links', 'cidade ' + dados.config.cidade];
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Importar configuração'),
      h('div', { class: 'cartao' }, h('p', null, 'Este link traz:'), h('p', { class: 'foco', style: 'margin-top:.4rem' }, resumo.join(' · ')),
        h('p', { class: 'nota aviso' }, 'Importar SUBSTITUI os dados atuais deste aparelho (o histórico de hábitos é mantido).')),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn primario', type: 'button', onclick: function () { S.substituir(dados, true); PS.aplicarConfig(); PS.aviso('Configuração importada'); g.location.hash = '#/'; } }, 'Importar e substituir'),
        h('a', { class: 'btn', href: '#/' }, 'Cancelar')));
  } };

  /* ---------- INSTALAR (APK via Downloader) ---------- */
  views.instalar = { reativo: false, titulo: 'Instalar', render: function () {
    var base = g.location.href.split('#')[0].replace(/index\.html$/, '');
    var curta = base + 'painel.apk';
    var noApp = /PainelSalaApp/.test(navigator.userAgent);
    var passos = [
      ['Abra o app Downloader', 'na TV box (ícone laranja da AFTVnews).'],
      ['Digite o endereço do app', curta.replace(/^https?:\/\//, '')],
      ['Aperte “Ir” e depois “Instalar”', 'Se a TV pedir, permita “Fontes desconhecidas” para o Downloader e volte.'],
      ['Abra pelo menu da TV', 'procure “Painel da Sala” em Apps. Se não aparecer, abra em Configurações → Apps.'],
      ['Pronto', 'Dados ficam salvos no aparelho. Para atualizar, repita o passo 2.']
    ];
    return h('div', null, h('h1', { class: 'titulo-tela' }, 'Instalar na TV box'),
      noApp ? h('p', { class: 'nota' }, 'Você já está usando o app instalado.') : null,
      h('div', { class: 'cartao' }, passos.map(function (p, i) {
        return h('div', { class: 'item dupla', style: 'min-height:2.2rem', tabindex: '0', 'data-f': '' }, h('span', { class: 'selo mag' }, String(i + 1)), h('span', { class: 't' }, p[0], h('small', null, p[1])));
      })),
      h('div', { class: 'cartao', style: 'margin-top:.6rem' }, h('h2', null, I('globo'), h('span', null, 'Sem instalar (só navegador)')),
        h('p', { class: 'nota' }, 'Abra no navegador da TV box: ' + base.replace(/^https?:\/\//, '') + ' e use “Adicionar à tela inicial” (se o navegador permitir) ou salve nos favoritos.')),
      h('div', { class: 'acoes' }, h('a', { class: 'btn primario', href: curta }, 'Baixar o APK agora'), h('a', { class: 'btn', href: '#/' }, 'Voltar')));
  } };

  PS.limparClima = function () { climaMem = null; };
})(window);
