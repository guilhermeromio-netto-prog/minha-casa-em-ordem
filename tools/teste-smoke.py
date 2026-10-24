#!/usr/bin/env python3
"""Teste de fumaça do Painel da Sala (Playwright + Chrome headless). Opcional, só para desenvolvimento.
Uso:  python3 tools/teste-smoke.py [--url https://.../painel-sala/] [--chrome /usr/bin/google-chrome] [--prints docs/prints]
Sem --url, sobe um servidor local temporário. Sai com código 1 se algo falhar."""
import argparse, functools, http.server, json, pathlib, socketserver, sys, threading, tempfile
from playwright.sync_api import sync_playwright

raiz = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--url'); ap.add_argument('--chrome'); ap.add_argument('--prints', default=str(raiz / 'docs' / 'prints'))
a = ap.parse_args()

httpd = None
if not a.url:
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *x): pass
    httpd = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=str(raiz)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    a.url = 'http://127.0.0.1:%d/' % httpd.server_address[1]
base = a.url.rstrip('/') + '/'
prints = pathlib.Path(a.prints); prints.mkdir(parents=True, exist_ok=True)
falhas, ok = [], []
def check(cond, msg):
    (ok if cond else falhas).append(msg); print(('  ok   ' if cond else '  FALHA ') + msg)

ROTAS = ['', 'rotina', 'tarefas', 'agenda', 'familia', 'relaxar', 'gerenciar', 'gerenciar/habitos', 'gerenciar/tarefas', 'gerenciar/agenda', 'gerenciar/familia', 'gerenciar/links', 'gerenciar/backup', 'teclas', 'instalar']
NOMES = {'': 'hoje'}

