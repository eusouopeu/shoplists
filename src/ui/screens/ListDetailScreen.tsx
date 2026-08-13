import {
  chooseLink,
  deleteItem,
  getItemsForList,
  getLinksForItem,
  getList,
  markItemPurchased,
  markListPurchased,
  totalPriceForList,
  unitPriceForItem,
  unmarkItemPurchased,
} from '../../db/database';
import type { ShoppingListItem } from '../../db/types';
import { useLiveQuery } from '../../state/useLiveQuery';
import { confirmDialog } from '../components/ConfirmDialog';
import { pickOne } from '../components/PickerSheet';
import type { Screen } from '../types';

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

  return (
    <div class="screen">
      <header class="appbar">
        <button class="icon-btn appbar-back" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <h1>{list?.nome ?? 'Lista'}</h1>
        <button class="icon-btn" aria-label="Marcar lista inteira como comprada" onClick={confirmarMarcarTudo}>
          ✓✓
        </button>
      </header>
      <div class="total-row">
        <span class="total-label">Total</span>
        <span class="total-value">{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
      </div>
      <hr />
      <div class="screen-body">
        {items === undefined ? (
          <div class="centered">Carregando…</div>
        ) : items.length === 0 ? (
          <div class="centered muted">Nenhum item ainda. Toque em + para adicionar.</div>
        ) : (
          items.map((item) => <ItemRow key={item.id} item={item} onPush={onPush} />)
        )}
      </div>
      <button
        class="fab"
        aria-label="Novo item"
        onClick={() => onPush({ type: 'itemForm', listId })}
      >
        +
      </button>
    </div>
  );
}

function ItemRow({ item, onPush }: { item: ShoppingListItem; onPush: (screen: Screen) => void }) {
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

  return (
    <div class="list-row item-row">
      <input
        type="checkbox"
        checked={item.comprado}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle((e.target as HTMLInputElement).checked)}
      />
      <div
        class="item-row-main"
        role="button"
        tabIndex={0}
        onClick={() => onPush({ type: 'itemForm', listId: item.listaId, itemId: item.id! })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ')
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
      <button class="icon-btn" aria-label="Excluir item" onClick={excluir}>
        🗑
      </button>
    </div>
  );
}
