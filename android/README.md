# Wrapper Android TV — Painel da Sala

App mínimo em Java puro: um `WebView` em tela cheia que abre `https://guilhermeromio-netto-prog.github.io/painel-sala/`. Sem Gradle, sem bibliotecas, sem AndroidX. APK de ~37 KB.

## O que o app faz
- Aparece no menu inicial da Android TV (`LEANBACK_LAUNCHER`, banner 320x180 com o logo) e em celulares (`LAUNCHER`). `leanback` e `touchscreen` não são obrigatórios.
- JavaScript e DOM storage ligados: o `localStorage` (hábitos, tarefas...) persiste entre aberturas.
- User-agent recebe o sufixo `PainelSalaApp/1.0` (o painel detecta isso na tela Instalar).
- Tela cheia imersiva, tela sempre ligada, aceleração por hardware, vídeo em tela cheia (YouTube).
- Setas/OK chegam à página normalmente. **Voltar** chama `PS.voltarNativo()`: fecha janela/volta ao Hoje; duas vezes no Hoje fecha o app. Em outro site (YouTube) Voltar usa o histórico e, sem histórico, volta ao painel. **Voltar longo** leva ao painel de qualquer lugar.
- Navegação do topo só aceita `https` (atalhos editáveis abrem na mesma aba); `http` é promovido a `https`; outros esquemas (`intent:`, `market:`...) são bloqueados.
- Sem rede: mostra `assets/offline.html` e tenta de novo a cada 8 s. Com o painel já visitado, o service worker serve do cache.
- Seletor de arquivos (importar JSON/.ics) funciona se a TV tiver um gerenciador de arquivos; baixar arquivos (exportar JSON) **não** é suportado dentro do app: use o navegador do celular.

## Compilar
Requisitos: JDK 17+, Android SDK com `build-tools;34.0.0` e `platforms;android-34`.
```bash
export ANDROID_HOME=$HOME/android-sdk
export PS_KEYSTORE=$HOME/chaves/painel-release.jks    # FORA do repositório
export PS_KEYPASS='uma-senha-forte'
bash android/build.sh        # gera painel.apk na raiz do repo, assinado (v1+v2+v3)
```
Na primeira vez o `.jks` é criado. **Guarde-o com backup e nunca o commite** (`.gitignore` já bloqueia `*.jks`); sem a mesma chave o Android recusa instalar uma atualização por cima do app existente.

Instalar por cabo/rede: `adb install -r painel.apk`. Conferir: `apksigner verify --verbose painel.apk` e `aapt2 dump badging painel.apk | grep -E "launchable|leanback"`.

## Publicar
```bash
git add painel.apk && git commit -m "APK vX" && git push
gh release create vX painel.apk --title "Painel da Sala vX" --notes "..."
```
O APK na raiz do repositório é servido pelo Pages em `/painel.apk` (link curto para o Downloader).

## Mudar domínio ou versão
`HOME`/`HOST_HOME` em `src/br/gui/painelsala/MainActivity.java`; `versionCode`/`versionName` em `AndroidManifest.xml` e no `build.sh` (`--version-code`, `--version-name`).

byGui
