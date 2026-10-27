const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { requireAuth, requireAdmin, requireRole } = require('./auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás do Caddy/Nginx

app.use(cookieParser());
// limite maior por causa das fotos em base64 (várias fotos por atendimento)
app.use(express.json({ limit: '40mb' }));

// cabeçalhos básicos de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', requireAuth, require('./routes/cadastros'));
app.use('/api/atendimentos', requireAuth, require('./routes/atendimentos'));
app.use('/api/users', requireAuth, requireAdmin, require('./routes/users'));
app.use('/api/backup', requireAuth, requireAdmin, require('./routes/backup'));
app.use('/api/motivos', requireAuth, require('./routes/motivos'));
app.use('/api/garantia', requireAuth, requireRole('admin', 'gestor'), require('./routes/garantia'));
app.use('/api/dashboard', requireAuth, requireRole('admin', 'gestor'), require('./routes/dashboard'));

app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// login.html é público; tudo o resto do front exige sessão válida (checada no próprio index.html via /api/auth/me)
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'rota não encontrada' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// tratamento de erro genérico (ex.: JSON malformado, payload grande demais)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'arquivo(s) grandes demais' });
  res.status(err.status || 500).json({ error: err.message || 'erro interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Heliar server rodando na porta ${PORT}`);
});
