const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { hashPassword } = require('../auth');

const router = express.Router();
function uid() { return crypto.randomBytes(9).toString('base64url'); }
const ROLES = ['admin', 'gestor', 'tecnico'];

function publicUser(u) {
  return { id: u.id, nome: u.nome, login: u.login, role: u.role, unidade_id: u.unidade_id, ativo: !!u.ativo, created_at: u.created_at };
}

// todas as rotas aqui já passam por requireAuth + requireAdmin (aplicado no server.js)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY nome').all();
  res.json(rows.map(publicUser));
});

router.post('/', async (req, res) => {
  const { nome, login, senha, role, unidade_id } = req.body || {};
  if (!nome || !login || !senha) return res.status(400).json({ error: 'nome, login e senha são obrigatórios' });
  if (String(senha).length < 6) return res.status(400).json({ error: 'a senha precisa ter pelo menos 6 caracteres' });
  const r = ROLES.includes(role) ? role : 'tecnico';
  const existing = db.prepare('SELECT id FROM users WHERE lower(login) = lower(?)').get(login);
  if (existing) return res.status(409).json({ error: 'já existe um usuário com esse login' });
  const id = uid();
  const senha_hash = await hashPassword(senha);
  db.prepare('INSERT INTO users (id, nome, login, senha_hash, role, unidade_id, ativo) VALUES (?,?,?,?,?,?,1)')
    .run(id, nome, login, senha_hash, r, unidade_id || null);
  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'usuário não encontrado' });
  const { nome, role, unidade_id, ativo } = req.body || {};
  const r = role && ROLES.includes(role) ? role : existing.role;
  db.prepare('UPDATE users SET nome=?, role=?, unidade_id=?, ativo=? WHERE id=?')
    .run(nome ?? existing.nome, r, unidade_id ?? existing.unidade_id, ativo === undefined ? existing.ativo : (ativo ? 1 : 0), req.params.id);
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

router.post('/:id/senha', async (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'usuário não encontrado' });
  const { senha_nova } = req.body || {};
  if (!senha_nova || String(senha_nova).length < 6) return res.status(400).json({ error: 'a nova senha precisa ter pelo menos 6 caracteres' });
  const senha_hash = await hashPassword(senha_nova);
  db.prepare('UPDATE users SET senha_hash = ?, senha_trocada_em = datetime(\'now\') WHERE id = ?').run(senha_hash, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  // nunca apagar de fato — só desativa, pra não perder o rastro de quem criou/editou atendimentos
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'usuário não encontrado' });
  db.prepare('UPDATE users SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
