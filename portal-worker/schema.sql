-- D1 "minha-casa-acesso" (idempotente). Só contas de acesso e sessões: nenhum dado da família (rotina, contas, faturas).
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'admin',
  senha TEXT,                       -- v1$iter$salt$hmac(pepper, pbkdf2)  (NULL = ainda sem senha)
  criado_em INTEGER NOT NULL,
  senha_em INTEGER,
  link_hash TEXT,                   -- sha256 do link de primeiro acesso (uso único)
  link_exp INTEGER,
  falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessoes (
  id_hash TEXT PRIMARY KEY,         -- sha256 do cookie (o cookie em si nunca é guardado)
  usuario_id INTEGER NOT NULL,
  criada_em INTEGER NOT NULL,
  expira_em INTEGER NOT NULL,
  visto_em INTEGER NOT NULL,
  agente TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX IF NOT EXISTS ix_sessoes_exp ON sessoes(expira_em);
CREATE TABLE IF NOT EXISTS tentativas (
  chave TEXT PRIMARY KEY,           -- hash do IP + rota
  n INTEGER NOT NULL,
  ini INTEGER NOT NULL
);
