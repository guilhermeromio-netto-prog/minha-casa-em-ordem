# Guia para continuar com OpenCode (ou outro agente)

## 1. Rodar localmente
```bash
git clone https://github.com/guilhermeromio-netto-prog/painel-sala.git
cd painel-sala
python3 -m http.server 8000     # http://localhost:8000
```
Não há build. Edite e recarregue. Teste de fumaça (opcional, precisa de `pip install playwright` e um Chrome):
```bash
python3 tools/teste-smoke.py --chrome /usr/bin/google-chrome
```
Ele checa todas as rotas (sem erro de console, sem rolagem horizontal, rodapé byGui), setas movendo o foco, hábito persistindo após reload, exportar/importar JSON, link de configuração e importação de `.ics`, em 1920x1080, 1280x720 e 360px.

## 2. Regras para o agente
Leia `AGENTS.md` antes de qualquer mudança. Resumo: somente estático, UI de 3 metros (fonte ≥ 28px, foco magenta enorme), tudo pelo D-pad, PT-BR, rodapé byGui, tokens em `css/tokens.css`, perguntar antes de framework ou servidor. Sugestão de prompt inicial:
> Leia AGENTS.md e docs/GUIA-OPENCODE.md. Implemente o item 1 do backlog sem quebrar `python3 tools/teste-smoke.py`.

## 3. Backlog (por prioridade)
1. **Widget de finanças**: resumo do mês (contas pagas, a pagar, total) na tela Hoje/Família, a partir de `contas`. Sem integrações bancárias.
2. **Pomodoro / timer de foco**: tela `#/foco` com timer grande (25/5), alarme sonoro (WebAudio), ligado ao "foco do dia".
3. **Rotina guiada manhã/noite**: checklist passo a passo em tela cheia com cronômetro por etapa e OK para avançar.
4. **Modo quiosque**: esconder navegação, rotacionar telas automaticamente a cada N segundos, tela de descanso.
5. **Google Agenda via servidor** (depois): um pequeno backend/Worker faz o OAuth e entrega JSON; o painel só lê. Hoje a agenda usa `.ics` importado.
6. **Sincronizar por código**: também depende de servidor (ainda não existe, não foi construído).

Para cada item: novo arquivo em `js/`, view registrada em `PS.views`, entrada no `index.html`, `tools/versionar.sh`, teste de fumaça atualizado.

## 4. Checklist de teste na TV
- [ ] Abre em tela cheia, sem barras do navegador (APK) e sem cortar nas bordas (overscan; ajuste em Gerenciar → Ajustes).
- [ ] Setas movem o foco em todas as telas; o anel magenta é visível do sofá.
- [ ] OK marca hábito/tarefa; Voltar volta ao Hoje; Voltar duas vezes no Hoje sai (APK).
- [ ] `#/teclas`: aperte cada botão do controle e anote os códigos que não funcionam.
- [ ] Relógio e clima corretos (fuso de São Paulo); clima mostra a cidade configurada.
- [ ] `#/relaxar` abre YouTube TV e o botão Voltar retorna ao painel.
- [ ] Hábito marcado continua marcado após fechar e abrir o app (localStorage persiste).
- [ ] Texto legível a 3 metros; modo alto contraste funciona.
- [ ] Sem internet: o painel abre (cache) e mostra aviso de clima offline.

## 5. Publicar
Push em `main` → workflow `.github/workflows/pages.yml` publica no GitHub Pages. Rode antes `tools/versionar.sh` (carimba `?v=<hash>` e a versão do service worker; sem isso a TV pode ficar com arquivos antigos em cache).

## 6. Recompilar o APK
Código em `android/` (Java + `aapt2`/`javac`/`d8`/`apksigner`, sem Gradle). Passo a passo completo em `android/README.md`. Resumo:
```bash
# precisa de JDK 17+ e Android SDK build-tools + platform android-34 (ANDROID_HOME)
export PS_KEYSTORE=$HOME/chaves/painel-release.jks   # FORA do repositório
export PS_KEYPASS='...'                              # senha da chave
bash android/build.sh                                # gera painel.apk na raiz
apksigner verify --verbose painel.apk
```
A mesma chave tem de ser usada em todas as versões, senão o Android recusa a atualização por cima. Nunca commite o `.jks`. Depois: `git add painel.apk && git commit`, e crie a release (`gh release create v2 painel.apk`).
O wrapper carrega a URL do site, então só precisa recompilar se mudar o código nativo (ícone, permissões, domínios permitidos).

byGui
