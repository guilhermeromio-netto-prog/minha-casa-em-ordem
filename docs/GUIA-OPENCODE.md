# Guia para continuar (OpenCode, Cursor ou outro agente)

## 1. Rodar localmente
```bash
git clone https://github.com/guilhermeromio-netto-prog/minha-casa-em-ordem.git
cd minha-casa-em-ordem
python3 -m http.server 8000     # http://localhost:8000 (sem login; o login só existe na Cloudflare)
```
Sem build. Testes (precisam de `pip install playwright` e um Chrome): veja a seção *Desenvolvimento* do `README.md`.

## 2. Regras para o agente
Leia `AGENTS.md` antes de qualquer mudança. Resumo: app estático para celular (390 px), PT-BR, rodapé byGui, tokens em `css/tokens.css`, nada de segredos no repositório, **não tocar na plataforma IoT** (`chefe-geral*`), perguntar antes de framework ou servidor novo.
> Prompt inicial sugerido: *Leia AGENTS.md e docs/GUIA-OPENCODE.md. Implemente o item 1 do backlog sem quebrar nenhum teste.*

## 3. Backlog (por prioridade)
1. **Avisos confiáveis com o app fechado** (Web Push + Worker com cron): descrito em `docs/LEMBRETES.md`, **não construído**; precisa de OK (servidor novo, consome requests da conta compartilhada).
2. **Validar o leitor de fatura com faturas reais** e, se preciso, tela de mapeamento de colunas / novos bancos.
3. **Deploy automático do portal** a cada push (GitHub Action com token da Cloudflare). Hoje é manual por `tools/gerar-deploy-cloudflare.py`.
4. Pomodoro/foco, rotina guiada manhã/noite.
5. Google Agenda via servidor (hoje a agenda usa `.ics`).
6. Passeios/rádio/clima de fim de semana e etiqueta de dono por item (pedidos que ficaram de fora desta versão).

Para cada item: novo arquivo em `js/`, view em `PS.views` (depois de `telas.js`), entrada em `index.html` e em `ARQUIVOS` do `sw.js`, `tools/versionar.sh`, teste.

## 4. Checklist no celular
- [ ] Abre, pede login (Cloudflare), entra e vê "Atenção agora".
- [ ] `#/instalar`: instala (Android: menu ⋮ → Instalar; iPhone: Compartilhar → Tela de Início).
- [ ] Marcar conta como paga e desfazer; Histórico mostra os meses.
- [ ] `#/cartoes`: PDF → revisão → painel; PDF com senha pede a senha.
- [ ] Sem internet: o app abre (cache) e mostra aviso de clima offline.
- [ ] Sincronizar entre dois celulares (senha da família ≠ senha do login).

## 5. Publicar
- **GitHub Pages:** push em `main`; o workflow monta `dist/` (`tools/montar-dist.sh`) e publica. Rode antes `tools/versionar.sh`.
- **Cloudflare (com login):** `bash tools/montar-dist.sh && python3 tools/gerar-deploy-cloudflare.py ...` e execute o arquivo gerado (veja `docs/CLOUDFLARE.md`).

byGui
