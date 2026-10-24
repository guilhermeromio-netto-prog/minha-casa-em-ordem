-- Esquema do D1 "painel-sala" (idempotente). Só texto cifrado + metadados; nenhum conteúdo legível.
CREATE TABLE IF NOT EXISTS familias (id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL, pin_salt TEXT NOT NULL, iter INTEGER NOT NULL, salt TEXT NOT NULL, env_senha TEXT NOT NULL, env_rec TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0, criada_em INTEGER NOT NULL, atualizada_em INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessoes (token_hash TEXT PRIMARY KEY, familia_id TEXT NOT NULL, rotulo TEXT, criada_em INTEGER NOT NULL, ultimo_uso INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sess_fam ON sessoes(familia_id);
CREATE TABLE IF NOT EXISTS itens (familia_id TEXT NOT NULL, colecao TEXT NOT NULL, id TEXT NOT NULL, dados TEXT, t INTEGER NOT NULL, apagado INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL, PRIMARY KEY (familia_id, colecao, id)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS itens_seq ON itens(familia_id, seq);
CREATE TABLE IF NOT EXISTS tentativas (chave TEXT PRIMARY KEY, falhas INTEGER NOT NULL, janela_ini INTEGER NOT NULL, bloqueado_ate INTEGER NOT NULL DEFAULT 0);
