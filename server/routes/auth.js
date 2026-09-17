const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { signToken, setAuthCookie, clearAuthCookie, requireAuth, checkPassword, hashPassword } = require('../auth');

const router = express.Router();

// login: tentativas limitadas por IP+login para dificultar força bruta
const attempts = new Map(); // key -> {count, first}
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
function tooManyAttempts(key) {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) { attempts.delete(key); return false; }
  return a.count >= MAX_ATTEMPTS;
}
function registerFailure(key) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) { attempts.set(key, { count: 1, first: Date.now() }); return; }
  a.count += 1;
}
function clearFailures(key) { attempts.delete(key); }

router.post('/login', async (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha) return res.status(400).json({ error: 'informe login e senha' });
  const key = req.ip + ':' + String(login).toLowerCase();
  if (tooManyAttempts(key)) {
    return res.status(429).json({ error: 'muitas tentativas — aguarde alguns minutos e tente novamente' });
  }
  const user = db.prepare('SELECT * FROM users WHERE lower(login) = lower(?) AND ativo = 1').get(login);
  if (!user) { registerFailure(key); return res.status(401).json({ error: 'login ou senha inválidos' }); }
  const ok = await checkPassword(senha, user.senha_hash);
  if (!ok) { registerFailure(key); return res.status(401).json({ error: 'login ou senha inválidos' }); }
  clearFailures(key);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ id: user.id, nome: user.nome, login: user.login, role: user.role, unidade_id: user.unidade_id });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, nome, login, role, unidade_id, ativo FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.ativo) return res.status(401).json({ error: 'não autenticado' });
  res.json(user);
});

router.put('/senha', requireAuth, async (req, res) => {
  const { senha_atual, senha_nova } = req.body || {};
  if (!senha_atual || !senha_nova) return res.status(400).json({ error: 'informe a senha atual e a nova senha' });
  if (String(senha_nova).length < 6) return res.status(400).json({ error: 'a nova senha precisa ter pelo menos 6 caracteres' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'usuário não encontrado' });
  const ok = await checkPassword(senha_atual, user.senha_hash);
  if (!ok) return res.status(401).json({ error: 'senha atual incorreta' });
  const hash = await hashPassword(senha_nova);
  db.prepare('UPDATE users SET senha_hash = ?, senha_trocada_em = datetime(\'now\') WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

module.exports = router;
