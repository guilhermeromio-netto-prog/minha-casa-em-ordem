// Testes do leitor de faturas sobre PDFs SINTÉTICOS (tools/pdfs-teste). Uso: node tools/teste-fatura.mjs
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url)), raiz = path.join(aqui, '..');
const require = createRequire(import.meta.url);
const P = require(path.join(raiz, 'js/fatura-parser.js'));
// pdf.js só precisa destes tipos existirem para extrair texto no Node (renderização não é usada)
for (const n of ['DOMMatrix', 'ImageData', 'Path2D']) if (!globalThis[n]) globalThis[n] = class { constructor() {} };
const lib = await import(path.join(raiz, 'js/vendor/pdfjs/pdf.min.mjs'));
lib.GlobalWorkerOptions.workerSrc = path.join(raiz, 'js/vendor/pdfjs/pdf.worker.min.mjs');
const totais = JSON.parse(fs.readFileSync(path.join(aqui, 'pdfs-teste/totais.json'), 'utf8'));
const dados = JSON.parse(fs.readFileSync(path.join(raiz, 'dados.json'), 'utf8'));
let ok = 0, falhas = 0; const check = (c, m) => { if (c) { ok++; console.log('  ok   ' + m); } else { falhas++; console.log('  FALHA ' + m); } };
const bytes = (n) => new Uint8Array(fs.readFileSync(path.join(aqui, 'pdfs-teste', n)));
const regrasPadrao = dados.regrasCategoria || {};

// unidades
check(P.valorBR('R$ 1.234,56') === 1234.56 && P.valorBR('-45,00') === -45 && P.valorBR('48,00CR') === -48 && P.valorBR('12,3') === null, 'valorBR: milhar, negativo, CR');
check(P.rejeitaSensivel('4111 1111 1111 1111') !== '' && P.rejeitaSensivel('4111111111111111') !== '' && P.rejeitaSensivel('cvv 123') !== '' && P.rejeitaSensivel('final 4321') === '' && P.rejeitaSensivel('Nubank') === '', 'rejeita nº de cartão e CVV, aceita final 4321');
check(P.limpar('cartão 5555 4444 3333 2222 cpf 123.456.789-09').indexOf('5555') < 0 && P.limpar('5555 4444 3333 2222').indexOf('2222') >= 0 && P.limpar('x 123.456.789-09').indexOf('456') < 0, 'limpar: mantém só 4 últimos, remove CPF');
check(P.extrairParcela('LOJA PARC 03/10').pt === 10 && P.extrairParcela('CURSO Parcela 2 de 5').pa === 2 && P.extrairParcela('LOJA 03/06').pa === 3 && P.extrairParcela('MERCADO').pt === 0, 'extrairParcela');

