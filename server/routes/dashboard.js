const express = require('express');
const ExcelJS = require('exceljs');

const router = express.Router();

// Exporta o Dashboard (resumo + ranking de Cod SKU + atendimentos do filtro) em .xlsx.
// O front já calcula tudo com os mesmos filtros da tela e manda aqui pronto — assim o
// Excel bate exatamente com o que está sendo visto/impresso.
const VERDE = 'FF2E7D46', VERMELHO = 'FF970C22', AMBAR = 'FFB8791A', CINZA = 'FFEEECE8';

function str(v) { return v === undefined || v === null ? '' : String(v).slice(0, 500); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function frac(n, d) { return d ? n / d : null; }

function headerRow(ws, rowNum) {
  const row = ws.getRow(rowNum);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F7A3D' } };
    c.alignment = { vertical: 'middle' };
  });
}

router.post('/export', async (req, res) => {
  try {
    const body = req.body || {};
    const cab = body.cabecalho || {};
    const tot = body.tot || {};
    const ranking = Array.isArray(body.ranking) ? body.ranking.slice(0, 5000) : [];
    const atendimentos = Array.isArray(body.atendimentos) ? body.atendimentos.slice(0, 50000) : [];
    const total = num(tot.total);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Heliar · TROK Service';

    /* ---------- Resumo ---------- */
    const wsR = wb.addWorksheet('Resumo');
    wsR.columns = [{ width: 26 }, { width: 14 }, { width: 14 }];
    wsR.addRow(['Relatório de Atendimentos — Heliar / TROK Service']).font = { bold: true, size: 14 };
    wsR.addRow(['Período', str(cab.periodo)]);
    wsR.addRow(['Unidade', str(cab.unidade)]);
    if (cab.busca) wsR.addRow(['Busca', str(cab.busca)]);
    wsR.addRow(['Emitido em', str(cab.emitido) + (cab.emitidoPor ? ' por ' + str(cab.emitidoPor) : '')]);
    wsR.addRow([]);
    const hR = wsR.addRow(['Indicador', 'Quantidade', '% do total']);
    headerRow(wsR, hR.number);
    const linhas = [
      ['Total de atendimentos', total, total ? 1 : null, null],
      ['Procedentes', num(tot.procedente), frac(num(tot.procedente), total), VERDE],
      ['Improcedentes', num(tot.improcedente), frac(num(tot.improcedente), total), VERMELHO],
      ['Em teste', num(tot.em_teste), frac(num(tot.em_teste), total), AMBAR]
    ];
    linhas.forEach(([l, q, p, cor]) => {
      const r = wsR.addRow([l, q, p]);
      r.getCell(3).numFmt = '0.0%';
      if (cor) r.getCell(1).font = { bold: true, color: { argb: cor } };
      else r.font = { bold: true };
    });
    wsR.addRow([]);
    wsR.addRow(['SKUs diferentes no período', ranking.length]);

    /* ---------- Ranking SKU ---------- */
    const wsK = wb.addWorksheet('Ranking SKU');
    wsK.columns = [
      { header: 'Posição', width: 9 }, { header: 'Cod SKU', width: 16 }, { header: 'Total', width: 9 },
      { header: 'Procedentes', width: 13 }, { header: 'Improcedentes', width: 15 }, { header: 'Em teste', width: 10 },
      { header: '% Procedência', width: 14 }, { header: '% do total geral', width: 16 }
    ];
    headerRow(wsK, 1);
    ranking.forEach((r, i) => {
      const t = num(r.total);
      const row = wsK.addRow([i + 1, str(r.sku), t, num(r.procedente), num(r.improcedente), num(r.em_teste), frac(num(r.procedente), t), frac(t, total)]);
      row.getCell(7).numFmt = '0.0%';
      row.getCell(8).numFmt = '0.0%';
      row.getCell(4).font = { color: { argb: VERDE } };
      row.getCell(5).font = { color: { argb: VERMELHO } };
      row.getCell(6).font = { color: { argb: AMBAR } };
      if (i % 2) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA } }; });
    });
    wsK.views = [{ state: 'frozen', ySplit: 1 }];
    wsK.autoFilter = { from: 'A1', to: 'H1' };

    /* ---------- Atendimentos ---------- */
    const wsA = wb.addWorksheet('Atendimentos');
    wsA.columns = [
      { header: 'Laudo', width: 12 }, { header: 'Data', width: 11 }, { header: 'Unidade', width: 22 },
      { header: 'Cliente', width: 30 }, { header: 'Placa', width: 10 }, { header: 'Cod SKU', width: 14 },
      { header: 'Cod Fabricação', width: 16 }, { header: 'Status', width: 14 }, { header: 'Motivo', width: 50 }
    ];
    headerRow(wsA, 1);
    atendimentos.forEach(a => {
      const row = wsA.addRow([str(a.laudo), str(a.data), str(a.unidade), str(a.cliente), str(a.placa), str(a.sku), str(a.fabricacao), str(a.status), str(a.motivo)]);
      const cor = a.status === 'Procedente' ? VERDE : a.status === 'Improcedente' ? VERMELHO : AMBAR;
      row.getCell(8).font = { bold: true, color: { argb: cor } };
    });
    wsA.views = [{ state: 'frozen', ySplit: 1 }];
    wsA.autoFilter = { from: 'A1', to: 'I1' };

    const buf = await wb.xlsx.writeBuffer();
    const hoje = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-heliar-${hoje}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('erro ao gerar Excel do dashboard', e);
    res.status(500).json({ error: 'erro ao gerar o Excel' });
  }
});

module.exports = router;
