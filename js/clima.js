/* Clima via Open-Meteo (sem chave). Geocodificação pela cidade das configurações. Cache de 30 min. */
(function (g) {
  'use strict';
  var PS = g.PS = g.PS || {};
  var CHAVE = 'painelsala.clima', TTL = 30 * 60 * 1000;
  var COD = {
    0: ['Céu limpo', 'sol'], 1: ['Quase limpo', 'sol'], 2: ['Parcialmente nublado', 'nuvem'], 3: ['Nublado', 'nuvem'],
    45: ['Neblina', 'neblina'], 48: ['Neblina', 'neblina'], 51: ['Garoa fraca', 'chuva'], 53: ['Garoa', 'chuva'], 55: ['Garoa forte', 'chuva'],
    61: ['Chuva fraca', 'chuva'], 63: ['Chuva', 'chuva'], 65: ['Chuva forte', 'chuva'], 66: ['Chuva gelada', 'chuva'], 67: ['Chuva gelada', 'chuva'],
    71: ['Neve fraca', 'neve'], 73: ['Neve', 'neve'], 75: ['Neve forte', 'neve'], 77: ['Grãos de neve', 'neve'],
    80: ['Pancadas fracas', 'chuva'], 81: ['Pancadas de chuva', 'chuva'], 82: ['Pancadas fortes', 'chuva'], 85: ['Neve', 'neve'], 86: ['Neve', 'neve'],
    95: ['Tempestade', 'tempestade'], 96: ['Tempestade com granizo', 'tempestade'], 99: ['Tempestade com granizo', 'tempestade']
  };
  function lerCache(cfg) {
    try { var c = JSON.parse(localStorage.getItem(CHAVE)); if (c && c.lat === cfg.lat && c.lon === cfg.lon) return c; } catch (e) { /* ignora */ }
    return null;
  }
  function obter(cfg, forcar) {
    var c = lerCache(cfg);
    if (c && !forcar && Date.now() - c.em < TTL) return Promise.resolve(c);
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + cfg.lat + '&longitude=' + cfg.lon +
      '&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=1';
    var ctl = ('AbortController' in g) ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 10000);
    return fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      clearTimeout(t);
      var d = { lat: cfg.lat, lon: cfg.lon, em: Date.now(), temp: Math.round(j.current.temperature_2m), sens: Math.round(j.current.apparent_temperature), cod: j.current.weather_code,
        max: Math.round(j.daily.temperature_2m_max[0]), min: Math.round(j.daily.temperature_2m_min[0]), chuva: j.daily.precipitation_probability_max[0] };
      try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch (e) { /* cheio */ }
      return d;
    }).catch(function (e) {
      clearTimeout(t);
      if (c) { c.offline = true; return c; }
      throw e;
    });
  }
  function descricao(cod) { return COD[cod] || ['Tempo indefinido', 'nuvem']; }
  /* "Osasco, SP" -> busca "Osasco" no Brasil e prefere o estado informado */
  function geocodificar(texto) {
    var partes = String(texto).split(','), nome = partes[0].trim(), uf = (partes[1] || '').trim().toUpperCase();
    if (!nome) return Promise.reject(new Error('Digite uma cidade'));
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(nome) + '&count=10&language=pt&countryCode=BR';
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      var rs = j.results || [];
      if (!rs.length) throw new Error('Cidade não encontrada');
      var escolhido = rs[0];
      if (uf) { var porUf = rs.filter(function (x) { return siglaUf(x.admin1) === uf || (x.admin1 || '').toUpperCase() === uf; })[0]; if (porUf) escolhido = porUf; }
      return { nome: escolhido.name + (escolhido.admin1 ? ', ' + escolhido.admin1 : ''), lat: escolhido.latitude, lon: escolhido.longitude };
    });
  }
  var UFS = { 'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPÁ': 'AP', 'AMAZONAS': 'AM', 'BAHIA': 'BA', 'CEARÁ': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'GOIÁS': 'GO', 'MARANHÃO': 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG', 'PARÁ': 'PA', 'PARAÍBA': 'PB', 'PARANÁ': 'PR', 'PERNAMBUCO': 'PE', 'PIAUÍ': 'PI', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', 'RONDÔNIA': 'RO', 'RORAIMA': 'RR', 'SANTA CATARINA': 'SC', 'SÃO PAULO': 'SP', 'SERGIPE': 'SE', 'TOCANTINS': 'TO' };
  function siglaUf(n) { return UFS[(n || '').toUpperCase()] || ''; }
  PS.clima = { obter: obter, descricao: descricao, geocodificar: geocodificar };
})(window);
