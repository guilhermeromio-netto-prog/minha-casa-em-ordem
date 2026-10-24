#!/usr/bin/env python3
"""Gera o código JS (para a ferramenta `execute` do conector Cloudflare) que publica o portal como UM Worker 'minha-casa-em-ordem':
 - os arquivos de dist/ vão EMBUTIDOS no Worker (gzip + base64 em assets.js) e servidos atrás do login;
   (o envio de Workers Static Assets exige um JWT próprio que o `execute` não deixa passar; embutir cabe com folga: ~0,7 MB gzip, limite do plano grátis 3 MB);
 - portal-worker/worker.js é o portal; main.js é só um adaptador que dá ao portal um env.ASSETS feito com os arquivos embutidos;
 - bindings: D1 (DB) e o segredo PEPPER.
O PEPPER é lido de um ARQUIVO fora do repositório (--pepper) e vai só dentro do arquivo gerado (--saida), que também deve ficar fora do repositório.
Uso: bash tools/montar-dist.sh && python3 tools/gerar-deploy-cloudflare.py --d1 <uuid> --pepper /workspace/keys/pepper.txt --saida /workspace/keys/03-deploy.js
Sem --pepper o segredo existente é mantido (keep_bindings)."""
import argparse, base64, gzip, json, mimetypes, pathlib
ap = argparse.ArgumentParser()
ap.add_argument('--d1', required=True); ap.add_argument('--pepper'); ap.add_argument('--saida', required=True); ap.add_argument('--nome', default='minha-casa-em-ordem'); ap.add_argument('--modulos', help='também grava main.js/worker.js/assets.js nesta pasta (para testar localmente com wrangler dev)')
a = ap.parse_args()
raiz = pathlib.Path(__file__).resolve().parent.parent
dist = raiz / 'dist'
TIPOS = {'.mjs': 'text/javascript', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png'}
arqs = {}
for f in sorted(dist.rglob('*')):
    if not f.is_file(): continue
    arqs['/' + f.relative_to(dist).as_posix()] = {'t': TIPOS.get(f.suffix, mimetypes.guess_type(f.name)[0] or 'application/octet-stream') + ('; charset=utf-8' if f.suffix in ('.js', '.mjs', '.css', '.json', '.html', '.webmanifest', '.svg') else ''),
                                                  'g': base64.b64encode(gzip.compress(f.read_bytes(), 9, mtime=0)).decode()}
assets_js = 'export default ' + json.dumps(arqs) + ';\n'
MAIN = """import base from './worker.js';
import ARQ from './assets.js';
var gzCache = new Map(), plainCache = new Map();
function gzBytes(p) { var b = gzCache.get(p); if (!b) { var bin = atob(ARQ[p].g), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); gzCache.set(p, b = u); } return b; }
async function plano(p) { var u = plainCache.get(p); if (!u) { var r = new Response(new Blob([gzBytes(p)]).stream().pipeThrough(new DecompressionStream('gzip'))); u = new Uint8Array(await r.arrayBuffer()); plainCache.set(p, u); } return u; }
var ASSETS = { async fetch(req) {
  var p = new URL(req.url).pathname; if (p === '/') p = '/index.html';
  if (!Object.prototype.hasOwnProperty.call(ARQ, p)) return new Response('Not found', { status: 404 });
  var u = await plano(p);
  return new Response(req.method === 'HEAD' ? null : u, { status: 200, headers: { 'Content-Type': ARQ[p].t, 'Content-Length': String(u.length) } });
} };
export default { fetch: function (req, env, ctx) { return base.fetch(req, Object.assign({}, env, { ASSETS: ASSETS }), ctx); } };
"""
worker = (raiz / 'portal-worker' / 'worker.js').read_text()
if a.modulos:
    m = pathlib.Path(a.modulos); m.mkdir(parents=True, exist_ok=True)
    (m / 'main.js').write_text(MAIN); (m / 'worker.js').write_text(worker); (m / 'assets.js').write_text(assets_js)
pepper = pathlib.Path(a.pepper).read_text().strip() if a.pepper else None
dados = {'nome': a.nome, 'd1': a.d1, 'worker': worker, 'main': MAIN, 'assets': assets_js, 'pepper': pepper}
codigo = """async () => {
  const D = %s;
  const bindings = [{ type: 'd1', name: 'DB', id: D.d1 }];
  if (D.pepper) bindings.push({ type: 'secret_text', name: 'PEPPER', text: D.pepper });
  const meta = { main_module: 'main.js', compatibility_date: '2025-09-01', bindings };
  if (!D.pepper) meta.keep_bindings = ['secret_text'];
  const b = '----MCOW' + Date.now();
  const parte = (nome, tipo, txt) => `--${b}\r\nContent-Disposition: form-data; name="${nome}"; filename="${nome}"\r\nContent-Type: ${tipo}\r\n\r\n${txt}\r\n`;
  const body = `--${b}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n` + parte('main.js', 'application/javascript+module', D.main) + parte('worker.js', 'application/javascript+module', D.worker) + parte('assets.js', 'application/javascript+module', D.assets) + `--${b}--\r\n`;
  const put = await cloudflare.request({ method: 'PUT', path: `/accounts/${accountId}/workers/scripts/${D.nome}`, body, contentType: 'multipart/form-data; boundary=' + b, rawBody: true });
  const sub = await cloudflare.request({ method: 'POST', path: `/accounts/${accountId}/workers/scripts/${D.nome}/subdomain`, body: { enabled: true, previews_enabled: false } });
  return { worker: put.result && put.result.id, modificado: put.result && put.result.modified_on, tamanho_kb: Math.round(body.length / 1024), subdominio: sub.result };
}""" % json.dumps(dados)
out = pathlib.Path(a.saida); out.write_text(codigo); out.chmod(0o600)
print('gerado %s (%d KB, %d arquivos, assets.js %d KB)' % (out, out.stat().st_size // 1024, len(arqs), len(assets_js) // 1024))
