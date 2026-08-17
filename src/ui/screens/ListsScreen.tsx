import { useRef } from 'preact/hooks';
import { deleteList, getExpiringWarranties, getLists, totalPriceForList } from '../../db/database';
import type { ExpiringWarranty } from '../../db/database';
import type { ShoppingList } from '../../db/types';
import { listStatusLabel, listTypeLabel } from '../../domain/labels';
import { importListFromFile } from '../../services/backupService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { alertDialog, confirmDialog } from '../components/ConfirmDialog';
import { openListFormSheet } from '../components/ListFormSheet';
import { IconDownloadTray, IconPlus, IconSearch, IconTrash, IconWarning } from '../icons';
import { AppBar, AppBarTitle, Card, Centered, Fab, IconButton, ScreenBody, SectionLabel, Screen, TextButton } from '../kit';
import { openSheet } from '../overlay';
import type { Screen as AppScreen } from '../types';

export function ListsScreen({ onPush }: { onPush: (screen: AppScreen) => void }) {
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
    <Screen>
      <AppBar>
        <AppBarTitle>Listas de Compras</AppBarTitle>
        <IconButton label="Buscar" variant="header" onClick={() => onPush({ type: 'search' })}>
          <IconSearch size={22} />
        </IconButton>
        <IconButton label="Importar lista" variant="header" onClick={() => fileInputRef.current?.click()}>
          <IconDownloadTray size={22} />
        </IconButton>
        <input ref={fileInputRef} type="file" accept="application/json" class="hidden" onChange={onImportFile} />
      </AppBar>
      {warranties !== undefined && warranties.length > 0 && <WarrantyBanner warranties={warranties} />}
      <ScreenBody>
        {lists === undefined ? (
          <Centered>Carregando…</Centered>
        ) : lists.length === 0 ? (
          <Centered muted>Nenhuma lista ainda. Toque em + para criar.</Centered>
        ) : (
          <ListsBody lists={lists} onPush={onPush} />
        )}
      </ScreenBody>
      <Fab label="Nova lista" onClick={() => openListFormSheet()}>
        <IconPlus size={26} />
      </Fab>
    </Screen>
  );
}

function WarrantyBanner({ warranties }: { warranties: ExpiringWarranty[] }) {
  const abrir = () =>
    openSheet<void>((close) => (
      <div class="py-3 pb-5">
        <div class="px-5 py-3 font-bold">Garantias expirando em breve</div>
        {warranties.map((w) => (
          <div class="flex items-center justify-between gap-2.5 border-b border-border px-5 py-3" key={w.item.id}>
            <div>
              <div>{w.item.nomeSimplificado}</div>
              <div class="mt-0.5 text-[0.85rem] text-text-muted">{w.listaNome}</div>
            </div>
            <span class="whitespace-nowrap font-semibold">{w.diasRestantes <= 0 ? 'hoje' : `${w.diasRestantes}d`}</span>
          </div>
        ))}
        <div class="px-5 pt-2">
          <TextButton onClick={() => close()}>Fechar</TextButton>
        </div>
      </div>
    ));

  return (
    <button
      class="flex w-full items-center gap-2 bg-amber-100 px-4 py-2.5 text-left text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      onClick={abrir}
    >
      <IconWarning size={18} />
      {warranties.length} garantia{warranties.length > 1 ? 's' : ''} expirando em breve
    </button>
  );
}

function ListsBody({ lists, onPush }: { lists: ShoppingList[]; onPush: (screen: AppScreen) => void }) {
  const aguardando = lists.filter((l) => l.status === 'aguardandoRessurgir');
  const outras = lists.filter((l) => l.status !== 'aguardandoRessurgir');

  return (
    <div class="flex flex-col">
      {aguardando.length > 0 && (
        <>
          <SectionLabel>Prontas para ressurgir</SectionLabel>
          {aguardando.map((l) => (
            <ListCard key={l.id} list={l} destacada onPush={onPush} />
          ))}
          <hr class="my-4 border-border" />
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
  onPush: (screen: AppScreen) => void;
}) {
  const total = useLiveQuery(() => totalPriceForList(list.id!), [list.id]);

  const subtitleParts = [listTypeLabel(list.tipo), listStatusLabel(list.status)];
  if (list.tipo === 'periodica' && list.intervaloDias != null) {
    subtitleParts.push(`a cada ${list.intervaloDias} dias`);
  }

  const excluir = async (e: MouseEvent) => {
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
    <Card highlight={destacada} onClick={abrir}>
      <div class="min-w-0 flex-1">
        <div class="font-semibold">{list.nome}</div>
        <div class="mt-0.5 text-[0.85rem] text-text-muted">{subtitleParts.join(' • ')}</div>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="whitespace-nowrap font-bold text-danger">{total !== undefined ? `R$ ${total.toFixed(2)}` : '…'}</span>
        <IconButton label="Excluir lista" onClick={excluir}>
          <IconTrash size={18} />
        </IconButton>
      </div>
    </Card>
  );
}
