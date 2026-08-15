import { useState } from 'preact/hooks';
import {
  chooseLink,
  deleteItem,
  getFrequentItemNames,
  getItemsForList,
  getLinksForItem,
  getList,
  getRecurringItemSuggestions,
  insertItem,
  markItemPurchased,
  markListPurchased,
  reorderItems,
  totalPriceForList,
  unitPriceForItem,
  unmarkItemPurchased,
} from '../../db/database';
import type { FrequentItem, RecurringSuggestion } from '../../db/database';
import type { ShoppingListItem } from '../../db/types';
import { exportListShare } from '../../services/backupService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { confirmDialog } from '../components/ConfirmDialog';
import { openListFormSheet } from '../components/ListFormSheet';
import { pickOne } from '../components/PickerSheet';
import { openReceiptImportSheet } from '../components/ReceiptImportSheet';
import type { Screen } from '../types';
import { useDragReorder } from '../useDragReorder';

export function ListDetailScreen({
  listId,
  onBack,
  onPush,
}: {
  listId: number;
  onBack: () => void;
  onPush: (screen: Screen) => void;
}) {
  const list = useLiveQuery(() => getList(listId), [listId]);
  const items = useLiveQuery(() => getItemsForList(listId), [listId]);
  const total = useLiveQuery(() => totalPriceForList(listId), [listId, items]);
  const [marketMode, setMarketMode] = useState(false);

  const confirmarMarcarTudo = async () => {
    const ok = await confirmDialog({
      title: 'Marcar lista como comprada?',
      content:
        'Todos os itens pendentes serão marcados como comprados ' +
        '(usando o link de menor preço quando houver mais de um).',
      confirmLabel: 'Confirmar',
    });
    if (!ok) return;

    const pendentes = (await getItemsForList(listId)).filter((i) => !i.comprado);
    for (const item of pendentes) {
      const links = await getLinksForItem(item.id!);
      if (links.length > 0 && !links.some((l) => l.escolhido)) {
        const cheapest = links.reduce((a, b) => ((a.preco ?? Infinity) < (b.preco ?? Infinity) ? a : b));
        await chooseLink(item.id!, cheapest.id!);
      }
    }
    await markListPurchased(listId);
  };

  const compartilhar = async () => {
    if (!list) return;
    await exportListShare(listId, list.nome);
  };

  const importarNota = () => {
    void openReceiptImportSheet(listId);
  };

  const comprados = items?.filter((i) => i.comprado).length ?? 0;

  return (
    <div class="screen">
      <header class="appbar">
        <button class="icon-btn appbar-back" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <h1>{list?.nome ?? 'Lista'}</h1>
        <button
          class={marketMode ? 'icon-btn icon-btn--active' : 'icon-btn'}
          aria-label="Modo mercado"
          onClick={() => setMarketMode((v) => !v)}
        >
          🛒
        </button>
        <button class="icon-btn" aria-label="Editar lista" onClick={() => list && openListFormSheet(list)}>
          ✎
        </button>
        <button class="icon-btn" aria-label="Compartilhar lista" onClick={compartilhar}>
          ⇪
        </button>
        <button class="icon-btn" aria-label="Importar nota fiscal" onClick={importarNota}>
          🧾
        </button>
        <button class="icon-btn" aria-label="Marcar lista inteira como comprada" onClick={confirmarMarcarTudo}>
          ✓✓
        </button>
      </header>
      <div class="total-row">
        <span class="total-label">Total</span>
        <span class="total-value">{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
      </div>
      {list?.orcamento != null && total !== undefined && (
        <BudgetBar total={total} orcamento={list.orcamento} />
      )}
      <hr />
      <div class="screen-body">
        {!marketMode && items !== undefined && (
          <RecurringSuggestionsBanner listId={listId} currentItemNames={items.map((i) => i.nomeSimplificado)} />
        )}
        {items === undefined ? (
          <div class="centered">Carregando…</div>
        ) : items.length === 0 ? (
          <EmptyListBody listId={listId} />
        ) : (
          <ItemsList items={items} marketMode={marketMode} onPush={onPush} />
        )}
      </div>
      {marketMode && items && items.length > 0 && (
        <div class="market-footer">
          <span>
            {comprados}/{items.length} itens
          </span>
          <span>{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
        </div>
      )}
      {!marketMode && (
        <button class="fab" aria-label="Novo item" onClick={() => onPush({ type: 'itemForm', listId })}>
          +
        </button>
      )}
    </div>
  );
}

function BudgetBar({ total, orcamento }: { total: number; orcamento: number }) {
  const pct = orcamento > 0 ? Math.min(100, (total / orcamento) * 100) : 0;
  const over = total > orcamento;
  return (
    <div class="budget-row">
      <div class="budget-bar">
        <div
          class={over ? 'budget-bar-fill budget-bar-fill--over' : 'budget-bar-fill'}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span class={over ? 'budget-label budget-label--over' : 'budget-label'}>
        {over ? 'Acima do orçamento • ' : ''}
        orçamento R$ {orcamento.toFixed(2)}
      </span>
    </div>
  );
}

function RecurringSuggestionsBanner({
  listId,
  currentItemNames,
}: {
  listId: number;
  currentItemNames: string[];
}) {
  const sugestoes = useLiveQuery(() => getRecurringItemSuggestions(4), []);
  const jaNaLista = new Set(currentItemNames);
  const filtradas = (sugestoes ?? []).filter((s) => !jaNaLista.has(s.nome));

  const adicionar = async (s: RecurringSuggestion) => {
    await insertItem({ listaId: listId, nomeSimplificado: s.nome, categoriaId: s.categoriaId });
  };

  if (filtradas.length === 0) return null;

  return (
    <div class="suggestions suggestions--recurring">
      <div class="section-label">Provavelmente hora de comprar de novo</div>
      <div class="chip-wrap">
        {filtradas.map((s) => (
          <button
            key={s.nome}
            class="chip chip--action"
            title={`Comprado ${s.vezes}x, a cada ${Math.round(s.intervaloMedioDias)} dias em média`}
            onClick={() => adicionar(s)}
          >
            ＋ {s.nome}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyListBody({ listId }: { listId: number }) {
  const sugestoes = useLiveQuery(() => getFrequentItemNames(6), []);

  const adicionar = async (s: FrequentItem) => {
    await insertItem({ listaId: listId, nomeSimplificado: s.nome, categoriaId: s.categoriaId });
  };

  return (
    <div class="centered-column">
      <div class="centered muted">Nenhum item ainda. Toque em + para adicionar.</div>
      {sugestoes !== undefined && sugestoes.length > 0 && (
        <div class="suggestions">
          <div class="section-label">Sugestões de itens frequentes</div>
          <div class="chip-wrap">
            {sugestoes.map((s) => (
              <button key={s.nome} class="chip chip--action" onClick={() => adicionar(s)}>
                ＋ {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsList({
  items,
  marketMode,
  onPush,
}: {
  items: ShoppingListItem[];
  marketMode: boolean;
  onPush: (screen: Screen) => void;
}) {
  const { orderedItems, draggingId, containerRef, handleProps } = useDragReorder({
    items,
    getId: (item) => item.id!,
    onDrop: (ids) => void reorderItems(ids),
  });

  return (
    <div class="item-list" ref={containerRef}>
      {orderedItems.map((item) => (
        <div key={item.id} data-drag-id={item.id}>
          <ItemRow
            item={item}
            marketMode={marketMode}
            dragging={draggingId === item.id}
            dragHandleProps={marketMode ? undefined : handleProps(item.id!)}
            onPush={onPush}
          />
        </div>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  marketMode,
  dragging,
  dragHandleProps,
  onPush,
}: {
  item: ShoppingListItem;
  marketMode: boolean;
  dragging: boolean;
  dragHandleProps?: { onPointerDown: (e: PointerEvent) => void };
  onPush: (screen: Screen) => void;
}) {
  const unitPrice = useLiveQuery(() => unitPriceForItem(item), [item.id, item.comprado]);

  const onToggle = async (checked: boolean) => {
    if (!checked) {
      await unmarkItemPurchased(item.id!);
      return;
    }
    const links = await getLinksForItem(item.id!);
    if (links.length === 0) {
      await markItemPurchased(item.id!);
      return;
    }
    if (links.length === 1) {
      await chooseLink(item.id!, links[0].id!);
      await markItemPurchased(item.id!);
      return;
    }
    const chosen = await pickOne({
      title: 'Qual link foi comprado?',
      options: links.map((l) => ({
        value: l.id!,
        label: l.url,
        sublabel: l.preco != null ? `R$ ${l.preco.toFixed(2)}` : 'Sem preço',
      })),
    });
    if (chosen != null) await chooseLink(item.id!, chosen);
    await markItemPurchased(item.id!);
  };

  const excluir = async (e: Event) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Excluir item?',
      content: `"${item.nomeSimplificado}" será excluído.`,
      confirmLabel: 'Excluir',
    });
    if (ok) await deleteItem(item.id!);
  };

  const rowClass = [
    'list-row',
    'item-row',
    marketMode ? 'item-row--market' : '',
    dragging ? 'item-row--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={rowClass}>
      {dragHandleProps && (
        <span class="drag-handle" onPointerDown={dragHandleProps.onPointerDown}>
          ⠿
        </span>
      )}
      <input
        type="checkbox"
        class={marketMode ? 'checkbox--large' : ''}
        checked={item.comprado}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle((e.target as HTMLInputElement).checked)}
      />
      <div
        class="item-row-main"
        role="button"
        tabIndex={0}
        onClick={() => !marketMode && onPush({ type: 'itemForm', listId: item.listaId, itemId: item.id! })}
        onKeyDown={(e) => {
          if (!marketMode && (e.key === 'Enter' || e.key === ' '))
            onPush({ type: 'itemForm', listId: item.listaId, itemId: item.id! });
        }}
      >
        <div class={item.comprado ? 'card-title item-name--done' : 'card-title'}>{item.nomeSimplificado}</div>
        <div class="card-subtitle">
          Qtd: {item.quantidade}
          {item.unidadesPorItem > 1 ? ` (kit ${item.unidadesPorItem}un)` : ''}
        </div>
      </div>
      <span class="card-total">{unitPrice != null ? `R$ ${unitPrice.toFixed(2)}` : '--'}</span>
      {!marketMode && (
        <button class="icon-btn" aria-label="Excluir item" onClick={excluir}>
          🗑
        </button>
      )}
    </div>
  );
}
