import { getPurchaseHistory } from '../../db/database';
import type { PurchaseHistoryEntry } from '../../db/types';
import { useLiveQuery } from '../../state/useLiveQuery';
import { openSheet } from '../overlay';
import { Sparkline } from '../components/Sparkline';

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
    <div class="sheet-list">
      <div class="sheet-title">{trend.nome}</div>
      {trend.entries.map((e) => (
        <div class="list-row" key={e.id}>
          <div>
            <div>{formatDate(e.data)}</div>
            <div class="card-subtitle">{e.listaNome}</div>
          </div>
          <span class="card-total">{formatPrice(e.precoPago)}</span>
        </div>
      ))}
      <button class="btn-text" onClick={() => close()}>
        Fechar
      </button>
    </div>
  ));
}

export function HistoryScreen() {
  const history = useLiveQuery(() => getPurchaseHistory(), []);

  return (
    <div class="screen">
      <header class="appbar">
        <h1>Histórico</h1>
      </header>
      <div class="screen-body">
        {history === undefined ? (
          <div class="centered">Carregando…</div>
        ) : history.length === 0 ? (
          <div class="centered muted">
            <p class="centered-text">Nenhuma compra registrada ainda. Marque itens como comprados para começar o histórico.</p>
          </div>
        ) : (
          <HistoryBody history={history} />
        )}
      </div>
    </div>
  );
}

function HistoryBody({ history }: { history: PurchaseHistoryEntry[] }) {
  const trends = groupByItemName(history);

  return (
    <>
      {trends.length > 0 && (
        <>
          <div class="section-label">Histórico de preço</div>
          {trends.map((trend) => {
            const precos = trend.entries.map((e) => e.precoPago).filter((p): p is number => p != null);
            const last = precos[precos.length - 1];
            return (
              <div
                class="card price-trend-card"
                role="button"
                tabIndex={0}
                key={trend.nome}
                onClick={() => openPriceDetail(trend)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openPriceDetail(trend);
                }}
              >
                <div class="card-main">
                  <div class="card-title">{trend.nome}</div>
                  <div class="card-subtitle">
                    {precos.length} preços • min {formatPrice(Math.min(...precos))} • máx {formatPrice(Math.max(...precos))}
                  </div>
                </div>
                <div class="card-trailing">
                  <Sparkline values={precos} />
                  <span class="card-total">{formatPrice(last)}</span>
                </div>
              </div>
            );
          })}
          <hr />
        </>
      )}

      <div class="section-label">Compras recentes</div>
      {history.map((entry) => (
        <div class="list-row" key={entry.id}>
          <div>
            <div>{entry.itemNome}</div>
            <div class="card-subtitle">
              {entry.listaNome} • {formatDate(entry.data)}
              {entry.quantidade > 1 ? ` • qtd ${entry.quantidade}` : ''}
            </div>
          </div>
          <span class="card-total">{formatPrice(entry.precoPago)}</span>
        </div>
      ))}
    </>
  );
}
