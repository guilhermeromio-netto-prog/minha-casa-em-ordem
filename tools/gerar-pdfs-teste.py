#!/usr/bin/env python3
"""Gera PDFs SINTÉTICOS de fatura (dados 100% inventados) para testar o leitor. Requer: reportlab, pypdf, pillow.
Uso: /tmp/venv/bin/python tools/gerar-pdfs-teste.py   -> tools/pdfs-teste/*.pdf e totais.json"""
import json, pathlib
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from PIL import Image, ImageDraw

out = pathlib.Path(__file__).resolve().parent / 'pdfs-teste'; out.mkdir(exist_ok=True)
H = A4[1]
def br(v): s = '{:,.2f}'.format(abs(v)).replace(',', 'X').replace('.', ',').replace('X', '.'); return s
totais = {}

def doc(nome, linhas_fn):
    c = canvas.Canvas(str(out / nome), pagesize=A4); c.setTitle('FATURA SINTÉTICA DE TESTE'); y = [H - 60]
    def L(x, txt, size=10, bold=False):
        c.setFont('Helvetica-Bold' if bold else 'Helvetica', size); c.drawString(x, y[0], txt)
    def nl(n=16): y[0] -= n
    linhas_fn(c, L, nl); c.save()

# A) estilo Nubank: "05 OUT  descrição  R$ valor"
A = [('05 OUT', 'Mercado Bom Preço', 250.40), ('07 OUT', 'Uber *Viagem', 32.90), ('12 OUT', 'Netflix.com', 55.90),
     ('15 OUT', 'Loja XYZ - Parcela 03/10', 189.90), ('20 OUT', 'Estorno Loja ABC', -45.00), ('22 OUT', 'Farmácia Saúde Total', 61.20)]
totA = round(sum(x[2] for x in A), 2)
def fa(c, L, nl):
    L(50, 'Nubank - FATURA SINTÉTICA DE TESTE (dados inventados)', 12, True); nl(24)
    L(50, 'Olá, Fulano de Tal  CPF 123.456.789-09'); nl()
    L(50, 'Rua Inventada, 100 - CEP 06000-000 - Osasco'); nl()
    L(50, 'Cartão final 4321   (número de teste 5555 4444 3333 2222)'); nl(24)
    L(50, 'Valor total da fatura  R$ ' + br(totA), 12, True); nl()
    L(50, 'Data de vencimento: 10 NOV 2026'); nl()
    L(50, 'Fechamento: 03 NOV 2026'); nl(24)
    L(50, 'TRANSAÇÕES', 11, True); nl()
    L(50, '02 OUT'); L(110, 'Pagamento recebido'); L(430, '-R$ 300,00'); nl()
    for d, t, v in A:
        L(50, d); L(110, t); L(430, ('-R$ ' if v < 0 else 'R$ ') + br(v)); nl()
doc('nubank-sintetico.pdf', fa); totais['nubank-sintetico.pdf'] = {'total': totA, 'n': len(A), 'banco': 'nubank', 'vencimento': '2026-11-10', 'final': '4321', 'parcelas': 1, 'creditos': 1}

# B) estilo Itaú: tabela dd/mm DESCRIÇÃO valor, crédito com CR
B = [('03/10', 'SUPERMERCADO ABC', 410.00), ('08/10', 'FARMACIA SAUDE', 89.30), ('10/10', 'RESTAURANTE SABOR', 120.00),
     ('12/10', 'LOJA ELETRO 03/06', 380.00), ('25/10', 'POSTO COMBUSTIVEL', 151.00), ('28/10', 'ESTORNO COMPRA', -48.00)]
totB = round(sum(x[2] for x in B), 2)
def fb(c, L, nl):
    L(50, 'Itaú Unibanco - FATURA SINTÉTICA DE TESTE', 12, True); nl(24)
    L(50, 'Total desta fatura'); L(430, 'R$ ' + br(totB), 11, True); nl()
    L(50, 'Vencimento'); L(430, '15/11/2026'); nl()
    L(50, 'Fechamento'); L(430, '08/11/2026'); nl()
    L(50, 'Cartão: final 9876'); nl(24)
    L(50, 'DATA', 9, True); L(110, 'ESTABELECIMENTO', 9, True); L(430, 'VALOR EM R$', 9, True); nl()
    for d, t, v in B:
        L(50, d); L(110, t); L(430, br(v) + ('CR' if v < 0 else '')); nl()
doc('itau-sintetico.pdf', fb); totais['itau-sintetico.pdf'] = {'total': totB, 'n': len(B), 'banco': 'itau', 'vencimento': '2026-11-15', 'final': '9876', 'parcelas': 1, 'creditos': 1}

# C) genérico estilo Bradesco, datas completas, "PARC 02/05" e "Parcela 2 de 5"
C = [('02/10/2026', 'UBER TRIP', 28.50), ('04/10/2026', 'MERCADO SAO JOAO', 312.77), ('09/10/2026', 'MAGAZINE LUIZA PARC 02/05', 199.90),
     ('14/10/2026', 'ESCOLA INFANTIL BILU', 650.00), ('19/10/2026', 'SPOTIFY', 21.90), ('23/10/2026', 'CURSO ONLINE Parcela 2 de 5', 99.00)]
totC = round(sum(x[2] for x in C), 2)
def fc(c, L, nl):
    L(50, 'Bradesco Cartões - FATURA SINTÉTICA DE TESTE', 12, True); nl(24)
    L(50, 'Total da fatura: R$ ' + br(totC), 11, True); nl()
    L(50, 'Data de vencimento: 20/11/2026'); nl()
    L(50, 'Cartão ****1111'); nl(24)
    for d, t, v in C:
        L(50, d); L(140, t); L(440, br(v)); nl()
doc('bradesco-sintetico.pdf', fc); totais['bradesco-sintetico.pdf'] = {'total': totC, 'n': len(C), 'banco': 'bradesco', 'vencimento': '2026-11-20', 'final': '1111', 'parcelas': 2, 'creditos': 0}

# D) protegido por senha (cópia do A)
r = PdfReader(str(out / 'nubank-sintetico.pdf')); w = PdfWriter()
for pg in r.pages: w.add_page(pg)
w.encrypt('senha123'); w.write(str(out / 'protegido-sintetico.pdf'))
totais['protegido-sintetico.pdf'] = {'senha': 'senha123', 'total': totA, 'n': len(A)}

# E) só imagem (sem texto): "escaneada"
img = Image.new('RGB', (900, 400), 'white'); d = ImageDraw.Draw(img); d.text((30, 30), 'FATURA SINTETICA ESCANEADA  Total R$ 100,00', fill='black'); d.text((30, 80), '05/10 MERCADO 100,00', fill='black')
c = canvas.Canvas(str(out / 'imagem-sintetico.pdf'), pagesize=A4); c.drawImage(ImageReader(img), 40, H - 400, 500, 222); c.save()
totais['imagem-sintetico.pdf'] = {'imagem': True}
(out / 'totais.json').write_text(json.dumps(totais, indent=1, ensure_ascii=False))
print('ok', list(totais))