for (const nome of ['nubank-sintetico.pdf', 'itau-sintetico.pdf', 'bradesco-sintetico.pdf']) {
  const esp = totais[nome];
  const r = await P.lerPdf(lib, bytes(nome));
  const a = P.analisar(r.linhas, { hoje: '2026-10-24', regrasPadrao });
  console.log('--', nome, a.bancoNome, 'conf=' + a.confianca, 'soma=' + a.soma, 'total=' + a.resumo.total);
  check(a.banco === esp.banco, nome + ': banco detectado = ' + esp.banco);
  check(a.resumo.total === esp.total, nome + ': total da fatura = ' + esp.total);
  check(a.lancs.length === esp.n, nome + ': ' + esp.n + ' lançamentos (achei ' + a.lancs.length + ')');
  check(Math.abs(a.soma - esp.total) < 0.005 && a.confianca === 'alta', nome + ': soma confere com o total (confiança alta)');
  check(a.resumo.vencimento === esp.vencimento, nome + ': vencimento ' + esp.vencimento + ' (achei ' + a.resumo.vencimento + ')');
  check(a.resumo.final === esp.final, nome + ': final do cartão ' + esp.final + ' (achei ' + a.resumo.final + ')');
  check(a.lancs.filter(x => x.pt > 0).length === esp.parcelas, nome + ': parcelas detectadas = ' + esp.parcelas);
  check(a.lancs.filter(x => x.valor < 0).length === esp.creditos, nome + ': créditos/estornos negativos = ' + esp.creditos);
  const json = JSON.stringify(a);
  check(!/5555|4444|3333|2222|123\.456|06000-000|456\.789/.test(json.replace(/•••• 2222/g, '')), nome + ': sem número completo, CPF ou CEP no resultado');
  check(a.lancs.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.data)), nome + ': datas ISO válidas');
}
// categorias e parcelas (nubank)
{
  const a = P.analisar((await P.lerPdf(lib, bytes('nubank-sintetico.pdf'))).linhas, { hoje: '2026-10-24', regrasPadrao });
  const cat = (t) => (a.lancs.find(x => x.desc.indexOf(t) >= 0) || {}).cat;
  check(cat('Mercado') === 'mercado' && cat('Uber') === 'transporte' && cat('Netflix') === 'assinaturas' && cat('Farm') === 'saude', 'categorias padrão: mercado/transporte/assinaturas/saúde');
  check(a.ignoradas.length === 1 && /pagamento/.test(a.ignoradas[0].motivo), '"Pagamento recebido" fica de fora da soma');
  const p = a.lancs.find(x => x.pt === 10); check(p && p.pa === 3 && p.valor === 189.9, 'parcela 3/10 de R$ 189,90');
  const b = P.analisar((await P.lerPdf(lib, bytes('nubank-sintetico.pdf'))).linhas, { hoje: '2026-10-24', regrasPadrao, regras: [{ termo: 'loja xyz', cat: 'compras' }] });
  check(b.lancs.find(x => x.pt === 10).cat === 'compras', 'regra do usuário ("lembrar para esta loja") vence a padrão');
}
// Itaú em duas colunas (sintético, mesmo layout das faturas reais do Itaú Black: espaços quebrados, parcelas antigas à esquerda, produtos/serviços, parcelas futuras)
for (const nome of ['itau-colunas-set.pdf', 'itau-colunas-out.pdf']) {
  const esp = totais[nome], r = await P.lerPdf(lib, bytes(nome));
  const a = P.analisar(r.linhas, { hoje: '2026-10-24', regrasPadrao, itens: r.itens }), R = a.resumo, V = a.validacao;
  console.log('--', nome, a.layout, 'conf=' + a.confianca, 'soma=' + a.soma, 'total=' + R.total);
  check(a.banco === 'itau' && a.layout === 'colunas', nome + ': layout Itaú em colunas detectado');
  check(R.total === esp.total && a.soma === esp.total && a.confianca === 'alta', nome + ': total ' + esp.total + ' = soma dos lançamentos (confiança alta)');
  check(a.lancs.length === esp.n, nome + ': ' + esp.n + ' lançamentos (achei ' + a.lancs.length + ')');
  check(V.subtotalCartao === esp.subtotalCartao && V.okCartao && V.subtotalProdutos === esp.subtotalProdutos && V.okProdutos && V.okLancamentos && V.okTotal, nome + ': subtotais do banco (cartão ' + esp.subtotalCartao + ' + produtos ' + esp.subtotalProdutos + ') conferem');
  check(R.vencimento === esp.vencimento && R.emissao === esp.emissao && R.final === esp.final && R.produto === 'Black', nome + ': vencimento, emissão, final 9999 e produto');
  check(R.pagamentoMinimo === esp.minimo && R.totalAnterior === esp.anterior, nome + ': pagamento mínimo e fatura anterior');
  check(a.ignoradas.length === 1 && /pagamento/.test(a.ignoradas[0].motivo) && a.lancs.every(x => x.valor > 0), nome + ': pagamento da fatura anterior fica de fora');
  check(R.futuras.total === esp.futTotal && R.futuras.proxima === esp.futProxima && R.futuras.demais === esp.futDemais && R.futuras.lista.length === esp.nFuturas && V.okFuturas, nome + ': compromissos futuros (próxima, demais, total, ' + esp.nFuturas + ' parcelas) conferem com a lista');
  const multa = a.lancs.filter(x => x.cat === 'encargos');
  check(multa.length === 1 && multa[0].valor === 100 && a.porCategoria.encargos === 100 && R.futuras.lista.some(x => x.cat === 'encargos'), nome + ': multa/juros é lançamento próprio (categoria encargos), não entra em outras');
  const cat = (t) => (a.lancs.find(x => x.desc.indexOf(t) >= 0) || {}).cat;
  check(cat('AUTO POSTO') === 'transporte' && cat('FARMACIA') === 'saude' && cat('RESTAURANTE') === 'restaurante' && cat('SUPERMERCADO') === 'mercado', nome + ': categorias (banco + regras padrão)');
  check(a.lancs.filter(x => x.cat !== 'encargos').every(x => x.catBanco && x.cidade) && a.lancs.find(x => x.desc.indexOf('RESTAURANTE') === 0).cidade === 'Curitiba', nome + ': categoria do banco e cidade lidas da linha de baixo');
  check(a.lancs.find(x => x.desc.indexOf('MOVEIS ALFA') === 0).data.slice(0, 4) === '2026' && a.lancs.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.data) && x.data <= R.vencimento), nome + ': datas com ano inferido (nunca depois do vencimento)');
  check(!/5555|XXXX/i.test(JSON.stringify(a)) && !('titular' in R), nome + ': sem número do cartão nem titular no resultado');
  const soCat = {}; a.lancs.forEach(x => { soCat[x.cat] = Math.round(((soCat[x.cat] || 0) + x.valor) * 100) / 100; });
  check(Math.abs(Object.values(a.porCategoria).reduce((t, v) => t + v, 0) - esp.total) < 0.005, nome + ': soma por categoria = total');
  const b = P.analisar(r.linhas, { hoje: '2026-10-24', regrasPadrao, itens: r.itens, regras: [{ termo: 'streamflix', cat: 'lazer' }] });
  check(b.lancs.find(x => x.desc.indexOf('STREAMFLIX') === 0).cat === 'lazer', nome + ': regra do usuário vence a categoria do banco');
}
{
  const ra = await P.lerPdf(lib, bytes('itau-colunas-set.pdf')), rb = await P.lerPdf(lib, bytes('itau-colunas-out.pdf'));
  const a = P.analisar(ra.linhas, { hoje: '2026-10-24', regrasPadrao, itens: ra.itens }), b = P.analisar(rb.linhas, { hoje: '2026-10-24', regrasPadrao, itens: rb.itens });
  check(a.resumo.final === b.resumo.final && a.resumo.vencimento !== b.resumo.vencimento && a.resumo.total !== b.resumo.total, 'set e out: mesmo cartão (final 9999), vencimentos diferentes → duas faturas, sem duplicidade');
  check(b.resumo.totalAnterior === a.resumo.total, 'out: "fatura anterior" = total da fatura de set (encadeia mês a mês)');
  check(a.lancs.filter(x => x.pt).length === 5 && b.lancs.filter(x => x.pt).length === 5 && a.lancs.find(x => x.pt === 10).pa === 6 && b.lancs.find(x => x.pt === 10).pa === 7, 'parcelas avançam de um mês para o outro (6/10 → 7/10)');
}
// PDF REAL (opcional, só na máquina de quem tem o arquivo): FATURA_REAL_PDF=/caminho.pdf. Imprime só totais e contagens, nunca estabelecimentos.
if (process.env.FATURA_REAL_PDF && fs.existsSync(process.env.FATURA_REAL_PDF)) {
  const r = await P.lerPdf(lib, new Uint8Array(fs.readFileSync(process.env.FATURA_REAL_PDF)));
  const a = P.analisar(r.linhas, { hoje: '2026-10-24', regrasPadrao, itens: r.itens }), V = a.validacao || {};
  console.log('-- PDF real (agregado): ' + a.bancoNome + ' final ' + a.resumo.final + ' · ' + a.lancs.length + ' lançamentos · soma ' + a.soma + ' · total ' + a.resumo.total + ' · confiança ' + a.confianca);
  check(a.confianca === 'alta' && Math.abs(a.soma - a.resumo.total) < 0.005 && V.okCartao && V.okProdutos && V.okLancamentos, 'PDF real: soma dos lançamentos = total e subtotais do banco conferem');
} else console.log('  (pulado) PDF real: defina FATURA_REAL_PDF para rodar o teste local; o arquivo nunca vai para o repositório');
// senha
{
  let motivos = [];
  const r = await P.lerPdf(lib, bytes('protegido-sintetico.pdf'), (m) => { motivos.push(m); return Promise.resolve(motivos.length === 1 ? 'errada!' : 'senha123'); });
  const a = P.analisar(r.linhas, { hoje: '2026-10-24', regrasPadrao });
  check(motivos[0] === 'precisa' && motivos[1] === 'errada', 'PDF protegido: pede senha e avisa quando está errada');
  check(a.resumo.total === totais['protegido-sintetico.pdf'].total && a.lancs.length === totais['protegido-sintetico.pdf'].n, 'PDF protegido: lê normalmente com a senha certa');
  let tipo = ''; try { await P.lerPdf(lib, bytes('protegido-sintetico.pdf'), () => Promise.resolve(null)); } catch (e) { tipo = e.tipo; }
  check(tipo === 'senha', 'PDF protegido: cancelar a senha interrompe sem ler (' + tipo + ')');
}
// imagem
{ let tipo = ''; try { await P.lerPdf(lib, bytes('imagem-sintetico.pdf')); } catch (e) { tipo = e.tipo; } check(tipo === 'imagem', 'PDF só de imagem é recusado (sem OCR)'); }
// não-PDF
{ let tipo = ''; try { await P.lerPdf(lib, new Uint8Array([1, 2, 3, 4])); } catch (e) { tipo = e.tipo; } check(tipo === 'invalido', 'arquivo que não é PDF é recusado'); }
console.log('\n' + ok + ' ok, ' + falhas + ' falhas'); process.exit(falhas ? 1 : 0);
