# Hospedagem na Cloudflare e login

**URL:** https://minha-casa-em-ordem.guilhermeromionetto.workers.dev

## Arquitetura
Um único Worker, `minha-casa-em-ordem` (`portal-worker/worker.js`), fica **na frente** de tudo:
- sem sessão válida só servem `/login`, `/primeiro-acesso`, `/manifest.webmanifest`, ícones, logo e `/api/saude`; **qualquer outra rota** (`/`, `/js/*`, `/css/*`, `/sw.js`, `/dados.json`…) devolve **401** (navegação redireciona para `/login`). O código do app não é entregue a quem não entrou.
- com sessão, o Worker entrega os arquivos do app. Eles vão **embutidos no Worker** (gzip+base64, ~0,9 MB; limite do plano grátis: 3 MB). Motivo: o envio de *Workers Static Assets* exige um JWT próprio que a ferramenta de deploy não deixa passar; embutir é equivalente e cabe com folga. Se o app passar de ~2,5 MB gzip, migre para Static Assets com `wrangler deploy`.
- D1 `minha-casa-acesso`: `usuarios`, `sessoes`, `tentativas`. **Nada** de rotina, contas ou faturas passa por este Worker: isso fica no aparelho (e cifrado no Worker de sincronização).

Por isso **não há projeto Pages separado e público** na Cloudflare: o Pages não permite barrar a entrega dos arquivos sem um Worker na frente.

## Contas
Exatamente duas, ambas **admin** (mesmas permissões): Guilherme (`guilhermeromionetto@gmail.com`) e Esposa (`jorrico10@gmail.com`). Sem cadastro público (não existe rota para criar conta).
- **Primeiro acesso:** link de **uso único** (válido 14 dias na criação inicial; 24 h quando gerado de novo). O link é lido uma vez, guarda-se só o **hash**, e você escolhe a senha na hora (mín. 12 caracteres; recusa senha igual ao e-mail e as muito comuns). Os links iniciais ficam num arquivo **fora do repositório** (`/workspace/keys/links-primeiro-acesso.txt` na box de trabalho).
- **Conta** (`/conta`, também link no rodapé do app): lista os acessos, **gera novo link** para o outro admin (apaga a senha e **encerra as sessões** dele), troca a própria senha (encerra as outras sessões), sair deste aparelho.
- **Se os dois ficarem sem acesso** (link vencido, senha perdida pelos dois): é preciso gerar um novo link direto no banco (Cloudflare → D1 `minha-casa-acesso`: `UPDATE usuarios SET link_hash=<sha256 do token novo>, link_exp=<agora+24h>, senha=NULL WHERE email=...`).

## Segurança
- Senha: PBKDF2-SHA256 **100 000 iterações** (máximo que o Workers aceita) + HMAC com o segredo `PEPPER` (*secret_text*, nunca no repositório): ficou abaixo dos 210 mil+ recomendados hoje, e o `PEPPER` compensa parte disso (vazar só o banco não permite testar senhas). Use senha longa.
- Cookie `__Host-mco`: aleatório, **HttpOnly, Secure, SameSite=Strict**, sem Domain; só o hash fica no D1; 30 dias; logout apaga no servidor.
- CSRF: toda requisição que muda estado exige `Origin` igual ao do site e o cabeçalho `X-MCO`.
- Mesma mensagem para e-mail errado ou senha errada; mesmo custo de CPU nos dois casos.
- **Bloqueio:** 5 senhas erradas bloqueiam a conta por 15 min; limite por IP (20 tentativas/15 min). *Tradeoff:* quem souber o e-mail pode travar a conta por 15 min; o outro admin consegue gerar link novo.
- Cabeçalhos: CSP restritiva (só `self`, o Worker de sincronização e a Open-Meteo; `frame-ancestors 'none'`), HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy`.
- Sessão validada em cache de 60 s no isolate (poupa D1/requests); revogar vale em até 60 s em outras instâncias.
- **Sair** apaga o cache offline e o service worker, mas **não apaga os dados guardados no aparelho** (localStorage), que ficam disponíveis a quem usar o aparelho.
- **Chave de cifra da sincronização** continua vindo só da **senha da família**, nunca da senha do login.
- O GitHub Pages tem a mesma interface **sem login**: é código público, sem dados. Quem abrir lá vê o app vazio/exemplos.

## Plano gratuito
Workers: 100 mil requests/dia **para a conta toda** (compartilhado com outros Workers do dono); D1: 5 M leituras/100 mil escritas por dia. O portal conta 1 request por arquivo carregado, mas o service worker mantém o app em cache, então o uso normal é de dezenas por dia por pessoa.

## Separação da plataforma IoT
Recursos deste projeto: Worker `minha-casa-em-ordem`, D1 `minha-casa-acesso`, Worker `painel-sala-sync`, D1 `painel-sala`. **Não** foram tocados nem lidos: `chefe-geral-ponte`, D1 `chefe-geral`, `ntn-alarmes-cron`.

## Publicar / atualizar (manual)
```bash
bash tools/versionar.sh && bash tools/montar-dist.sh
python3 tools/gerar-deploy-cloudflare.py --d1 <uuid do D1 minha-casa-acesso> --pepper <arquivo com o PEPPER, FORA do repositório> --saida /caminho/fora/do/repo/deploy.js
# executar o conteúdo de deploy.js na ferramenta `execute` do conector Cloudflare (ou adaptar para fetch + token de API)
```
Sem `--pepper`, o segredo existente é mantido. Para trocar o `PEPPER` **todas as senhas deixam de valer** (gere novos links).
Deploy automático por GitHub Action exigiria um *API token* da Cloudflare com permissão **Workers Scripts: Edit** e **D1: Edit** (conta), guardado como secret do repositório; não foi configurado.

## Testes
Rodam **só no ambiente local** (`wrangler dev`, D1 local, contas de teste; recusam rodar em `workers.dev` porque travam contas):
`python3 tools/teste-portal.py --url http://127.0.0.1:8799` (63 verificações HTTP) e `python3 tools/teste-portal-browser.py --url ... --chrome ...` (login, app, PDF.js sob a CSP, instalabilidade, Sair).
