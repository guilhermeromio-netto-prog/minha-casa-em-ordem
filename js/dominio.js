/* Regras de negócio puras: contas a vencer, lembretes, compromissos, tarefas do dia, frase do dia. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var U = PS.u;
  var PESO = { alta: 0, media: 1, baixa: 2 };
  var ROTULO_PRIO = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

  /* ocorrências relevantes de uma conta: mensal => mês atual e próximo; avulsa => data */
  function ocorrenciasConta(c, hoje) {
    if (!c.mensal) return c.data ? [{ conta: c, data: c.data, chave: 'avulsa', paga: !!c.paga }] : [];
    var m0 = U.ym(hoje), out = [];
    [0, 1].forEach(function (i) {
      var m = U.somaMes(m0, i);
      out.push({ conta: c, data: U.dataNoMes(m, c.dia), chave: m, paga: !!(c.pagas && c.pagas[m]) });
    });
    return out;
  }
  function ocorrenciasLembrete(l, hoje) {
    var m0 = U.ym(hoje), out = [];
    [0, 1].forEach(function (i) {
      var m = U.somaMes(m0, i);
      out.push({ lembrete: l, data: U.dataNoMes(m, l.dia), chave: m, feito: !!(l.feitos && l.feitos[m]) });
    });
    return out;
  }
  /* ocorrência exibida nas telas de Família: a do mês; se já resolvida e já passou, a do próximo mês */
  function ocorrenciaVisivel(lista, hoje) {
    var a = lista[0], b = lista[1];
    if (!b) return a;
    var resolvida = a.paga != null ? a.paga : a.feito;
    return (resolvida && a.data < hoje) ? b : a;
  }
  function estadoVenc(data, hoje, resolvido) {
    if (resolvido) return 'ok';
    var n = U.difDias(data, hoje);
    return n < 0 ? 'atrasado' : (n <= 3 ? 'aviso' : 'normal');
  }

  /* contas + lembretes que vencem em até N dias (inclui atrasados do mês atual, não resolvidos) */
  function aVencer(s, hoje, dias) {
    var lim = U.somaDias(hoje, dias), out = [];
    s.contas.forEach(function (c) {
      ocorrenciasConta(c, hoje).forEach(function (o) {
        if (o.paga) return;
        if (o.data <= lim && (o.data >= hoje || c.mensal && U.ym(o.data) === U.ym(hoje) || !c.mensal)) {
          out.push({ tipo: 'conta', titulo: c.titulo, data: o.data, valor: c.valor, ref: o, estado: estadoVenc(o.data, hoje, false) });
        }
      });
    });
    s.lembretes.forEach(function (l) {
      ocorrenciasLembrete(l, hoje).forEach(function (o) {
        if (o.feito) return;
        if (o.data <= lim && (o.data >= hoje || U.ym(o.data) === U.ym(hoje))) {
          out.push({ tipo: 'lembrete', titulo: l.titulo, obs: l.obs, data: o.data, ref: o, estado: estadoVenc(o.data, hoje, false) });
        }
      });
    });
    out.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    return out;
  }

  function chaveHora(c) { return c.data + 'T' + (c.hora || '00:00'); }
  function ordenarCompromissos(l) { return l.slice().sort(function (a, b) { var x = chaveHora(a), y = chaveHora(b); return x < y ? -1 : x > y ? 1 : 0; }); }
  /* próximos compromissos a partir de agora (tolera 30min de atraso) */
  function proximosCompromissos(s, ag, dias) {
    var lim = U.somaDias(ag.iso, dias);
    return ordenarCompromissos(s.compromissos.filter(function (c) {
      if (c.data > lim) return false;
      if (c.data > ag.iso) return true;
      if (c.data < ag.iso) return false;
      if (!c.hora) return true;
      var min = +c.hora.slice(0, 2) * 60 + +c.hora.slice(3), agora = ag.h * 60 + ag.mi;
      return min >= agora - 30;
    }));
  }

  function ordenarTarefas(l) {
    return l.slice().sort(function (a, b) {
      if (a.feita !== b.feita) return a.feita ? 1 : -1;
      if (PESO[a.prio] !== PESO[b.prio]) return PESO[a.prio] - PESO[b.prio];
      return (a.vence || '9999') < (b.vence || '9999') ? -1 : (a.vence || '9999') > (b.vence || '9999') ? 1 : 0;
    });
  }
  /* tarefas do dia: vencem hoje/atrasadas + as de prioridade alta sem data */
  function tarefasDoDia(s, hoje) {
    return ordenarTarefas(s.tarefas.filter(function (t) { return !t.feita && ((t.vence && t.vence <= hoje) || (!t.vence && t.prio === 'alta')); }));
  }
  function fraseDoDia(s, hoje) {
    var l = s.foco; if (!l.length) return '';
    var d = new Date(hoje + 'T00:00:00Z').getTime() / 86400000;
    return l[Math.floor(d) % l.length].texto;
  }
  function listasComTarefas(s) {
    var nomes = s.listas.slice();
    s.tarefas.forEach(function (t) { if (nomes.indexOf(t.lista) < 0) nomes.push(t.lista); });
    return nomes;
  }
  function saudacao(h) { return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

  PS.dom = { ocorrenciaVisivel: ocorrenciaVisivel, ocorrenciasConta: ocorrenciasConta, ocorrenciasLembrete: ocorrenciasLembrete, aVencer: aVencer, ordenarCompromissos: ordenarCompromissos, proximosCompromissos: proximosCompromissos, ordenarTarefas: ordenarTarefas, tarefasDoDia: tarefasDoDia, fraseDoDia: fraseDoDia, listasComTarefas: listasComTarefas, saudacao: saudacao, ROTULO_PRIO: ROTULO_PRIO };
})(window);
