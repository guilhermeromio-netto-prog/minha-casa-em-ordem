# Painel da Sala

Painel de rotina para a TV da sala: relógio, clima, próximos compromissos, tarefas do dia, hábitos, contas a vencer, foco do dia e atalhos de lazer (YouTube TV e outros). Tudo em **HTML + CSS + JS puro** (sem npm, sem build, sem servidor), pensado para o navegador de uma **TV Box Android TV** (ex.: Mibo X) e controlado só pelo **controle remoto**.

- Site: https://guilhermeromio-netto-prog.github.io/painel-sala/
- APK Android TV (sideload): https://guilhermeromio-netto-prog.github.io/painel-sala/painel.apk
- Interface em português do Brasil. Rodapé **byGui** em todas as telas.

> Os dados que vêm preenchidos (hábitos, tarefas, contas, links) são **exemplos editáveis**, sempre marcados como "exemplo". Apague ou edite em **Gerenciar**.

## Telas

| Rota | O que mostra |
|---|---|
| `#/` Hoje | Hora e data (America/Sao_Paulo), clima (Open-Meteo), próximos compromissos, tarefas, hábitos, contas a vencer em 7 dias, foco do dia |
| `#/rotina` | Hábitos do dia com sequência e semana |
| `#/tarefas` | Tarefas por lista, prioridade e prazo |
| `#/agenda` | Compromissos (manuais ou importados de arquivo `.ics`) |
| `#/familia` | Contas e lembretes da família |
| `#/relaxar` | Atalhos: YouTube TV (`https://www.youtube.com/tv`), YouTube e links editáveis (abrem na mesma aba) |
| `#/gerenciar` | Editar tudo, configurações, backup JSON, link de configuração (ótimo para abrir no celular) |
| `#/teclas` | Depurador: mostra o código de cada tecla do controle remoto |
| `#/instalar` | Como instalar o APK / fixar o painel na TV |
| `#/importar/<código>` | Importa uma configuração enviada por link |

## Abrir na TV

**Opção A, APK (recomendado):** instale com o app *Downloader* (AFTVnews) usando o código/URL `https://guilhermeromio-netto-prog.github.io/painel-sala/painel.apk`. Abre em tela cheia, no menu inicial da Android TV. Veja `#/instalar`.

**Opção B, navegador:** abra `https://guilhermeromio-netto-prog.github.io/painel-sala/` no navegador da box (Puffin TV, Chrome, TV Bro etc.) e salve nos favoritos / página inicial. Se o navegador permitir "Adicionar à tela inicial", o painel roda como app (PWA, tela cheia).

## Configurar pelo celular

Em **Gerenciar → Backup e link** use **Gerar link agora**: o painel cria um link que carrega a configuração inteira (hábitos, tarefas, contas, links, ajustes) no próprio endereço. Envie o link por Telegram/WhatsApp/e-mail e abra na box. Limites: acima de ~2000 caracteres alguns apps quebram o link; acima de 8000 o painel recusa e sugere **exportar o arquivo JSON** e importar pelo seletor de arquivos. O link só carrega dados, nunca scripts, e pede confirmação antes de substituir.

## Controle remoto e teclado

| Ação | Teclas |
|---|---|
| Mover o foco | Setas do controle (D-pad) / setas do teclado |
| Ativar (OK) | Enter, OK/Select (códigos 13, 23, 66) |
| Voltar | Esc, Backspace, Voltar do controle (4, 27, 8, 461, 10009). Na tela Hoje, duas vezes seguidas sai do app (no APK) |
| Abas | Foco na barra superior + esquerda/direita |

O foco é um **anel magenta** com brilho. A navegação espacial é própria (`js/nav.js`): escolhe o vizinho mais próximo na direção apertada. Se alguma tecla do seu controle não funcionar, abra `#/teclas` e anote o código que aparece.

## Dados e backup

Tudo fica no `localStorage` do navegador (chave `painelsala.dados`, esquema versionado). **Gerenciar → Backup** exporta/importa JSON. "Sincronizar por código" **não existe ainda** (ideia futura, depende de servidor). A agenda aceita arquivos `.ics`, sem login Google.

## Identidade visual

Inspirada em um visual corporativo de telecom (preto + magenta), **sem usar logotipo, marca ou "T" de nenhuma empresa**, e sem se passar por ela. Resumo (detalhes em `AGENTS.md`):

- Acento único: magenta `#E20074` (anel de foco, estados ativos, números-chave, filetes). Texto pequeno em magenta usa `#FF4FA3` (contraste AA).
- Bases: `#000`, `#0A0A0A`, `#1A1A1A`, `#262626`, `#3A3A3A`. Texto branco, secundário cinza claro.
- Fonte de sistema neo-grotesca (Inter, Helvetica Neue, Arial, system-ui), títulos pesados. Sem fontes embutidas, sem CDN.
- Semânticas ok/âmbar/vermelho sempre com ícone e rótulo.
- Margens de overscan e modo alto contraste.
- Logo original (`assets/logo.svg`, `assets/mark.svg`): moldura de TV com anel magenta e check.
- Prints em `docs/prints/`.

## Estrutura

```
index.html  manifest.webmanifest  sw.js  dados.json
css/ (tokens, base, app)   js/ (util, icons, store, dominio, clima, ics, nav, energia, telas, gerenciar, app)
assets/ (logo, mark, favicon)   icons/ (PWA)   docs/   tools/   android/
.github/workflows/pages.yml   painel.apk
```

## Desenvolvimento

```bash
python3 -m http.server 8000      # abra http://localhost:8000
python3 tools/teste-smoke.py     # opcional: Playwright + Chrome (rotas, D-pad, hábito, export/import, link)
tools/versionar.sh               # antes de publicar: carimba ?v=<hash> nos assets e versão do service worker
```

Publicação: push em `main` dispara o GitHub Pages (workflow `Deploy Pages`). Veja `docs/GUIA-OPENCODE.md`.

## APK (wrapper Android TV)

Código em `android/` (Java puro, sem Gradle nem frameworks). Um WebView em tela cheia carrega o site publicado, então **atualizar o site atualiza o app**, sem reinstalar. Para recompilar: veja `android/README.md` e `docs/GUIA-OPENCODE.md`. A chave de assinatura (`painel-release.jks`) **nunca** vai para o git; guarde-a fora do repositório, ou o app instalado não aceitará atualizações do APK.

## Limitações conhecidas

- Não foi testado em um Mibo X real por quem construiu; códigos de tecla do controle podem variar (use `#/teclas`).
- Clima precisa de internet (Open-Meteo); offline mostra o último valor em cache.
- Sem sincronização entre dispositivos além de link/JSON.

byGui
