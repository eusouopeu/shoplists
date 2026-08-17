import { getPurchaseHistory } from '../../db/database';
import type { PurchaseHistoryEntry } from '../../db/types';
import { useLiveQuery } from '../../state/useLiveQuery';
import { openSheet } from '../overlay';
import { Sparkline } from '../components/Sparkline';
import { AppBar, AppBarTitle, Centered, ScreenBody, SectionLabel, Screen, TextButton } from '../kit';

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPrice(p: number | null): string {
  return p != null ? `R$ ${p.toFixed(2)}` : '--';
}

interface PriceTrend {
  nome: string;
  entries: PurchaseHistoryEntry[];
}

function groupByItemName(history: PurchaseHistoryEntry[]): PriceTrend[] {
  const byName = new Map<string, PurchaseHistoryEntry[]>();
  for (const entry of history) {
    const bucket = byName.get(entry.itemNome) ?? [];
    bucket.push(entry);
    byName.set(entry.itemNome, bucket);
  }
  return Array.from(byName.entries())
    .map(([nome, entries]) => ({ nome, entries: entries.slice().sort((a, b) => a.data.getTime() - b.data.getTime()) }))
    .filter((t) => t.entries.filter((e) => e.precoPago != null).length >= 2)
    .sort((a, b) => b.entries.length - a.entries.length);
}

function openPriceDetail(trend: PriceTrend) {
  return openSheet<void>((close) => (
    <div class="py-3 pb-5">
      <div class="px-5 py-3 font-bold">{trend.nome}</div>
      {trend.entries.map((e) => (
        <div class="flex items-center justify-between gap-2.5 border-b border-border px-5 py-3" key={e.id}>
          <div>
            <div>{formatDate(e.data)}</div>
            <div class="mt-0.5 text-[0.85rem] text-text-muted">{e.listaNome}</div>
          </div>
          <span class="whitespace-nowrap font-bold">{formatPrice(e.precoPago)}</span>
        </div>
      ))}
      <div class="px-5 pt-2">
        <TextButton onClick={() => close()}>Fechar</TextButton>
      </div>
    </div>
  ));
}

export function HistoryScreen() {
  const history = useLiveQuery(() => getPurchaseHistory(), []);

  return (
    <Screen>
      <AppBar>
        <AppBarTitle>Histórico</AppBarTitle>
      </AppBar>
      <ScreenBody>
        {history === undefined ? (
          <Centered>Carregando…</Centered>
        ) : history.length === 0 ? (
          <Centered muted>
            <p class="max-w-[320px]">Nenhuma compra registrada ainda. Marque itens como comprados para começar o histórico.</p>
          </Centered>
        ) : (
          <HistoryBody history={history} />
        )}
      </ScreenBody>
    </Screen>
  );
}

function HistoryBody({ history }: { history: PurchaseHistoryEntry[] }) {
  const trends = groupByItemName(history);

  return (
    <>
      {trends.length > 0 && (
        <>
          <SectionLabel>Histórico de preço</SectionLabel>
          {trends.map((trend) => {
            const precos = trend.entries.map((e) => e.precoPago).filter((p): p is number => p != null);
            const last = precos[precos.length - 1];
            return (
              <div
                class="mb-2.5 flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3.5 shadow-sm"
                role="button"
                tabIndex={0}
                key={trend.nome}
                onClick={() => openPriceDetail(trend)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openPriceDetail(trend);
                }}
              >
                <div class="min-w-0 flex-1">
                  <div class="font-semibold">{trend.nome}</div>
                  <div class="mt-0.5 text-[0.85rem] text-text-muted">
                    {precos.length} preços • min {formatPrice(Math.min(...precos))} • máx {formatPrice(Math.max(...precos))}
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <Sparkline values={precos} />
                  <span class="whitespace-nowrap font-bold text-danger">{formatPrice(last)}</span>
                </div>
              </div>
            );
          })}
          <hr class="my-4 border-border" />
        </>
      )}

      <SectionLabel>Compras recentes</SectionLabel>
      {history.map((entry) => (
        <div class="flex items-center justify-between gap-2.5 border-b border-border py-3" key={entry.id}>
          <div>
            <div>{entry.itemNome}</div>
            <div class="mt-0.5 text-[0.85rem] text-text-muted">
              {entry.listaNome} • {formatDate(entry.data)}
              {entry.quantidade > 1 ? ` • qtd ${entry.quantidade}` : ''}
            </div>
          </div>
          <span class="whitespace-nowrap font-bold">{formatPrice(entry.precoPago)}</span>
        </div>
      ))}
    </>
  );
}
