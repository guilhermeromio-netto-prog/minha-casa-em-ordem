#!/usr/bin/env python3
"""Testa o portal (login na frente do app) em um Worker LOCAL (wrangler dev) com D1 local e contas de teste.
Uso: python3 tools/teste-portal.py --url http://127.0.0.1:8799 [--chrome CAMINHO]
Pré-requisito: contas gui@teste.local / esposa@teste.local com os links de teste do seed (veja docs/CLOUDFLARE.md). NUNCA rode contra produção: trava contas de verdade."""
import argparse, json, re, sys, urllib.request, urllib.error
ap = argparse.ArgumentParser(); ap.add_argument('--url', required=True); ap.add_argument('--chrome'); a = ap.parse_args()
B = a.url.rstrip('/')
if 'workers.dev' in B or 'pages.dev' in B: sys.exit('Recusado: este teste trava contas e só roda em ambiente local.')
T_GUI, T_ESP = 'tokenTesteGuiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'tokenTesteEspBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
ok, falhas = [], []
def check(c, m): (ok if c else falhas).append(m); print(('  ok   ' if c else '  FALHA ') + m)
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *x, **k): return None
op = urllib.request.build_opener(NoRedir)
def req(path, method='GET', body=None, cookie=None, html=False, origin=True, hdr=None):
    h = {'User-Agent': 'teste-portal'}
    if html: h['Accept'] = 'text/html'; h['Sec-Fetch-Mode'] = 'navigate'
    if cookie: h['Cookie'] = cookie
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'; h['X-MCO'] = '1'
        if origin: h['Origin'] = B
    h.update(hdr or {})
    r = urllib.request.Request(B + path, data=data, headers=h, method=method)
    try: x = op.open(r); st = x.status
    except urllib.error.HTTPError as e: x = e; st = e.code
    corpo = x.read(); hs = {k.lower(): v for k, v in x.headers.items()}
    return st, hs, corpo
def j(c): 
    try: return json.loads(c)
    except Exception: return {}
def cookie_de(hs): 
    m = re.match(r'(__Host-mco=[^;]*)', hs.get('set-cookie', '')); return m.group(1) if m else None
print('== sem sessão')
st, hs, _ = req('/', html=True); check(st == 302 and hs.get('location') == '/login', 'navegação sem sessão: 302 para /login')
for p in ['/index.html', '/js/app.js', '/js/store.js', '/sw.js', '/dados.json', '/css/app.css', '/js/vendor/pdfjs/pdf.min.mjs', '/api/me', '/conta', '/js/cartoes.js']:
    st, hs, c = req(p); check(st in (401, 302), '%s sem sessão = %d' % (p, st)); 
    check(b'function' not in c[:2000] and b'PS.' not in c, '%s sem sessão não vaza código' % p)
for p, tp in [('/login', 'text/html'), ('/manifest.webmanifest', 'application/manifest+json'), ('/icons/icon-192.png', 'image/png'), ('/assets/favicon.svg', 'image/svg+xml'), ('/assets/logo.svg', 'image/svg+xml'), ('/api/saude', 'application/json')]:
    st, hs, c = req(p); check(st == 200 and tp in hs.get('content-type', ''), '%s público (200, %s)' % (p, tp))
