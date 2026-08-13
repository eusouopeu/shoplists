import { deleteList, getLists, totalPriceForList } from '../../db/database';
import type { ShoppingList } from '../../db/types';
import { listStatusLabel, listTypeLabel } from '../../domain/labels';
import { useLiveQuery } from '../../state/useLiveQuery';
import { confirmDialog } from '../components/ConfirmDialog';
import { openListFormSheet } from '../components/ListFormSheet';
import type { Screen } from '../types';

export function ListsScreen({ onPush }: { onPush: (screen: Screen) => void }) {
  const lists = useLiveQuery(() => getLists(), []);

  return (
    <div class="screen">
      <header class="appbar">
        <h1>Listas de Compras</h1>
      </header>
      <div class="screen-body">
        {lists === undefined ? (
          <div class="centered">Carregando…</div>
        ) : lists.length === 0 ? (
          <div class="centered muted">Nenhuma lista ainda. Toque em + para criar.</div>
        ) : (
          <ListsBody lists={lists} onPush={onPush} />
        )}
      </div>
      <button class="fab" aria-label="Nova lista" onClick={() => openListFormSheet()}>
        +
      </button>
    </div>
  );
}

function ListsBody({ lists, onPush }: { lists: ShoppingList[]; onPush: (screen: Screen) => void }) {
  const aguardando = lists.filter((l) => l.status === 'aguardandoRessurgir');
  const outras = lists.filter((l) => l.status !== 'aguardandoRessurgir');

  return (
    <div class="list-stack">
      {aguardando.length > 0 && (
        <>
          <div class="section-label">Prontas para ressurgir</div>
          {aguardando.map((l) => (
            <ListCard key={l.id} list={l} destacada onPush={onPush} />
          ))}
          <hr />
        </>
      )}
      {outras.map((l) => (
        <ListCard key={l.id} list={l} destacada={false} onPush={onPush} />
      ))}
    </div>
  );
}

function ListCard({
  list,
  destacada,
  onPush,
}: {
  list: ShoppingList;
  destacada: boolean;
  onPush: (screen: Screen) => void;
}) {
  const total = useLiveQuery(() => totalPriceForList(list.id!), [list.id]);

  const subtitleParts = [listTypeLabel(list.tipo), listStatusLabel(list.status)];
  if (list.tipo === 'periodica' && list.intervaloDias != null) {
    subtitleParts.push(`a cada ${list.intervaloDias} dias`);
  }

  const excluir = async (e: Event) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Excluir lista?',
      content: `A lista "${list.nome}" e todos os seus itens serão excluídos.`,
      confirmLabel: 'Excluir',
    });
    if (ok) await deleteList(list.id!);
  };

  const abrir = () => onPush({ type: 'listDetail', listId: list.id! });

  return (
    <div
      class={destacada ? 'card card--highlight' : 'card'}
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') abrir();
      }}
    >
      <div class="card-main">
        <div class="card-title">{list.nome}</div>
        <div class="card-subtitle">{subtitleParts.join(' • ')}</div>
      </div>
      <div class="card-trailing">
        <span class="card-total">{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
        <button class="icon-btn" aria-label="Excluir lista" onClick={excluir}>
          🗑
        </button>
      </div>
    </div>
  );
}
