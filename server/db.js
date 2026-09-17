const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'heliar.sqlite3');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS unidades (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tecnicos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT,
  unidade_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS atendimentos (
  id TEXT PRIMARY KEY,
  laudo_numero TEXT,
  unidade_id TEXT,
  status TEXT DEFAULT 'em_teste',
  data_atendimento TEXT,
  cliente_nome TEXT,
  veiculo_placa TEXT,
  numero_serie TEXT,
  foto_count INTEGER DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_atendimentos_unidade ON atendimentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_serie ON atendimentos(numero_serie);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tecnico',
  unidade_id TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  senha_trocada_em TEXT
);
`);

// Simple in-place migration helper: add a column if it's missing.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('atendimentos', 'created_by', 'TEXT');
ensureColumn('atendimentos', 'updated_by', 'TEXT');

// Seed inicial (só roda se as tabelas estiverem vazias) — mesma ideia que o app tinha
// no navegador: garante que sempre exista ao menos a unidade e a marca "Heliar".
const crypto = require('crypto');
function uid() { return crypto.randomBytes(9).toString('base64url'); }
const unidadeCount = db.prepare('SELECT COUNT(*) AS n FROM unidades').get().n;
if (unidadeCount === 0) {
  db.prepare('INSERT INTO unidades (id, nome, cnpj, endereco) VALUES (?,?,?,?)').run(uid(), 'Heliar', '', '');
}
const marcaCount = db.prepare('SELECT COUNT(*) AS n FROM marcas').get().n;
if (marcaCount === 0) {
  db.prepare('INSERT INTO marcas (id, nome) VALUES (?,?)').run(uid(), 'Heliar');
}

module.exports = { db, DATA_DIR, UPLOADS_DIR };
