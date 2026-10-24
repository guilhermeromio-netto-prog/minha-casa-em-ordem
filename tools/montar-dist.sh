#!/usr/bin/env bash
# Monta dist/ só com os arquivos que o navegador precisa (sem testes, docs, Workers de servidor, PDFs de teste).
# Usado pelo GitHub Pages (workflow) e pela hospedagem na Cloudflare.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp -r index.html sw.js manifest.webmanifest dados.json css js assets icons dist/
find dist -name '*.md' -delete
echo "dist/ pronto: $(find dist -type f | wc -l) arquivos, $(du -sh dist | cut -f1)"
