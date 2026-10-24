#!/usr/bin/env bash
# Carimba ?v=<hash do conteudo> no index.html e atualiza a VERSAO do service worker.
# Rode antes de cada commit/publicacao: ./tools/versionar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(cat css/*.css js/*.js dados.json | sha1sum | cut -c1-7)
sed -i -E "s#(\.(css|js))\?v=[A-Za-z0-9]+#\1?v=$V#g" index.html
sed -i -E "s#^var VERSAO = .*#var VERSAO = 'painel-sala-$V';#" sw.js
echo "versao $V"
