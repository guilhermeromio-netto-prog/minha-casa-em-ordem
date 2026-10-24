# Fatura do cartão em PDF

Em `#/cartoes`: **Enviar PDF da fatura** → revisão → painel.

## Privacidade
- O PDF é lido **no próprio aparelho** com o pdf.js (carregado só nessa tela). **Nunca é enviado a servidor e nunca é guardado**: depois da leitura, só os lançamentos que você confirmar na revisão ficam salvos (e, se a sincronização estiver ligada, vão cifrados de ponta a ponta).
- PDF com **senha**: o app pede a senha numa janela; ela só vai para o pdf.js e não é guardada.
- **Número de cartão**: guarda-se só o final (4 dígitos). Se algum campo digitado parecer um número completo de cartão, o app **recusa e avisa** (nada é salvo).

## O que ele lê
Detecta o banco pelo texto (Nubank, Itaú e Bradesco têm perfis; há um modo genérico), extrai final do cartão, vencimento, total e lançamentos (data, descrição, parcela `n/N`, valor, estornos como negativo) e sugere categorias com regras padrão (`regrasCategoria` em `dados.json`) mais as suas regras salvas.

## Revisão antes de salvar
Mostra total lido × soma dos lançamentos, avisa de divergências e deixa editar, excluir e recategorizar. A opção **fatura de teste** marca a fatura como exemplo e ela **não entra** em comparações de mês.

## Painel
Rosca por categoria, barras por mês, anel pago × em aberto, variação em relação ao mês anterior, busca e filtro por categoria, **CSV** (BOM, vírgula decimal, proteção contra fórmula), marcar fatura como paga e desfazer.

## Limites (honestos)
- **Validado só com PDFs sintéticos** (`tools/pdfs-teste/`, gerados por `tools/gerar-pdfs-teste.py`: Nubank, Itaú, Bradesco, protegido, só imagem). **Nenhuma fatura real foi usada.** Faturas reais podem ter layouts diferentes; por isso a revisão é obrigatória e o total lido é comparado.
- Sem OCR: PDF que é só imagem é recusado com aviso.
- Não há tela de mapeamento de colunas para bancos novos (ainda).
- Outros bancos caem no modo genérico, com menos precisão.

## Testes
`node tools/teste-fatura.mjs` (parser), `node tools/teste-cartoes-calc.js` (cálculos/CSV), `python3 tools/teste-cartoes.py` (fluxo no navegador).
