import { useMemo, useState } from 'preact/hooks';
import { getSpendingReport } from '../../db/database';
import { exportSpendingReportCsv } from '../../services/reportService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { IconDocumentDownload } from '../icons';
import { ActionChip, AppBar, AppBarTitle, Centered, ProgressBar, ScreenBody, SectionLabel, Screen, TextButton } from '../kit';

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
    <Screen>
      <AppBar>
        <AppBarTitle>Relatório de gastos</AppBarTitle>
      </AppBar>
      <ScreenBody>
        <div class="mb-3 flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <ActionChip key={p.value} selected={p.value === period} onClick={() => setPeriod(p.value)}>
              {p.label}
            </ActionChip>
          ))}
        </div>
        <div class="text-[0.85rem] text-text-muted">{formatRange(inicio, fim)}</div>

        {report === undefined ? (
          <Centered>Carregando…</Centered>
        ) : report.entradas.length === 0 ? (
          <Centered muted>
            <p class="max-w-[320px]">Nenhuma compra registrada neste período.</p>
          </Centered>
        ) : (
          <>
            <div class="my-3 text-2xl font-extrabold text-danger">{formatPrice(report.total)}</div>
            <SectionLabel>Por categoria</SectionLabel>
            {report.porCategoria.map((c) => {
              const pct = report.total > 0 ? Math.round((c.total / report.total) * 100) : 0;
              return (
                <div class="mb-3" key={c.categoriaId ?? 'none'}>
                  <div class="mb-1 text-[0.85rem] text-text-muted">
                    {c.categoriaNome} • {formatPrice(c.total)} ({pct}%) • {c.vezes} {c.vezes === 1 ? 'compra' : 'compras'}
                  </div>
                  <ProgressBar pct={pct} />
                </div>
              );
            })}
            <TextButton onClick={() => exportSpendingReportCsv(report)}>
              <span class="inline-flex items-center gap-1.5">
                <IconDocumentDownload size={18} /> Exportar CSV
              </span>
            </TextButton>
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}
