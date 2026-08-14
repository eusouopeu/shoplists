import { useRef } from 'preact/hooks';
import { deleteList, getExpiringWarranties, getLists, totalPriceForList } from '../../db/database';
import type { ExpiringWarranty } from '../../db/database';
import type { ShoppingList } from '../../db/types';
import { listStatusLabel, listTypeLabel } from '../../domain/labels';
import { importListFromFile } from '../../services/backupService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { alertDialog, confirmDialog } from '../components/ConfirmDialog';
import { openListFormSheet } from '../components/ListFormSheet';
import { openSheet } from '../overlay';
import type { Screen } from '../types';

export function ListsScreen({ onPush }: { onPush: (screen: Screen) => void }) {
  const lists = useLiveQuery(() => getLists(), []);
  const warranties = useLiveQuery(() => getExpiringWarranties(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      await importListFromFile(file);
    } catch {
      await alertDialog({ title: 'Falha ao importar', content: 'O arquivo selecionado não é uma lista válida.' });
    }
  }

  return (
    <div class="screen">
      <header class="appbar">
        <h1>Listas de Compras</h1>
        <button class="icon-btn" aria-label="Buscar" onClick={() => onPush({ type: 'search' })}>
          🔍
        </button>
        <button class="icon-btn" aria-label="Importar lista" onClick={() => fileInputRef.current?.click()}>
          📥
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          class="hidden-file-input"
          onChange={onImportFile}
        />
      </header>
      {warranties !== undefined && warranties.length > 0 && (
        <WarrantyBanner warranties={warranties} />
      )}
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

function WarrantyBanner({ warranties }: { warranties: ExpiringWarranty[] }) {
  const abrir = () =>
    openSheet<void>((close) => (
      <div class="sheet-list">
        <div class="sheet-title">Garantias expirando em breve</div>
        {warranties.map((w) => (
          <div class="list-row" key={w.item.id}>
            <div>
              <div>{w.item.nomeSimplificado}</div>
              <div class="card-subtitle">{w.listaNome}</div>
            </div>
            <span class="card-total">
              {w.diasRestantes <= 0 ? 'hoje' : `${w.diasRestantes}d`}
            </span>
          </div>
        ))}
        <button class="btn-text" onClick={() => close()}>
          Fechar
        </button>
      </div>
    ));

  return (
    <button class="banner banner--warning" onClick={abrir}>
      ⚠️ {warranties.length} garantia{warranties.length > 1 ? 's' : ''} expirando em breve
    </button>
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
