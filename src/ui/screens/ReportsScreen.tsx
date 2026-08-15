import { useMemo, useState } from 'preact/hooks';
import { getSpendingReport } from '../../db/database';
import { exportSpendingReportCsv } from '../../services/reportService';
import { useLiveQuery } from '../../state/useLiveQuery';

type Period = 'mesAtual' | 'mesPassado' | 'ultimos3Meses' | 'anoAtual';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'mesAtual', label: 'Este mês' },
  { value: 'mesPassado', label: 'Mês passado' },
  { value: 'ultimos3Meses', label: 'Últimos 3 meses' },
  { value: 'anoAtual', label: 'Este ano' },
];

function periodRange(period: Period): { inicio: Date; fim: Date } {
  const now = new Date();
  if (period === 'mesAtual') {
    return { inicio: new Date(now.getFullYear(), now.getMonth(), 1), fim: now };
  }
  if (period === 'mesPassado') {
    const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fim = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { inicio, fim };
  }
  if (period === 'ultimos3Meses') {
    return { inicio: new Date(now.getFullYear(), now.getMonth() - 2, 1), fim: now };
  }
  return { inicio: new Date(now.getFullYear(), 0, 1), fim: now };
}

function formatPrice(p: number): string {
  return `R$ ${p.toFixed(2)}`;
}

function formatRange(inicio: Date, fim: Date): string {
  const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${f(inicio)} – ${f(fim)}`;
}

export function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('mesAtual');
  const { inicio, fim } = useMemo(() => periodRange(period), [period]);
  const report = useLiveQuery(() => getSpendingReport(inicio, fim), [inicio.getTime(), fim.getTime()]);

  return (
    <div class="screen">
      <header class="appbar">
        <h1>Relatório de gastos</h1>
      </header>
      <div class="screen-body">
        <div class="report-period-row">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              class={p.value === period ? 'chip chip--action chip--selected' : 'chip chip--action'}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div class="card-subtitle">{formatRange(inicio, fim)}</div>

        {report === undefined ? (
          <div class="centered">Carregando…</div>
        ) : report.entradas.length === 0 ? (
          <div class="centered muted">
            <p class="centered-text">Nenhuma compra registrada neste período.</p>
          </div>
        ) : (
          <>
            <div class="report-total">{formatPrice(report.total)}</div>
            <div class="section-label">Por categoria</div>
            {report.porCategoria.map((c) => {
              const pct = report.total > 0 ? Math.round((c.total / report.total) * 100) : 0;
              return (
                <div class="report-category-row" key={c.categoriaId ?? 'none'}>
                  <div class="card-subtitle">
                    {c.categoriaNome} • {formatPrice(c.total)} ({pct}%) • {c.vezes}{' '}
                    {c.vezes === 1 ? 'compra' : 'compras'}
                  </div>
                  <div class="report-bar-track">
                    <div class="report-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <button class="btn-text" onClick={() => exportSpendingReportCsv(report)}>
              ⬇️ Exportar CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}
