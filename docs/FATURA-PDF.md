# Fatura do cartão em PDF

Em `#/cartoes`: **Enviar PDF da fatura** → revisão → painel.

## Privacidade
- O PDF é lido **no próprio aparelho** com o pdf.js (carregado só nessa tela). **Nunca é enviado a servidor e nunca é guardado**: depois da leitura, só os lançamentos que você confirmar na revisão ficam salvos (e, se a sincronização estiver ligada, vão cifrados de ponta a ponta).
- PDF com **senha**: o app pede a senha numa janela; ela só vai para o pdf.js e não é guardada.
- **Número de cartão**: guarda-se só o final (4 dígitos). Se algum campo digitado parecer um número completo de cartão, o app **recusa e avisa** (nada é salvo).

## O que ele lê
Detecta o banco pelo texto (Nubank, Itaú e Bradesco têm perfis; há um modo genérico), extrai final do cartão, vencimento, total e lançamentos (data, descrição, parcela `n/N`, valor, estornos como negativo) e sugere categorias com regras padrão (`regrasCategoria` em `dados.json`) mais as suas regras salvas.

### Itaú (fatura em duas colunas, ex.: Itaú Black)
É o perfil mais completo, escrito a partir de **uma fatura real** (Itaú Black, set/2026) e reproduzido em PDFs sintéticos. Lê por **posição do texto** (pdf.js entrega x/y de cada trecho), porque o PDF do Itaú vem com espaços soltos no meio de palavras e números (`6.71 2,5 3`) e com duas colunas por página.
- **Cabeçalho:** final do cartão, produto (Black…), vencimento, emissão (o Itaú fecha na emissão), próximo fechamento, total da fatura, pagamento mínimo, total da fatura anterior, limite total/disponível.
- **Lançamentos:** data, descrição, parcela `n/N`, valor, **categoria do banco** (linha de baixo, ex. "vestuário", "supermercado") e **cidade**. A categoria final segue a prioridade: regra sua > categoria do banco > regras padrão > "outros". O ano das parcelas antigas é inferido pelo vencimento (a compra nunca fica depois dele).
- **Multa/juros:** entram como lançamento próprio, na categoria **Multas e juros** (`encargos`), com o principal e os juros na descrição.
- **Ignorado na soma:** o pagamento da fatura anterior e a seção de parcelas futuras (não são gastos do mês).
- **Compromissos futuros:** a seção "compras parceladas - próximas faturas" vira um cartão na tela (próxima fatura, demais faturas, total e as maiores parcelas). Fica guardada na fatura, como informação do banco; não soma no mês.
- **Não é guardado:** nome do titular, endereço, CPF e número completo do cartão (só o final).
- **Conferência na revisão:** compras no cartão + produtos e serviços = total dos lançamentos = total da fatura, cada um comparado com o que o banco declara (centavos exatos), mais a soma por categoria. Se algo não bate, a confiança cai e o aviso aparece.

## Revisão antes de salvar
Mostra total lido × soma dos lançamentos, avisa de divergências e deixa editar, excluir e recategorizar. A opção **fatura de teste** marca a fatura como exemplo e ela **não entra** em comparações de mês.

## Mês a mês e duplicidade
- Cada PDF é uma fatura do cartão (reconhecido pelo **final**); a de outubro entra ao lado da de setembro e a comparação com o mês anterior usa as duas.
- Enviar de novo a **mesma fatura** (mesmo cartão + mesmo vencimento/mês) não duplica: o app avisa e pergunta **Substituir** ou **Cancelar**. Substituir troca os lançamentos e valores, mantendo a fatura (inclusive se já estava marcada como paga).

## Painel
Rosca por categoria, barras por mês, anel pago × em aberto, variação em relação ao mês anterior, busca e filtro por categoria, parcelas em andamento, **compromissos futuros** (Itaú), **CSV** (BOM, vírgula decimal, proteção contra fórmula), marcar fatura como paga e desfazer.

## Limites (honestos)
- **Validado com 1 fatura real** do Itaú Black (set/2026, testada só localmente: os 69 lançamentos somam o total e os subtotais do banco, ao centavo) **+ PDFs sintéticos** (`tools/pdfs-teste/`, gerados por `tools/gerar-pdfs-teste.py`: Nubank, Itaú simples, Itaú em duas colunas set/out, Bradesco, protegido, só imagem). A fatura real **não está no repositório** (ele é público); o teste real roda só com `FATURA_REAL_PDF=/caminho.pdf node tools/teste-fatura.mjs` e imprime apenas totais e contagens.
- Outros produtos do Itaú (Platinum, Click, Personnalité…) e meses com **parcelamento de fatura, rotativo ou IOF** podem ter linhas que não vi: a conferência dos subtotais avisa quando algo não fecha.
- Descrições do Itaú vêm sem espaço entre palavras ("MERCADOBOMPRECO"). Há um separador simples para palavras comuns (supermercado, posto, farmácia…), mas nomes desconhecidos ficam como vieram; edite na revisão ou use "lembrar para esta loja".
- A categoria sugerida pode errar (ex.: seguro de viagem caindo em Viagens): recategorize na revisão e a regra fica salva.
- Sem OCR: PDF que é só imagem é recusado com aviso.
- Não há tela de mapeamento de colunas para bancos novos (ainda).
- Outros bancos caem no modo genérico, com menos precisão (Nubank e Bradesco só foram vistos em PDFs sintéticos).
- Os compromissos futuros guardam até ~3,8 KB de lista por fatura (limite de 8 KB por item da sincronização cifrada); a lista é cortada se passar disso, os totais do banco não.

## Testes
`node tools/teste-fatura.mjs` (parser; `FATURA_REAL_PDF=… ` opcional), `node tools/teste-cartoes-calc.js` (cálculos/CSV), `python3 tools/teste-cartoes.py` (fluxo no navegador).
