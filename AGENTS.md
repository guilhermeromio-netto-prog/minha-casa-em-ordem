# AGENTS.md — Painel da Sala

Regras para qualquer agente (OpenCode, Cursor, Claude, humano) que mexer neste repositório.

## Regras duras
1. **Somente estático**: HTML, CSS e JS puro. Sem npm, bundler, framework, TypeScript ou backend. **Pergunte antes** de propor framework ou servidor.
2. **Interface para TV (10-foot UI)**: fonte base ≥ 28px em 1280x720 (`html{font-size:calc(2.2vw*var(--escala))}`), alvos de toque/foco grandes, anel de foco magenta bem visível (`:focus`, não `:focus-visible`), nada depende de hover, sem rolagem horizontal em 1280x720 e 1920x1080. A tela Gerenciar é responsiva até 360px.
3. **Controle remoto**: tudo alcançável pelo D-pad. OK = Enter (13/23/66). Voltar = Esc/Backspace/4/461/10009. Use `js/nav.js` (navegação espacial própria); novos elementos focáveis precisam de `tabindex`/`data-f` e `data-fid` estável para manter o foco ao redesenhar.
4. **PT-BR** em todo texto visível. Sem lorem ipsum, sem dados pessoais falsos: exemplos devem aparecer rotulados "exemplo" e ser editáveis.
5. **Rodapé "byGui"** em todas as páginas.
6. **Tokens** de design só em `css/tokens.css` (`:root`). Não espalhe cores soltas.
7. **JS compatível com navegadores antigos de TV** (ES5/ES6 básico; sem `?.` e `??`). Namespace global `PS`.
8. Persistência: `localStorage` (`painelsala.dados`, `versao` no esquema). Toda importação passa por `sanear()`. Mudou o esquema? Suba a versão e escreva a migração em `js/store.js`.
9. Antes de publicar rode `tools/versionar.sh` (carimba `?v=hash` e a versão do service worker) e `python3 tools/teste-smoke.py`.
10. Nunca versionar chaves (`*.jks`, `*.keystore`), tokens ou `local.properties`.

## Identidade visual
- **Inspiração**: visual corporativo de telecom, preto e magenta. **Proibido** usar logotipo, marca, "T" ou texto de qualquer empresa real, ou afirmar ser dela.
- **Acento único**: magenta `#E20074` — anel de foco (+brilho), estado ativo, números-chave, filetes finos. Texto pequeno em magenta: `#FF4FA3`. Texto sobre magenta: branco.
- **Contraste**: magenta sobre preto = 4,49:1 (só texto grande/UI). Branco sobre magenta = 4,68:1.
- **Bases**: `#000000`, `#0A0A0A`, `#1A1A1A`, `#262626`, `#3A3A3A`. Texto principal `#FFF`, secundário `#B8B8B8`.
- **Semânticas** (distintas do magenta, sempre com ícone + rótulo): ok `#2EBB64`, aviso `#FFB020`, perigo `#FF6B5E`.
- **Tipografia**: `Inter, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`; títulos peso 800; sem fontes embutidas, sem CDN.
- **Logo**: `assets/logo.svg` (com nome), `assets/mark.svg` (só símbolo: moldura de TV, anel magenta, check). Use o símbolo em tamanhos pequenos, o logo completo em cabeçalho/splash. Não distorcer, não recolorir, manter área livre ≥ 1/4 da altura.
- **Anti burn-in**: deriva sutil do conteúdo a cada 3 min, escurecimento por inatividade e modo noite automático (`js/energia.js`); não fixe elementos brilhantes imóveis.
- **Overscan**: margens `--margem-x/y`; alto contraste em Gerenciar → Ajustes.

## Mapa de arquivos
- `js/store.js` dados + esquema; `js/dominio.js` regras (recorrência, sequência, vencimentos); `js/telas.js` telas de exibição; `js/gerenciar.js` edição; `js/nav.js` D-pad e Voltar; `js/clima.js` Open-Meteo; `js/ics.js` importador; `js/energia.js` anti burn-in/modo noite; `js/app.js` rotas e boot.
- `android/` wrapper APK. `docs/GUIA-OPENCODE.md` roteiro de continuidade.

byGui
