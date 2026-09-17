const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, UPLOADS_DIR } = require('../db');

const router = express.Router();
function uid() { return crypto.randomBytes(9).toString('base64url'); }

function nextLaudoNumero() {
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('laudo');
    const next = (row ? row.value : 0) + 1;
    db.prepare('INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = ?')
      .run('laudo', next, next);
    return next;
  });
  const n = tx();
  return 'HEL-' + String(n).padStart(5, '0');
}

function rowToObject(row) {
  const obj = JSON.parse(row.data_json);
  obj.foto_count = row.foto_count || 0;
  return obj;
}

function extractIndexFields(obj) {
  return {
    unidade_id: obj.unidade_id || null,
    status: (obj.laudo && obj.laudo.status) || 'em_teste',
    data_atendimento: obj.data || null,
    cliente_nome: (obj.cliente && obj.cliente.nome) || null,
    veiculo_placa: (obj.veiculo && obj.veiculo.placa) || null,
    // coluna "numero_serie" reaproveitada pra indexar o Cod SKU (o antigo número de série
    // de bateria não é mais coletado desde a mudança pro modelo da planilha de garantia)
    numero_serie: (obj.bateria && obj.bateria.cod_sku) || null
  };
}

/* GET /api/atendimentos - lista completa (frontend filtra no cliente, como antes) */
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM atendimentos ORDER BY created_at DESC').all();
  res.json(rows.map(rowToObject));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM atendimentos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'atendimento não encontrado' });
  res.json(rowToObject(row));
});

/* POST /api/atendimentos - cria novo atendimento */
router.post('/', (req, res) => {
  const data = req.body || {};
  const id = uid();
  const laudo_numero = nextLaudoNumero();
  const now = new Date().toISOString();
  const obj = Object.assign({}, data, { id, laudo_numero, created_at: now });
  delete obj.foto_count;
  const idx = extractIndexFields(obj);
  db.prepare(`INSERT INTO atendimentos
    (id, laudo_numero, unidade_id, status, data_atendimento, cliente_nome, veiculo_placa, numero_serie, foto_count, data_json, created_by, updated_by)
    VALUES (@id, @laudo_numero, @unidade_id, @status, @data_atendimento, @cliente_nome, @veiculo_placa, @numero_serie, 0, @data_json, @user, @user)`)
    .run(Object.assign({}, idx, {
      id, laudo_numero, data_json: JSON.stringify(obj), user: req.user ? req.user.login : null
    }));
  res.status(201).json(obj);
});

/* PUT /api/atendimentos/:id - atualiza (merge raso feito no servidor a partir do objeto já mesclado enviado pelo front) */
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM atendimentos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'atendimento não encontrado' });
  const obj = req.body || {};
  obj.id = existing.id;
  obj.laudo_numero = existing.laudo_numero;
  const foto_count = existing.foto_count;
  delete obj.foto_count;
  const idx = extractIndexFields(obj);
  db.prepare(`UPDATE atendimentos SET
      unidade_id=@unidade_id, status=@status, data_atendimento=@data_atendimento,
      cliente_nome=@cliente_nome, veiculo_placa=@veiculo_placa, numero_serie=@numero_serie,
      data_json=@data_json, updated_at=datetime('now'), updated_by=@user
    WHERE id=@id`)
    .run(Object.assign({}, idx, { id: existing.id, data_json: JSON.stringify(obj), user: req.user ? req.user.login : null }));
  obj.foto_count = foto_count;
  res.json(obj);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM atendimentos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'atendimento não encontrado' });
  db.prepare('DELETE FROM atendimentos WHERE id = ?').run(req.params.id);
  const dir = path.join(UPLOADS_DIR, req.params.id);
  fs.rm(dir, { recursive: true, force: true }, () => {});
  res.json({ ok: true });
});

/* ---------------- FOTOS ----------------
   Fotos são recebidas como um array de strings base64 (jpeg, sem o prefixo data:), o mesmo formato
   que o app já usava com o IndexedDB — assim o código de compressão/preview no navegador não precisou mudar.
   No servidor elas são gravadas como arquivos em disco (mais leve que manter tudo em base64 no banco). */
router.get('/:id/fotos', (req, res) => {
  const row = db.prepare('SELECT foto_count FROM atendimentos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'atendimento não encontrado' });
  const dir = path.join(UPLOADS_DIR, req.params.id);
  const fotos = [];
  for (let i = 0; i < (row.foto_count || 0); i++) {
    const file = path.join(dir, i + '.jpg');
    try {
      fotos.push(fs.readFileSync(file).toString('base64'));
    } catch (e) {
      fotos.push(null);
    }
  }
  res.json({ fotos });
});

router.put('/:id/fotos', (req, res) => {
  const existing = db.prepare('SELECT * FROM atendimentos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'atendimento não encontrado' });
  const fotos = Array.isArray(req.body && req.body.fotos) ? req.body.fotos : null;
  if (!fotos) return res.status(400).json({ error: 'envie { fotos: [base64, ...] }' });

  const MAX_PER_FOTO = 6 * 1024 * 1024; // ~6MB em base64 por foto, folga generosa
  for (const f of fotos) {
    if (typeof f !== 'string' || f.length > MAX_PER_FOTO) {
      return res.status(413).json({ error: 'uma das fotos é inválida ou grande demais' });
    }
  }

  const dir = path.join(UPLOADS_DIR, req.params.id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    // limpa fotos antigas que sobrarem de uma gravação anterior com mais fotos
    const oldCount = existing.foto_count || 0;
    for (let i = fotos.length; i < oldCount; i++) {
      try { fs.unlinkSync(path.join(dir, i + '.jpg')); } catch (e) { /* ignora */ }
    }
    fotos.forEach((base64, i) => {
      fs.writeFileSync(path.join(dir, i + '.jpg'), Buffer.from(base64, 'base64'));
    });
  } catch (e) {
    console.error('erro ao salvar fotos', e);
    return res.status(500).json({ error: 'erro ao salvar fotos no servidor' });
  }

  db.prepare("UPDATE atendimentos SET foto_count = ?, updated_at = datetime('now') WHERE id = ?")
    .run(fotos.length, req.params.id);
  res.json({ ok: true, foto_count: fotos.length });
});

module.exports = router;
