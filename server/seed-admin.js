/* Cria (ou reseta a senha d[o] primeiro usuário administrador.
 * Uso:
 *   ADMIN_NOME="Nome" ADMIN_LOGIN="admin" ADMIN_SENHA="senha-forte" node seed-admin.js
 * Se ADMIN_SENHA não for informado, uma senha aleatória é gerada e impressa no terminal. */
const crypto = require('crypto');
const { db } = require('./db');
const { hashPassword } = require('./auth');

function uid() { return crypto.randomBytes(9).toString('base64url'); }

(async () => {
  const nome = process.env.ADMIN_NOME || 'Administrador';
  const login = process.env.ADMIN_LOGIN || 'admin';
  const senha = process.env.ADMIN_SENHA || crypto.randomBytes(9).toString('base64url');

  const senha_hash = await hashPassword(senha);
  const existing = db.prepare('SELECT * FROM users WHERE lower(login) = lower(?)').get(login);

  if (existing) {
    db.prepare('UPDATE users SET senha_hash = ?, role = ?, ativo = 1, senha_trocada_em = datetime(\'now\') WHERE id = ?')
      .run(senha_hash, 'admin', existing.id);
    console.log(`Usuário admin "${login}" já existia — senha atualizada.`);
  } else {
    const id = uid();
    db.prepare('INSERT INTO users (id, nome, login, senha_hash, role, ativo) VALUES (?,?,?,?,?,1)')
      .run(id, nome, login, senha_hash, 'admin');
    console.log(`Usuário admin "${login}" criado.`);
  }
  if (!process.env.ADMIN_SENHA) {
    console.log(`Senha gerada automaticamente: ${senha}`);
    console.log('Guarde essa senha agora — troque-a assim que fizer login (aba Usuários).');
  }
  process.exit(0);
})();
