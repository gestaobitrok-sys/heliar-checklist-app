const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, UPLOADS_DIR } = require('../db');

const router = express.Router();

function readFotos(atendimentoId, count) {
  const dir = path.join(UPLOADS_DIR, atendimentoId);
  const fotos = [];
  for (let i = 0; i < (count || 0); i++) {
    try { fotos.push(fs.readFileSync(path.join(dir, i + '.jpg')).toString('base64')); }
    catch (e) { fotos.push(null); }
  }
  return fotos;
}

// backup completo (sem senhas de usuários) — inclui fotos em base64, pensado para restaurar
// cadastros/atendimentos/fotos em outra instância ou como cópia de segurança
router.get('/export', (req, res) => {
  const atendimentos = db.prepare('SELECT * FROM atendimentos').all().map(a => Object.assign({}, a, {
    fotos: readFotos(a.id, a.foto_count)
  }));
  const backup = {
    versao: 1,
    exportado_em: new Date().toISOString(),
    unidades: db.prepare('SELECT * FROM unidades').all(),
    tecnicos: db.prepare('SELECT * FROM tecnicos').all(),
    marcas: db.prepare('SELECT * FROM marcas').all(),
    atendimentos,
    counters: db.prepare('SELECT * FROM counters').all()
  };
  res.setHeader('Content-Disposition', 'attachment; filename="heliar-backup.json"');
  res.json(backup);
});

router.post('/import', (req, res) => {
  const b = req.body || {};
  if (!b || !Array.isArray(b.atendimentos)) return res.status(400).json({ error: 'arquivo de backup inválido' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM atendimentos').run();
    db.prepare('DELETE FROM unidades').run();
    db.prepare('DELETE FROM tecnicos').run();
    db.prepare('DELETE FROM marcas').run();
    db.prepare('DELETE FROM counters').run();
    (b.unidades || []).forEach(u => db.prepare('INSERT INTO unidades (id, nome, cnpj, endereco, created_at) VALUES (?,?,?,?,?)')
      .run(u.id, u.nome, u.cnpj, u.endereco, u.created_at));
    (b.tecnicos || []).forEach(t => db.prepare('INSERT INTO tecnicos (id, nome, cpf, unidade_id, created_at) VALUES (?,?,?,?,?)')
      .run(t.id, t.nome, t.cpf, t.unidade_id, t.created_at));
    (b.marcas || []).forEach(m => db.prepare('INSERT INTO marcas (id, nome, created_at) VALUES (?,?,?)')
      .run(m.id, m.nome, m.created_at));
    (b.atendimentos || []).forEach(a => db.prepare(`INSERT INTO atendimentos
        (id, laudo_numero, unidade_id, status, data_atendimento, cliente_nome, veiculo_placa, numero_serie, foto_count, data_json, created_at, updated_at, created_by, updated_by)
        VALUES (@id,@laudo_numero,@unidade_id,@status,@data_atendimento,@cliente_nome,@veiculo_placa,@numero_serie,@foto_count,@data_json,@created_at,@updated_at,@created_by,@updated_by)`)
      .run(a));
    (b.counters || []).forEach(c => db.prepare('INSERT INTO counters (name, value) VALUES (?,?)').run(c.name, c.value));
  });
  try {
    tx();
  } catch (e) {
    console.error('erro ao importar backup', e);
    return res.status(500).json({ error: 'erro ao importar backup: ' + e.message });
  }
  // grava as fotos em disco depois da transação do banco ter sido confirmada
  fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  (b.atendimentos || []).forEach(a => {
    if (!Array.isArray(a.fotos) || a.fotos.length === 0) return;
    const dir = path.join(UPLOADS_DIR, a.id);
    fs.mkdirSync(dir, { recursive: true });
    a.fotos.forEach((foto, i) => {
      if (!foto) return;
      try { fs.writeFileSync(path.join(dir, i + '.jpg'), Buffer.from(foto, 'base64')); } catch (e) { /* ignora foto corrompida */ }
    });
  });
  res.json({ ok: true });
});

module.exports = router;
