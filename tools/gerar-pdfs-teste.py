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

# F) Itaú em DUAS COLUNAS (layout das faturas reais do Itaú Black): texto com espaços quebrados no meio de palavras e números,
#    coluna esquerda = parcelas antigas, direita = compras recentes, categoria + cidade na linha de baixo, seções de produtos/serviços e parcelas futuras.
#    TODOS os dados são inventados (cartão final 9999). Gera duas faturas (set e out) do MESMO cartão para testar comparação mês a mês e duplicidade.
import random
def quebra(txt, rng):
    """imita o PDF do Itaú: espaços soltos dentro de palavras e de números (ex.: 'ESTA BE LECIME NT O', '6.71 2,5 3')"""
    out = ''
    for i, ch in enumerate(txt):
        out += ch
        if i < len(txt) - 1 and ch != ' ' and txt[i + 1] != ' ' and rng.random() < 0.13: out += ' '
    return out
def itau_colunas(nome, venc, emis, prox, anterior, pag_dia, antigas, novas, produto, limite=20000.0):
    rng = random.Random(len(nome) * 7 + 3)
    cartao = round(sum(a[3] for a in antigas) + sum(a[2] for a in novas), 2)
    prod = produto[2]; total = round(cartao + prod, 2); minimo = round(total * 0.15, 2)
    # parcelas futuras: cada parcela antiga com n < N vira "n+1/N" (data original da compra)
    fut = [(d, desc, pa + 1, pt, v) for (d, desc, pa, v, pt, cb, ci) in [(a[0], a[1], a[2][0], a[3], a[2][1], a[4], a[5]) for a in antigas] if pa < pt]
    if produto[3] < produto[4]: fut.append((produto[0], produto[1], produto[3] + 1, produto[4], prod))
    prox_f = round(sum(f[4] for f in fut), 2); demais = round(sum(f[4] * (f[3] - f[2]) for f in fut), 2); tot_fut = round(prox_f + demais, 2)
    c = canvas.Canvas(str(out / nome), pagesize=A4); c.setTitle('FATURA SINTÉTICA DE TESTE (Itaú em colunas)')
    def T(x, y, txt, size=8, bold=False, dir=False, raw=False):
        t = txt if raw else quebra(txt, rng)
        c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
        (c.drawRightString if dir else c.drawString)(x, y, t)
    def V(x, y, v, bold=False): T(x, y, ('-' if v < 0 else '') + br(v), 8, bold, True)
    # página 1: cabeçalho
    T(50, H - 50, 'Itaú Cartões - FATURA SINTÉTICA DE TESTE (dados inventados)', 11, True, raw=True)
    T(50, H - 70, 'Cartão 5555.XXXX.XXXX.9999'); T(50, H - 82, 'Black')
    T(300, H - 110, 'Total da fatura anterior'); V(560, H - 110, anterior)
    T(300, H - 122, 'Pagamento efetuado em ' + pag_dia); V(560, H - 122, -anterior)
    T(300, H - 134, 'Lançamentos atuais'); V(560, H - 134, total)
    T(300, H - 152, 'Vencimento: ' + venc, 9, True); T(300, H - 166, '= Total desta fatura', 9, True); V(560, H - 166, total, True)
    T(300, H - 180, 'Emissão: ' + emis); T(300, H - 192, 'Próximo fechamento: ' + prox)
    T(50, H - 230, 'O total da sua fatura é:'); T(50, H - 250, 'Pagamento mínimo:', 9, True); T(50, H - 264, 'R$ ' + br(minimo), 9, True)
    T(50, H - 300, 'Limite total de crédito'); V(250, H - 300, limite); T(50, H - 312, 'Limite disponível'); V(250, H - 312, round(limite - total, 2))
    c.showPage()
    # página 2: pagamentos + compras (esquerda: parcelas antigas; direita: compras recentes)
    L0, L1, L2, LR = 40, 78, 140, 318; R0, R1, R2 = 335, 372, 555
    y = H - 50
    T(L0, y, 'Pagamentos efetuados', 9, True); y -= 14
    T(L0, y, 'DATA', 7, True, raw=True); T(L1, y, 'ESTABELECIMENTO', 7, True, raw=True); T(LR, y, 'VALOR EM R$', 7, True, True, raw=True)
    T(R0, y, 'DATA', 7, True, raw=True); T(R1, y, 'ESTABELECIMENTO', 7, True, raw=True); T(R2, y, 'VALOR EM R$', 7, True, True, raw=True); y -= 14
    T(L0, y, pag_dia[:5]); T(L1, y, 'PAGAMENTO DEB AUTOMAT'); V(LR, y, -anterior); y -= 14
    T(L1, y, 'Total dos pagamentos'); V(LR, y, -anterior); y -= 26
    T(L0, y, 'Lançamentos: compras e saques', 9, True); y -= 14
    T(L0, y, 'DATA', 7, True, raw=True); T(L1, y, 'ESTABELECIMENTO', 7, True, raw=True); T(LR, y, 'VALOR EM R$', 7, True, True, raw=True); y -= 16
    yl = y
    for (d, desc, (pa, pt), v, cb, ci) in antigas:
        T(L0, yl, d); T(L1, yl, desc + ' ' + '%02d/%02d' % (pa, pt)); V(LR, yl, v); T(L2, yl - 9.5, cb + ' ' + ci, 6.5); yl -= 24
    yr = y
    for (d, desc, v, cb, ci) in novas:
        T(R0, yr, d); T(R1, yr, desc); V(R2, yr, v); T(R1 + 20, yr - 9.5, cb + ' ' + ci, 6.5); yr -= 24
    T(R1, yr, 'Lançamentos no cartão (final 9999)', 8, True); V(R2, yr, cartao, True); yr -= 30
    T(R0, yr, 'Lançamentos: produtos e serviços', 9, True); yr -= 14
    T(R0, yr, 'DATA', 7, True, raw=True); T(R1, yr, 'PRODUTOS/SERVIÇOS', 7, True, raw=True); T(R2, yr, 'VALOR EM R$', 7, True, True, raw=True); yr -= 16
    T(R0, yr, produto[0]); T(R1, yr, produto[1] + ' %02d/%02d' % (produto[3], produto[4])); V(R2, yr, prod)
    T(R1 + 20, yr - 9.5, 'Principal (R$ %s) + Juros (R$ %s)' % (br(produto[5]), br(round(prod - produto[5], 2))), 6.5); yr -= 30
    T(R1, yr, 'Lançamentos produtos e serviços', 8, True); V(R2, yr, prod, True); yr -= 16
    T(R1, yr, 'Total dos lançamentos atuais', 8, True); V(R2, yr, total, True)
    c.showPage()
    # página 3: parcelas futuras
    y = H - 50
    T(L0, y, 'Compras parceladas - próximas faturas', 9, True); y -= 14
    T(L0, y, 'DATA', 7, True, raw=True); T(L1, y, 'ESTABELECIMENTO', 7, True, raw=True); T(LR, y, 'VALOR EM R$', 7, True, True, raw=True); y -= 16
    for (d, desc, pn, pt, v) in fut:
        T(L0, y, d); T(L1, y, desc + ' %02d/%02d' % (pn, pt)); V(LR, y, v); y -= 14
    y -= 8; T(L1, y, 'Próxima fatura', 8, True); V(LR, y, prox_f, True); y -= 14
    T(L1, y, 'Demais faturas', 8, True); V(LR, y, demais, True); y -= 14
    T(L1, y, 'Total para próximas faturas', 8, True); V(LR, y, tot_fut, True); y -= 30
    T(L0, y, 'Limites de crédito', 9, True); y -= 14
    T(L0, y, 'Esses são os seus limites na data de fechamento dessa fatura.', 7)
    c.save()
    return {'total': total, 'n': len(antigas) + len(novas) + 1, 'banco': 'itau', 'vencimento': '-'.join(venc.split('/')[::-1]), 'final': '9999', 'subtotalCartao': cartao, 'subtotalProdutos': prod,
            'minimo': minimo, 'anterior': anterior, 'futProxima': prox_f, 'futDemais': demais, 'futTotal': tot_fut, 'nFuturas': len(fut), 'parcelas': len([a for a in antigas]) + 1,
            'emissao': '-'.join(emis.split('/')[::-1]), 'cartao': cartao}
