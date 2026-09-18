const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();
function uid() { return crypto.randomBytes(9).toString('base64url'); }

// Leitura (GET) fica liberada pra qualquer usuário logado — técnico também precisa
// ver a lista de unidades/técnicos/marcas pra preencher o atendimento. Só criar,
// editar e excluir cadastros fica restrito a admin/gestor (a aba "Cadastros" já
// nem aparece pra técnico no front, isso aqui é o reforço do lado do servidor).
const soAdminOuGestor = requireRole('admin', 'gestor');

/* ---------------- UNIDADES ---------------- */
router.get('/unidades', (req, res) => {
  res.json(db.prepare('SELECT * FROM unidades ORDER BY nome').all());
});
router.post('/unidades', soAdminOuGestor, (req, res) => {
  const { nome, cnpj, endereco } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
  const id = uid();
  db.prepare('INSERT INTO unidades (id, nome, cnpj, endereco) VALUES (?,?,?,?)').run(id, nome, cnpj || '', endereco || '');
  res.status(201).json(db.prepare('SELECT * FROM unidades WHERE id = ?').get(id));
});
router.put('/unidades/:id', soAdminOuGestor, (req, res) => {
  const { nome, cnpj, endereco } = req.body || {};
  const existing = db.prepare('SELECT * FROM unidades WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'unidade não encontrada' });
  db.prepare('UPDATE unidades SET nome=?, cnpj=?, endereco=? WHERE id=?')
    .run(nome ?? existing.nome, cnpj ?? existing.cnpj, endereco ?? existing.endereco, req.params.id);
  res.json(db.prepare('SELECT * FROM unidades WHERE id = ?').get(req.params.id));
});
router.delete('/unidades/:id', soAdminOuGestor, (req, res) => {
  db.prepare('DELETE FROM unidades WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- TECNICOS ---------------- */
router.get('/tecnicos', (req, res) => {
  res.json(db.prepare('SELECT * FROM tecnicos ORDER BY nome').all());
});
router.post('/tecnicos', soAdminOuGestor, (req, res) => {
  const { nome, cpf, unidade_id } = req.body || {};
  if (!nome || !unidade_id) return res.status(400).json({ error: 'nome e unidade são obrigatórios' });
  const id = uid();
  db.prepare('INSERT INTO tecnicos (id, nome, cpf, unidade_id) VALUES (?,?,?,?)').run(id, nome, cpf || '', unidade_id);
  res.status(201).json(db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(id));
});
router.put('/tecnicos/:id', soAdminOuGestor, (req, res) => {
  const { nome, cpf, unidade_id } = req.body || {};
  const existing = db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'técnico não encontrado' });
  db.prepare('UPDATE tecnicos SET nome=?, cpf=?, unidade_id=? WHERE id=?')
    .run(nome ?? existing.nome, cpf ?? existing.cpf, unidade_id ?? existing.unidade_id, req.params.id);
  res.json(db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(req.params.id));
});
router.delete('/tecnicos/:id', soAdminOuGestor, (req, res) => {
  db.prepare('DELETE FROM tecnicos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- MARCAS ---------------- */
router.get('/marcas', (req, res) => {
  res.json(db.prepare('SELECT * FROM marcas ORDER BY nome').all());
});
router.post('/marcas', soAdminOuGestor, (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
  const id = uid();
  db.prepare('INSERT INTO marcas (id, nome) VALUES (?,?)').run(id, nome);
  res.status(201).json(db.prepare('SELECT * FROM marcas WHERE id = ?').get(id));
});
router.delete('/marcas/:id', soAdminOuGestor, (req, res) => {
  db.prepare('DELETE FROM marcas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