st, hs, c = req('/login'); check(b'Entrar' in c and b'byGui' in c, 'login com rodapé byGui')
check("script-src 'self'" in hs.get('content-security-policy', '') and hs.get('x-content-type-options') == 'nosniff' and hs.get('referrer-policy') == 'no-referrer' and hs.get('x-frame-options') == 'DENY', 'cabeçalhos de segurança no login')
st, hs, c = req('/js/app.js'); check('content-security-policy' in hs and hs.get('cache-control') == 'no-store', 'cabeçalhos de segurança também no 401')
print('== login com erro')
s1, _, c1 = req('/api/login', 'POST', {'email': 'gui@teste.local', 'senha': 'qualquer coisa errada'})
s2, _, c2 = req('/api/login', 'POST', {'email': 'ninguem@teste.local', 'senha': 'qualquer coisa errada'})
check(s1 == 401 and s2 == 401 and j(c1)['erro'] == j(c2)['erro'], 'mensagem igual para e-mail certo/errado (sem enumerar contas)')
st, _, c = req('/api/login', 'POST', {'email': 'gui@teste.local', 'senha': 'x'}, origin=False); check(st == 403, 'login sem Origin é recusado (CSRF)')
st, _, c = req('/api/login', 'POST', {'email': 'gui@teste.local', 'senha': 'x'}, hdr={'Origin': 'https://evil.example'}); check(st == 403, 'login com Origin de outro site é recusado')
st, _, c = req('/api/definir-senha', 'POST', {'token': 'tokenInexistenteCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', 'senha': 'umaSenhaLonga123'}); check(st == 400, 'link inexistente é recusado')
print('== primeiro acesso')
st, hs, c = req('/api/definir-senha', 'POST', {'token': T_GUI, 'senha': 'curta'}); check(st == 400 and 'pelo menos' in j(c)['erro'], 'senha curta é recusada')
st, hs, c = req('/api/definir-senha', 'POST', {'token': T_GUI, 'senha': 'gui@teste.local-123'}); check(st == 400, 'senha contendo o e-mail é recusada')
SENHA_GUI = 'Casa-Senha-De-Teste-77!'
st, hs, c = req('/api/definir-senha', 'POST', {'token': T_GUI, 'senha': SENHA_GUI}); ck = cookie_de(hs)
check(st == 200 and ck is not None, 'link válido cria a senha e abre a sessão')
sc = hs.get('set-cookie', '')
check(all(x in sc for x in ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=']) and 'Domain' not in sc and sc.startswith('__Host-'), 'cookie: __Host-, HttpOnly, Secure, SameSite=Strict, sem Domain')
st, hs, c = req('/api/definir-senha', 'POST', {'token': T_GUI, 'senha': 'Outra-Senha-Longa-99!'}); check(st == 400, 'o mesmo link não funciona duas vezes')
print('== com sessão')
st, hs, c = req('/', cookie=ck, html=True); check(st == 200 and b'Minha Casa em Ordem' in c, 'app carrega com sessão')
for p, tp in [('/js/app.js', 'javascript'), ('/js/vendor/pdfjs/pdf.min.mjs', 'javascript'), ('/js/vendor/pdfjs/pdf.worker.min.mjs', 'javascript'), ('/sw.js', 'javascript'), ('/dados.json', 'json'), ('/css/app.css', 'css')]:
    st, hs, c = req(p, cookie=ck); check(st == 200 and tp in hs.get('content-type', ''), '%s com sessão (%s)' % (p, hs.get('content-type')))
st, hs, c = req('/sw.js', cookie=ck); check(hs.get('service-worker-allowed') == '/' and 'no-cache' in hs.get('cache-control', ''), 'sw.js: escopo / e sem cache')
st, hs, c = req('/api/me', cookie=ck); check(st == 200 and j(c)['papel'] == 'admin' and j(c)['email'] == 'gui@teste.local', 'GET /api/me = admin')
st, hs, c = req('/api/conta/usuarios', cookie=ck); us = j(c).get('usuarios', []); check(st == 200 and len(us) == 2 and all(u['papel'] == 'admin' for u in us), 'lista as 2 contas, ambas admin')
check('senha' not in c.decode() and 'hash' not in c.decode().lower(), 'lista de contas não expõe senha/hash')
st, hs, c = req('/api/logout', 'POST', {}, cookie=ck, origin=False); check(st == 403, 'logout sem Origin é recusado (CSRF)')
st, hs, c = req('/index.html', cookie='__Host-mco=' + 'a' * 43); check(st == 401, 'cookie falso não entra')
print('== esposa (outro admin) e reset')
SENHA_ESP = 'Lar-Senha-De-Teste-55!'
st, hs, c = req('/api/definir-senha', 'POST', {'token': T_ESP, 'senha': SENHA_ESP}); ck2 = cookie_de(hs); check(st == 200, 'esposa cria senha pelo link dela')
st, hs, c = req('/api/conta/usuarios', cookie=ck2); check(st == 200, 'esposa também é admin (lista contas)')
id_esp = [u for u in us if u['email'].startswith('esposa')][0]['id']
st, hs, c = req('/api/conta/gerar-link', 'POST', {'id': id_esp}, cookie=ck); lk = j(c).get('link', ''); check(st == 200 and '/primeiro-acesso?t=' in lk, 'admin gera novo link para o outro admin')
st, hs, c = req('/', cookie=ck2, html=True); check(st == 302, 'sessões da esposa foram encerradas pelo reset')
st, hs, c = req('/api/login', 'POST', {'email': 'esposa@teste.local', 'senha': SENHA_ESP}); check(st == 401, 'senha antiga da esposa deixa de valer')
tk = lk.split('t=')[1]
st, hs, c = req('/api/definir-senha', 'POST', {'token': tk, 'senha': 'Lar-Nova-Senha-31!'}); check(st == 200, 'novo link funciona uma vez')
st, hs, c = req('/api/definir-senha', 'POST', {'token': tk, 'senha': 'Lar-Outra-Senha-32!'}); check(st == 400, 'e não funciona de novo')
print('== logout e bloqueio')
st, hs, c = req('/api/login', 'POST', {'email': 'gui@teste.local', 'senha': SENHA_GUI}); ck = cookie_de(hs); check(st == 200 and ck, 'login com senha certa')
st, hs, c = req('/api/logout', 'POST', {}, cookie=ck); check(st == 200 and 'Max-Age=0' in hs.get('set-cookie', ''), 'logout limpa o cookie')
st, hs, c = req('/index.html', cookie=ck); check(st == 401, 'cookie antigo não vale depois do logout')
for i in range(5): req('/api/login', 'POST', {'email': 'gui@teste.local', 'senha': 'errada-%d' % i})
st, hs, c = req('/api/login', 'POST', {'email': 'gui@teste.local', 'senha': SENHA_GUI}); check(st == 429 and 'bloqueada' in j(c)['erro'], '5 erros bloqueiam a conta, até com a senha certa (%d)' % st)
st, hs, c = req('/api/me', cookie=cookie_de({'set-cookie': ''}) or '');
print('\n%d ok / %d falhas' % (len(ok), len(falhas)))
sys.exit(1 if falhas else 0)