ANT_SET = [('15/03', 'MOVEIS ALFA', (6, 10), 120.00, 'casa', 'SAO PAULO'), ('20/06', 'LOJA BETA ELETRO', (3, 5), 80.50, 'eletrônicos', 'CAMPINAS'),
           ('10/07', 'CALCADOS OMEGA', (2, 4), 75.00, 'vestuário', 'SAO PAULO'), ('12/09', 'MERCADO DELTA', (1, 3), 33.33, 'supermercado', 'SAO PAULO')]
NOV_SET = [('22/08', 'PADARIA ESTRELA', 18.90, 'restaurante', 'CAMPINAS'), ('25/08', 'AUTO POSTO ZETA', 150.00, 'transporte', 'SAO PAULO'), ('30/08', 'STREAMFLIX', 39.90, 'serviços', 'SAO PAULO'),
           ('01/09', 'DROGARIA SAUDE', 45.60, 'saúde', 'CAMPINAS'), ('05/09', 'RESTAURANTE SABOR', 87.00, 'restaurante', 'CURITIBA'), ('10/09', 'SUPERMERCADO BOM DIA', 214.35, 'supermercado', 'CAMPINAS'),
           ('15/09', 'FARMACIA NOVA', 29.90, 'saúde', 'CAMPINAS'), ('18/09', 'LOJA GAMA ROUPAS', 159.90, 'vestuário', 'SAO PAULO')]