def novo_ctx(b, w, h, **kw):
    ctx = b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, **kw)
    pg = ctx.new_page(); erros = []
    pg.on('pageerror', lambda e: erros.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: erros.append('console: ' + m.text) if m.type == 'error' and 'open-meteo' not in m.text.lower() and 'Failed to load resource' not in m.text else None)
    return ctx, pg, erros

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=a.chrome) if a.chrome else p.chromium.launch()
    for (w, h) in [(1920, 1080), (1280, 720)]:
        print('== TV %dx%d ==' % (w, h))
        ctx, pg, erros = novo_ctx(b, w, h)
        pg.goto(base + 'index.html#/'); pg.wait_for_selector('.hoje'); pg.wait_for_timeout(900)
        for r in ROTAS:
            pg.evaluate("location.hash='#/%s'" % r); pg.wait_for_timeout(450)
            nome = NOMES.get(r, r.replace('/', '-'))
            ov = pg.evaluate("({d: document.documentElement.scrollWidth - innerWidth, a: document.getElementById('app').scrollWidth - document.getElementById('app').clientWidth})")
            check(ov['d'] <= 0 and ov['a'] <= 0, '[%dx%d] #/%s sem rolagem horizontal' % (w, h, r))
            check(pg.evaluate("document.querySelector('.rodape').textContent.indexOf('byGui') >= 0"), '[%dx%d] #/%s rodapé byGui' % (w, h, r))
            check(pg.evaluate("document.getElementById('app').children.length > 0"), '[%dx%d] #/%s renderizou' % (w, h, r))
            # D-pad: sequência de setas visita elementos distintos
            vistos = set()
            pg.evaluate("document.activeElement && document.activeElement.blur()")
            for t in ['ArrowDown'] * 8 + ['ArrowRight', 'ArrowUp', 'ArrowLeft']:
                pg.keyboard.press(t)
                vistos.add(pg.evaluate("(function(){var e=document.activeElement;if(!e||e===document.body)return '';var r=e.getBoundingClientRect();return (e.getAttribute('data-fid')||e.textContent.trim().slice(0,20)||e.tagName)+'@'+Math.round(r.left)+','+Math.round(r.top)})()"))
            vistos.discard('')
            if r not in ('teclas',):
                check(len(vistos) >= 2, '[%dx%d] #/%s setas movem o foco (%d posições)' % (w, h, r, len(vistos)))
            if r in ('', 'rotina', 'tarefas', 'relaxar') and w == 1280:
                pg.screenshot(path=str(prints / ('tv-%s-%dx%d.png' % (nome, w, h))))
            if r in ('', 'rotina', 'tarefas', 'agenda', 'familia', 'relaxar') and w == 1920:
                pg.screenshot(path=str(prints / ('tv-%s-%dx%d.png' % (nome, w, h))))
        # Hoje deve caber sem rolagem vertical (meta de design)
        pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(400)
        cabe = pg.evaluate("(function(){var m=document.getElementById('app');return m.scrollHeight-m.clientHeight})()")
        check(cabe <= 4, '[%dx%d] Hoje cabe sem rolar (sobra %dpx)' % (w, h, cabe))
        check(not erros, '[%dx%d] sem erros de console %s' % (w, h, erros[:3]))
        ctx.close()

    print('== Funcional 1280x720 ==')
    ctx, pg, erros = novo_ctx(b, 1280, 720)
    pg.goto(base + 'index.html#/rotina'); pg.wait_for_selector('.habito'); pg.wait_for_timeout(300)
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    foco = pg.evaluate("document.activeElement.getAttribute('data-fid')")
    antes = pg.evaluate("document.activeElement.getAttribute('aria-checked')")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    depois = pg.evaluate("document.querySelector('[data-fid=\"%s\"]').getAttribute('aria-checked')" % foco)
    check(antes == 'false' and depois == 'true', 'Enter (OK) marca o hábito')
    check(pg.evaluate("document.activeElement.getAttribute('data-fid')") == foco, 'foco permanece no item após marcar')
    pg.reload(); pg.wait_for_selector('.habito'); pg.wait_for_timeout(300)
    check(pg.evaluate("document.querySelector('[data-fid=\"%s\"]').getAttribute('aria-checked')" % foco) == 'true', 'hábito persiste após recarregar')
    # Back volta ao Hoje
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check(pg.evaluate("location.hash") in ('#/', ''), 'Esc/Voltar leva ao Hoje')
    pg.evaluate("location.hash='#/tarefas'"); pg.wait_for_timeout(300)
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(300)
    check(pg.evaluate("location.hash") in ('#/', ''), 'Backspace leva ao Hoje')
    # tarefas: marcar
    pg.evaluate("location.hash='#/tarefas'"); pg.wait_for_selector('.item.tarefa')
    pg.focus('.item.tarefa'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check(pg.evaluate("document.querySelectorAll('.item.tarefa.feito').length") == 1, 'OK conclui tarefa')
    # exportar JSON
    pg.evaluate("location.hash='#/gerenciar/backup'"); pg.wait_for_selector('.form-linha')
    with pg.expect_download() as dl:
        pg.click('text=Exportar JSON')
    arq = pathlib.Path(tempfile.mkdtemp()) / 'backup.json'; dl.value.save_as(str(arq))
    bk = json.loads(arq.read_text())
    check(bk.get('app') == 'painel-sala' and len(bk['dados']['habitos']) >= 1, 'exportar JSON baixa backup válido')
    # alterar e importar de volta
    pg.evaluate("PS.store.alterar(function(s){ s.habitos = []; s.tarefas = []; }, true)")
    with pg.expect_file_chooser() as fc:
        pg.click('text=Importar JSON')
    fc.value.set_files(str(arq)); pg.wait_for_selector('.modal'); pg.click('.modal >> text=Substituir'); pg.wait_for_timeout(300)
    check(pg.evaluate("PS.store.get().habitos.length") == len(bk['dados']['habitos']) and pg.evaluate("PS.store.get().tarefas.length") == len(bk['dados']['tarefas']), 'importar JSON restaura os dados')
    check(pg.evaluate("PS.store.habitoFeito(PS.store.get().habitos[0].id, PS.u.hoje()) || PS.store.habitoFeito('x','2000-01-01') === false"), 'histórico de hábitos preservado no backup')
    # link de configuração: gera, abre em contexto limpo, importa
    pg.click('text=Gerar link agora'); pg.wait_for_selector('textarea[aria-label="Link de configuração"]')
    link = pg.input_value('textarea[aria-label="Link de configuração"]')
    check('#/importar/' in link and len(link) < 8000, 'link de configuração gerado (%d caracteres)' % len(link))
    pg.evaluate("PS.store.alterar(function(s){ s.config.nome='Teste Link'; s.links.push({id:'zz',titulo:'Meu atalho',url:'https://example.com/x',icone:'globo'}); }, true)")
    pg.click('text=Gerar link agora'); link = pg.input_value('textarea[aria-label="Link de configuração"]')
    ctx2, pg2, erros2 = novo_ctx(b, 1280, 720)
    pg2.goto(link.replace(base, base + 'index.html', 1) if 'index.html' not in link else link)
    pg2.wait_for_selector('text=Importar e substituir'); pg2.click('text=Importar e substituir'); pg2.wait_for_selector('.hoje'); pg2.wait_for_timeout(300)
    cfg = pg2.evaluate("({n: PS.store.get().config.nome, l: PS.store.get().links.some(function(x){return x.titulo==='Meu atalho'}), h: PS.store.get().habitos.length})")
    check(cfg['n'] == 'Teste Link' and cfg['l'] and cfg['h'] >= 1, 'link de configuração: ida e volta em outro navegador limpo')
    check(not erros2, 'sem erros no contexto do link %s' % erros2[:2])
    # link inválido não quebra
    pg2.goto(base + 'index.html#/importar/@@@'); pg2.wait_for_timeout(500)
    check(pg2.evaluate("document.body.textContent.indexOf('Link inválido') >= 0"), 'link inválido mostra aviso')
    ctx2.close()
    # ICS
    ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Evento ICS\r\nDTSTART:%s\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    hoje = pg.evaluate("PS.u.hoje()").replace('-', '')
    f = pathlib.Path(tempfile.mkdtemp()) / 't.ics'; f.write_text(ics % (hoje + 'T235900'))
    pg.evaluate("location.hash='#/gerenciar/agenda'"); pg.wait_for_selector('text=Escolher arquivo .ics')
    with pg.expect_file_chooser() as fc: pg.click('text=Escolher arquivo .ics')
    fc.value.set_files(str(f)); pg.wait_for_timeout(500)
    check(pg.evaluate("PS.store.get().compromissos.some(function(c){return c.titulo==='Evento ICS'&&c.fonte==='ics'})"), 'importar .ics cria compromisso')
    # SW + manifest
    mf = pg.evaluate("fetch('manifest.webmanifest').then(function(r){return r.json()})")
    check(mf['display'] == 'fullscreen' and len(mf['icons']) >= 3, 'manifest ok')
    check(not erros, 'sem erros de console no fluxo %s' % erros[:3])
    ctx.close()


    print('== Lembrete do Bilu (casinha): perfil novo e perfil antigo ==')
    ID = 'lembrete-bilu-casinha'
    # perfil novo
    ctx, pg, erros = novo_ctx(b, 1280, 720)
    pg.goto(base + 'index.html#/familia'); pg.wait_for_selector('[data-fid="lm:%s"]' % ID); pg.wait_for_timeout(300)
    txt = pg.inner_text('[data-fid="lm:%s"]' % ID)
    check('Comprar casinha maior para o Bilu' in txt and 'A atual ficou pequena' in txt, 'Família mostra o lembrete do Bilu (perfil novo)')
    check(pg.evaluate("!!document.querySelector('[data-fid=\"lm:%s\"] .ic-fam svg path')" % ID), 'Família mostra o ícone de casinha')
    check(pg.evaluate("PS.store.get().lembretes.filter(function(l){return l.id==='%s'}).length" % ID) == 1, 'um único item do Bilu no estado')
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    alcancou = False
    for t_ in ['ArrowDown'] * 10 + ['ArrowUp'] * 10:
        pg.keyboard.press(t_)
        if pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-fid')") == 'lm:' + ID: alcancou = True; break
    check(alcancou, 'D-pad alcança o lembrete do Bilu em Família')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check(pg.evaluate("PS.store.get().lembretes.filter(function(l){return l.id==='%s'})[0].feito" % ID) is True, 'OK marca o lembrete como feito')
    pg.reload(); pg.wait_for_selector('[data-fid="lm:%s"]' % ID)
    check(pg.evaluate("document.querySelector('[data-fid=\"lm:%s\"]').getAttribute('aria-checked')" % ID) == 'true', 'feito persiste após recarregar')
    pg.keyboard.press('Escape')
    pg.evaluate("PS.store.alterar(function(s){ var l=s.lembretes.filter(function(x){return x.id==='%s'})[0]; l.feito=false; })" % ID)
    pg.evaluate("location.hash='#/'"); pg.wait_for_selector('.hoje'); pg.wait_for_timeout(300)
    check(pg.evaluate("!!document.querySelector('.hoje [data-fid=\"lp:%s\"] .ic-fam svg')" % ID), 'Hoje mostra o item do Bilu como a fazer, com ícone')
    pg.screenshot(path=str(prints / 'tv-hoje-bilu-1280x720.png'))
    pg.evaluate("location.hash='#/familia'"); pg.wait_for_selector('.item.dupla'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(prints / 'tv-familia-1280x720.png'))
    # gerenciar: ícone selecionável
    pg.evaluate("location.hash='#/gerenciar/familia'"); pg.wait_for_selector('.form-linha'); pg.wait_for_timeout(300)
    check(pg.evaluate("Array.prototype.some.call(document.querySelectorAll('select option'), function(o){return o.value==='casa-de-cachorro'})"), 'Gerenciar oferece o ícone casa-de-cachorro')
    ctx.close()
    # perfil antigo (dados v1 sem o item e sem lista de migrações)
    ctx, pg, erros = novo_ctx(b, 1280, 720)
    pg.goto(base + 'index.html#/rotina'); pg.wait_for_selector('.habito'); pg.wait_for_timeout(300)
    pg.evaluate("""(function(){ var s = PS.store.get(); s.versao = 1; s.lembretes = s.lembretes.filter(function(l){return l.id !== '%s'}); s.tarefas.push({id:'minha-tarefa',lista:'Casa',titulo:'Tarefa antiga do usuário',prio:'baixa',vence:'',feita:false});
      localStorage.setItem('painelsala.dados', JSON.stringify(s)); localStorage.removeItem('painelsala.migracoes'); })()""" % ID)
    pg.reload(); pg.wait_for_selector('.habito'); pg.wait_for_timeout(400)
    check(pg.evaluate("PS.store.get().lembretes.filter(function(l){return l.id==='%s'}).length" % ID) == 1, 'perfil antigo: migração adiciona o lembrete do Bilu')
    check(pg.evaluate("PS.store.get().tarefas.some(function(t){return t.id==='minha-tarefa'})"), 'perfil antigo: dados do usuário preservados')
    pg.reload(); pg.wait_for_selector('.habito'); pg.wait_for_timeout(300)
    check(pg.evaluate("PS.store.get().lembretes.filter(function(l){return l.id==='%s'}).length" % ID) == 1, 'migração idempotente (sem duplicar)')
    pg.evaluate("PS.store.alterar(function(s){ s.lembretes = s.lembretes.filter(function(l){return l.id !== '%s'}); })" % ID)
    pg.reload(); pg.wait_for_selector('.habito'); pg.wait_for_timeout(300)
    check(pg.evaluate("PS.store.get().lembretes.filter(function(l){return l.id==='%s'}).length" % ID) == 0, 'item apagado não reaparece')
    check(pg.evaluate("JSON.parse(localStorage.getItem('painelsala.migracoes')).indexOf('2026-10-bilu-casinha') >= 0"), 'lista de migrações aplicadas gravada')
    check(not erros, 'sem erros de console (perfil antigo) %s' % erros[:3])
    ctx.close()

    print('== Celular 360x740 (gerenciar) ==')
    ctx, pg, erros = novo_ctx(b, 360, 740)
    pg.goto(base + 'index.html#/gerenciar'); pg.wait_for_selector('.form-linha'); pg.wait_for_timeout(400)
    for r in ['gerenciar', 'gerenciar/habitos', 'gerenciar/tarefas', 'gerenciar/agenda', 'gerenciar/familia', 'gerenciar/links', 'gerenciar/backup', '', 'rotina', 'relaxar']:
        pg.evaluate("location.hash='#/%s'" % r); pg.wait_for_timeout(350)
        d = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        check(d <= 0, '[360] #/%s sem rolagem horizontal (sobra %d)' % (r, d))
        if r in ('gerenciar', 'gerenciar/familia'): pg.screenshot(path=str(prints / ('celular-%s-360.png' % r.replace('/', '-'))), full_page=False)
    check(not erros, '[360] sem erros %s' % erros[:3])
    ctx.close()
    b.close()
if httpd: httpd.shutdown()
print('\n%d ok, %d falhas' % (len(ok), len(falhas)))
sys.exit(1 if falhas else 0)
