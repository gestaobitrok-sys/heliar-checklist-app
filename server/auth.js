const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERRO FATAL: variável de ambiente JWT_SECRET não definida. Configure-a antes de iniciar o servidor.');
  process.exit(1);
}
const COOKIE_NAME = 'heliar_token';
const TOKEN_TTL = '12h';

function signToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, login: user.login, role: user.role, unidade_id: user.unidade_id },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false', // true por padrão (exige HTTPS); só desliga em dev local
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'não autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'sessão inválida ou expirada' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'apenas administradores podem fazer isso' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'você não tem permissão para fazer isso' });
    }
    next();
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
  requireRole,
  hashPassword,
  checkPassword
};