ANT_OUT = [('15/03', 'MOVEIS ALFA', (7, 10), 120.00, 'casa', 'SAO PAULO'), ('20/06', 'LOJA BETA ELETRO', (4, 5), 80.50, 'eletrônicos', 'CAMPINAS'),
           ('10/07', 'CALCADOS OMEGA', (3, 4), 75.00, 'vestuário', 'SAO PAULO'), ('12/09', 'MERCADO DELTA', (2, 3), 33.33, 'supermercado', 'SAO PAULO')]
NOV_OUT = [('23/09', 'AUTO POSTO ZETA', 140.00, 'transporte', 'SAO PAULO'), ('27/09', 'STREAMFLIX', 39.90, 'serviços', 'SAO PAULO'), ('03/10', 'SUPERMERCADO BOM DIA', 260.10, 'supermercado', 'CAMPINAS'),
           ('09/10', 'RESTAURANTE SABOR', 95.00, 'restaurante', 'CURITIBA'), ('14/10', 'FARMACIA NOVA', 52.00, 'saúde', 'CAMPINAS')]
t = itau_colunas('itau-colunas-set.pdf', '28/09/2026', '21/09/2026', '21/10/2026', 500.00, '28/08/2026', ANT_SET, NOV_SET, ('30/08', 'Pg Conta MULTA', 100.00, 1, 4, 80.00))
t['mes'] = '2026-09'; totais['itau-colunas-set.pdf'] = t
t = itau_colunas('itau-colunas-out.pdf', '28/10/2026', '21/10/2026', '21/11/2026', 1154.38, '28/09/2026', ANT_OUT, NOV_OUT, ('30/08', 'Pg Conta MULTA', 100.00, 2, 4, 80.00))
t['mes'] = '2026-10'; totais['itau-colunas-out.pdf'] = t
(out / 'totais.json').write_text(json.dumps(totais, indent=1, ensure_ascii=False))
print('ok', list(totais))
