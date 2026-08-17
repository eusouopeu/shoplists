import { useEffect, useState } from 'preact/hooks';
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
import { checkBudgetAlert } from '../../services/notificationService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { confirmDialog } from '../components/ConfirmDialog';
import { openListFormSheet } from '../components/ListFormSheet';
import { pickOne } from '../components/PickerSheet';
import { openReceiptImportSheet } from '../components/ReceiptImportSheet';
import {
  IconArrowLeft,
  IconBars3,
  IconCart,
  IconCheckCircle,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconUploadTray,
} from '../icons';
import { ActionChip, AppBar, AppBarTitle, Centered, Fab, IconButton, ProgressBar, ScreenBody, SectionLabel, Screen } from '../kit';
import type { Screen as AppScreen } from '../types';
import { useDragReorder } from '../useDragReorder';

export function ListDetailScreen({
  listId,
  onBack,
  onPush,
}: {
  listId: number;
  onBack: () => void;
  onPush: (screen: AppScreen) => void;
}) {
  const list = useLiveQuery(() => getList(listId), [listId]);
  const items = useLiveQuery(() => getItemsForList(listId), [listId]);
  const total = useLiveQuery(() => totalPriceForList(listId), [listId, items]);
  const [marketMode, setMarketMode] = useState(false);

  useEffect(() => {
    if (list?.orcamento != null && total !== undefined) {
      void checkBudgetAlert(listId, list.nome, total, list.orcamento);
    }
  }, [listId, list?.nome, list?.orcamento, total]);

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
    <Screen>
      <AppBar>
        <IconButton label="Voltar" variant="header" onClick={onBack}>
          <IconArrowLeft size={22} />
        </IconButton>
        <AppBarTitle>{list?.nome ?? 'Lista'}</AppBarTitle>
        <IconButton label="Modo mercado" variant="header" active={marketMode} onClick={() => setMarketMode((v) => !v)}>
          <IconCart size={20} />
        </IconButton>
        <IconButton label="Editar lista" variant="header" onClick={() => list && openListFormSheet(list)}>
          <IconPencil size={20} />
        </IconButton>
        <IconButton label="Compartilhar lista" variant="header" onClick={compartilhar}>
          <IconUploadTray size={20} />
        </IconButton>
        <IconButton label="Importar nota fiscal" variant="header" onClick={importarNota}>
          <IconReceipt size={20} />
        </IconButton>
        <IconButton label="Marcar lista inteira como comprada" variant="header" onClick={confirmarMarcarTudo}>
          <IconCheckCircle size={20} />
        </IconButton>
      </AppBar>
      <div class="flex items-baseline justify-between px-4 py-4">
        <span class="font-semibold">Total</span>
        <span class="text-xl font-extrabold text-danger">{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
      </div>
      {list?.orcamento != null && total !== undefined && <BudgetBar total={total} orcamento={list.orcamento} />}
      <hr class="mx-4 my-0 border-border" />
      <ScreenBody>
        {!marketMode && items !== undefined && (
          <RecurringSuggestionsBanner listId={listId} currentItemNames={items.map((i) => i.nomeSimplificado)} />
        )}
        {items === undefined ? (
          <Centered>Carregando…</Centered>
        ) : items.length === 0 ? (
          <EmptyListBody listId={listId} />
        ) : (
          <ItemsList items={items} marketMode={marketMode} onPush={onPush} />
        )}
      </ScreenBody>
      {marketMode && items && items.length > 0 && (
        <div class="flex shrink-0 items-center justify-between bg-header px-5 py-3.5 font-bold text-white">
          <span>
            {comprados}/{items.length} itens
          </span>
          <span>{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
        </div>
      )}
      {!marketMode && (
        <Fab label="Novo item" onClick={() => onPush({ type: 'itemForm', listId })}>
          <IconPlus size={26} />
        </Fab>
      )}
    </Screen>
  );
}

function BudgetBar({ total, orcamento }: { total: number; orcamento: number }) {
  const pct = orcamento > 0 ? Math.min(100, (total / orcamento) * 100) : 0;
  const over = total > orcamento;
  return (
    <div class="flex flex-col gap-1 px-4 pb-3">
      <ProgressBar pct={pct} danger={over} />
      <span class={`text-[0.75rem] ${over ? 'font-semibold text-danger' : 'text-text-muted'}`}>
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
    <div class="mb-4 px-1">
      <SectionLabel>Provavelmente hora de comprar de novo</SectionLabel>
      <div class="flex flex-wrap gap-2">
        {filtradas.map((s) => (
          <ActionChip
            key={s.nome}
            title={`Comprado ${s.vezes}x, a cada ${Math.round(s.intervaloMedioDias)} dias em média`}
            onClick={() => adicionar(s)}
          >
            ＋ {s.nome}
          </ActionChip>
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
    <div class="flex flex-col items-stretch gap-4 pt-6">
      <Centered muted>Nenhum item ainda. Toque em + para adicionar.</Centered>
      {sugestoes !== undefined && sugestoes.length > 0 && (
        <div class="px-1">
          <SectionLabel>Sugestões de itens frequentes</SectionLabel>
          <div class="flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <ActionChip key={s.nome} onClick={() => adicionar(s)}>
                ＋ {s.nome}
              </ActionChip>
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
  onPush: (screen: AppScreen) => void;
}) {
  const { orderedItems, draggingId, containerRef, handleProps } = useDragReorder({
    items,
    getId: (item) => item.id!,
    onDrop: (ids) => void reorderItems(ids),
  });

  return (
    <div class="flex flex-col" ref={containerRef}>
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
  onPush: (screen: AppScreen) => void;
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

  const excluir = async (e: MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Excluir item?',
      content: `"${item.nomeSimplificado}" será excluído.`,
      confirmLabel: 'Excluir',
    });
    if (ok) await deleteItem(item.id!);
  };

  return (
    <div
      class={`flex items-center gap-2.5 border-b border-border ${marketMode ? 'py-[18px]' : 'py-3'} ${
        dragging ? 'bg-surface-muted opacity-60' : ''
      }`}
    >
      {dragHandleProps && (
        <span class="cursor-grab touch-none px-0.5 text-text-muted" onPointerDown={dragHandleProps.onPointerDown}>
          <IconBars3 size={18} />
        </span>
      )}
      <input
        type="checkbox"
        class={marketMode ? 'h-[26px] w-[26px] accent-[var(--color-accent)]' : 'h-4 w-4 accent-[var(--color-accent)]'}
        checked={item.comprado}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle((e.target as HTMLInputElement).checked)}
      />
      <div
        class="min-w-0 flex-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => !marketMode && onPush({ type: 'itemForm', listId: item.listaId, itemId: item.id! })}
        onKeyDown={(e) => {
          if (!marketMode && (e.key === 'Enter' || e.key === ' '))
            onPush({ type: 'itemForm', listId: item.listaId, itemId: item.id! });
        }}
      >
        <div class={`font-semibold ${item.comprado ? 'text-text-muted line-through' : ''} ${marketMode ? 'text-lg' : ''}`}>
          {item.nomeSimplificado}
        </div>
        <div class="mt-0.5 text-[0.85rem] text-text-muted">
          Qtd: {item.quantidade}
          {item.unidadesPorItem > 1 ? ` (kit ${item.unidadesPorItem}un)` : ''}
        </div>
      </div>
      <span class="whitespace-nowrap font-bold">{unitPrice != null ? `R$ ${unitPrice.toFixed(2)}` : '--'}</span>
      {!marketMode && (
        <IconButton label="Excluir item" onClick={excluir}>
          <IconTrash size={18} />
        </IconButton>
      )}
    </div>
  );
}
