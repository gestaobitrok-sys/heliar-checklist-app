const express = require('express');
const ExcelJS = require('exceljs');
const { db } = require('../db');
const { MOTIVOS } = require('../motivos');

const router = express.Router();

const HEADERS = [
  'Cod SKU', 'Cod Fabricacao', 'Data Venda', 'Data Reparo', 'Laudo Cliente',
  'Tensão de Recebimento (V)', 'Bateria Carregada', 'Tensão pós Carregada (V)',
  'Tensão início teste (V)', 'Tensão pós teste (V)', 'Período de repouso (h)',
  'Protocolo do SAC', 'Observação', 'Garantia Complementar (sim/não)'
];
const COL_WIDTHS = [10, 16, 11, 11, 13, 26, 16, 23, 20, 19, 21, 16, 32, 32];

function simNao(v) { return v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : ''; }
function brDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return (d && m && y) ? `${d}/${m}/${y}` : iso;
}

// Exporta SEMPRE só os atendimentos com laudo "procedente" (aprovados) — a pedido da
// TROK, os improcedentes ficam de fora, "em standby", nunca saem nesta planilha.
// Filtro opcional por período (data do atendimento = "Data Reparo").
router.get('/export', async (req, res) => {
  try {
    const { de, ate } = req.query;
    let rows = db.prepare("SELECT * FROM atendimentos WHERE status = 'procedente' ORDER BY data_atendimento").all();
    if (de) rows = rows.filter(r => r.data_atendimento && r.data_atendimento >= de);
    if (ate) rows = rows.filter(r => r.data_atendimento && r.data_atendimento <= ate);

    const atendimentos = rows.map(r => JSON.parse(r.data_json));

    const wb = new ExcelJS.Workbook();

    const wsDados = wb.addWorksheet('Dados');
    wsDados.columns = HEADERS.map((header, i) => ({ header, width: COL_WIDTHS[i] }));
    atendimentos.forEach(a => {
      const bateria = a.bateria || {};
      const teste = a.teste || {};
      const laudo = a.laudo || {};
      wsDados.addRow([
        bateria.cod_sku || '',
        bateria.cod_fabricacao || '',
        brDate(bateria.data_venda),
        brDate(a.data),
        laudo.motivo || '',
        teste.tensao_recebimento || '',
        simNao(teste.bateria_carregada),
        teste.tensao_pos_carregada || '',
        teste.tensao_inicio_teste || '',
        teste.tensao_pos_teste || '',
        teste.periodo_repouso_horas || '',
        teste.protocolo_sac || '',
        teste.observacao || '',
        simNao(teste.garantia_complementar)
      ]);
    });

    const wsLaudo = wb.addWorksheet('Laudo');
    wsLaudo.columns = [{ header: 'Cod Motivo', width: 12 }, { header: 'Descricao', width: 55 }];
    MOTIVOS.forEach(m => wsLaudo.addRow([m.codigo, m.descricao]));

    const buf = await wb.xlsx.writeBuffer();
    const hoje = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="garantia-procedentes-${hoje}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('erro ao gerar planilha de garantia', e);
    res.status(500).json({ error: 'erro ao gerar a planilha' });
  }
});

module.exports = router;
