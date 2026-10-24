#!/usr/bin/env python3
"""Gera os PNGs de icone (PWA/favicon) a partir de assets/favicon.svg usando Chrome headless via Playwright.
Uso (opcional, so quando mudar o logo):  python3 tools/gerar-icones.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
raiz = pathlib.Path(__file__).resolve().parent.parent
svg = (raiz / "assets" / "favicon.svg").read_text()
def pagina(tam, margem):
    # margem: fracao reservada ao redor do desenho (maskable precisa de zona segura)
    return f"""<html><body style="margin:0;background:#0A0A0A;width:{tam}px;height:{tam}px;display:flex;align-items:center;justify-content:center">
<div style="width:{int(tam*(1-2*margem))}px;height:{int(tam*(1-2*margem))}px">{svg.replace('<rect width="96" height="96" rx="20" fill="#0A0A0A"/>','')}</div></body></html>"""
saidas = [("icon-192.png",192,.08),("icon-512.png",512,.08),("icon-maskable-512.png",512,.2),("apple-touch-icon.png",180,.08),("favicon-32.png",32,.04)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=sys.argv[1] if len(sys.argv)>1 else None)
    for nome, tam, m in saidas:
        pg = b.new_page(viewport={"width":tam,"height":tam})
        pg.set_content(pagina(tam, m)); pg.screenshot(path=str(raiz/"icons"/nome)); pg.close()
    b.close()
print("ok")
