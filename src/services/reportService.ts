import type { SpendingReport } from '../db/database';

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Gera um CSV (categoria, total, ocorrências) do relatório e dispara o download. */
export function exportSpendingReportCsv(report: SpendingReport): void {
  const lines = ['Categoria;Total;Compras'];
  for (const c of report.porCategoria) {
    lines.push([csvEscape(c.categoriaNome), c.total.toFixed(2).replace('.', ','), String(c.vezes)].join(';'));
  }
  lines.push(['Total', report.total.toFixed(2).replace('.', ','), ''].join(';'));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const inicio = report.inicio.toISOString().slice(0, 10);
  const fim = report.fim.toISOString().slice(0, 10);
  a.href = url;
  a.download = `relatorio-gastos-${inicio}-a-${fim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
