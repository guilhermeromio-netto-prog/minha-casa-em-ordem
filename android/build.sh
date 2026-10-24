#!/usr/bin/env bash
# Compila e assina o APK do Painel da Sala sem Gradle (aapt2 + javac + d8 + zipalign + apksigner).
# Requisitos: JDK 17+, Android SDK (build-tools 34 + platforms;android-34).
# Variáveis:
#   ANDROID_HOME   pasta do SDK (padrão: /workspace/android-sdk)
#   PS_KEYSTORE    caminho do .jks de release (FORA do repositório!). Se não existir, é gerado (guarde o backup!)
#   PS_KEYPASS     senha do keystore/chave (obrigatória)
#   PS_SAIDA       arquivo de saída (padrão: <raiz do repo>/painel.apk)
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-/workspace/android-sdk}"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
JAR="$SDK/platforms/android-34/android.jar"
SAIDA="${PS_SAIDA:-$(cd .. && pwd)/painel.apk}"
: "${PS_KEYSTORE:?defina PS_KEYSTORE (caminho do .jks fora do repositório)}"
: "${PS_KEYPASS:?defina PS_KEYPASS}"
case "$(cd "$(dirname "$PS_KEYSTORE")" && pwd)/" in "$(cd .. && pwd)/"*) echo "ERRO: o keystore não pode ficar dentro do repositório" >&2; exit 1;; esac
if [ ! -f "$PS_KEYSTORE" ]; then
  mkdir -p "$(dirname "$PS_KEYSTORE")"
  keytool -genkeypair -keystore "$PS_KEYSTORE" -alias painel -keyalg RSA -keysize 2048 -validity 36500 \
    -storepass "$PS_KEYPASS" -keypass "$PS_KEYPASS" -dname "CN=Painel da Sala, O=byGui, C=BR"
fi
B=build; rm -rf $B; mkdir -p $B/res $B/classes $B/dex
"$BT/aapt2" compile --dir res -o $B/res.zip
"$BT/aapt2" link -o $B/base.apk -I "$JAR" --manifest AndroidManifest.xml -R $B/res.zip -A assets \
  --min-sdk-version 21 --target-sdk-version 34 --version-code 1 --version-name 1.0 --auto-add-overlay
javac -nowarn -source 8 -target 8 -classpath "$JAR" -d $B/classes $(find src -name '*.java') 2>&1 | grep -v "^warning\|^Note\|^[0-9] warning" || true
"$BT/d8" --min-api 21 --lib "$JAR" --output $B/dex $(find $B/classes -name '*.class')
python3 - <<'PY'
import zipfile, shutil
src = zipfile.ZipFile('build/base.apk')
with zipfile.ZipFile('build/unsigned.apk', 'w') as out:
    for i in src.infolist():
        out.writestr(i, src.read(i.filename), compress_type=i.compress_type)
    out.write('build/dex/classes.dex', 'classes.dex', compress_type=zipfile.ZIP_DEFLATED)
PY
"$BT/zipalign" -f -p 4 $B/unsigned.apk $B/aligned.apk
"$BT/apksigner" sign --ks "$PS_KEYSTORE" --ks-key-alias painel --ks-pass env:PS_KEYPASS --key-pass env:PS_KEYPASS \
  --out "$SAIDA" $B/aligned.apk
"$BT/apksigner" verify --verbose "$SAIDA" | head -6
ls -l "$SAIDA"; sha256sum "$SAIDA"
