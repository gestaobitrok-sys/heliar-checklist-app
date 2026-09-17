/* Lista oficial de "Cod Motivo" / descrição, extraída da aba "Laudo" da planilha de
 * upload de garantia (modelo-upload-garantia.xlsx) enviada pela TROK. Usada tanto pelo
 * formulário (campo "Motivo") quanto pela exportação da planilha de garantia (coluna
 * "Laudo Cliente" recebe o código escolhido aqui). */
const MOTIVOS = [
  { codigo: '000', descricao: 'BATERIA NOVA COM CARGA INCOMPLETA' },
  { codigo: '0001', descricao: 'VAZAMENTO DE ELETROLITO PELAS ROLHAS OU NO PONTO D' },
  { codigo: '0002', descricao: 'BATERIA NOVA COM ETIQUETAS ERRADAS' },
  { codigo: '0003', descricao: 'VAZAMENTO EXTERNO ENTRE A TAMPA E A CAIXA(SELAGEM)' },
  { codigo: '0004', descricao: 'BATERIA NOVA COM CARGA INVERTIDA' },
  { codigo: '0005', descricao: 'MONTAGEM INCORRETA' },
  { codigo: '0006', descricao: 'POLOS TERMINAIS EM POSICAO INVERTIDA' },
  { codigo: '0007', descricao: 'POLOS COM FALHAS OU SOLDA DEFICIENTE' },
  { codigo: '0008', descricao: 'BATERIA SEM O CODIGO DE FABRICACAO' },
  { codigo: '0009', descricao: 'BATERIA NOVA COM CARGA INCOMPLETA' },
  { codigo: '0010', descricao: 'CURTO CIRCUITO' },
  { codigo: '0011', descricao: 'VAZAMENTO INTERNO' },
  { codigo: '0012', descricao: 'ISOLACAO INTERNA' },
  { codigo: '0013', descricao: 'CORROSAO PROCEDENTE' },
  { codigo: '0014', descricao: 'SKIP LOT - SEM ANALISE' },
  { codigo: '0015', descricao: 'Envio incorreto' },
  { codigo: '0016', descricao: 'CODIGO DUPLICADO' },
  { codigo: '0020', descricao: 'BATERIA IRREGULAR / CODIGO ADULTERADO' },
  { codigo: '0021', descricao: 'GARANTIA VENCIDA' },
  { codigo: '0022', descricao: 'BATERIA CONSERTADA POR TERCEIROS' },
  { codigo: '0023', descricao: 'CORROSAO IMPROCEDENTE' },
  { codigo: '0024', descricao: 'RESPIRO OU ROLHA DA BATERIA OBSTRUIDO' },
  { codigo: '0025', descricao: 'CAIXA QUEBRADA OU FURADA' },
  { codigo: '0026', descricao: 'TAMPA QUEBRADA OU FURADA' },
  { codigo: '0027', descricao: 'PLACAS SULFATADAS EM TODOS OS ELEMENTOS' },
  { codigo: '0028', descricao: 'SEM ELETROLITO OU NIVEL ABAIXO DO TOPO DAS PLACAS' },
  { codigo: '0029', descricao: 'POLOS DANIFICADOS' },
  { codigo: '0030', descricao: 'BATERIA USADA E RECARREGADA INVERTIDA' },
  { codigo: '0031', descricao: 'BATERIA DESCARREGADA' },
  { codigo: '0032', descricao: 'SEPARADORES DANIFICADOS NA SUPERFICIE, POR CAUSA E' },
  { codigo: '0033', descricao: 'SOBRECARGA' },
  { codigo: '0034', descricao: 'BATERIA COM ELETROLITO CONTAMINADO' },
  { codigo: '0035', descricao: 'ELETROLITO COM DENSIDADE ALTA' },
  { codigo: '0036', descricao: 'ELETROLITO COM DENSIDADE BAIXA' },
  { codigo: '0037', descricao: 'BATERIA SEM CERTIFICADO' },
  { codigo: '0038', descricao: 'CERTIFICADO RASURADO / ADULTERADO OU PREENCHIDO IN' },
  { codigo: '0039', descricao: 'USO / APLICACAO INCORRETA' },
  { codigo: '0040', descricao: 'BATERIA FALTANTE' },
  { codigo: '0041', descricao: 'CICLADA' },
  { codigo: '0042', descricao: 'TROCA POLITICA / ACORDO COMERCIAL' },
  { codigo: '0156', descricao: 'EXCESSO DE ESTOQUE' }
];

const MOTIVOS_POR_CODIGO = new Map(MOTIVOS.map(m => [m.codigo, m.descricao]));

module.exports = { MOTIVOS, MOTIVOS_POR_CODIGO };
