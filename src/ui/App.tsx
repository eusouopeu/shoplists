import { useEffect, useState } from 'preact/hooks';
import { checkPeriodicListsResurgence, getLists } from '../db/database';
import { consumeSharedUrl } from '../services/shareTarget';
import { alertDialog } from './components/ConfirmDialog';
import { BottomNav } from './components/BottomNav';
import { pickOne } from './components/PickerSheet';
import { OverlayHost } from './overlay';
import { HistoryScreen } from './screens/HistoryScreen';
import { ItemFormScreen } from './screens/ItemFormScreen';
import { ListDetailScreen } from './screens/ListDetailScreen';
import { ListsScreen } from './screens/ListsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Screen, Tab } from './types';

export function App() {
  const [tab, setTab] = useState<Tab>('lists');
  const [stack, setStack] = useState<Screen[]>([]);

  useEffect(() => {
    void checkPeriodicListsResurgence();
    void handleSharedUrlOnLoad();
  }, []);

  async function handleSharedUrlOnLoad() {
    const url = consumeSharedUrl();
    if (!url) return;

    const lists = await getLists();
    if (lists.length === 0) {
      await alertDialog({ content: 'Crie uma lista antes de importar um link.' });
      return;
    }

    const chosenId = await pickOne({
      title: 'Adicionar link a qual lista?',
      options: lists.map((l) => ({ value: l.id!, label: l.nome })),
    });
    if (chosenId == null) return;

    setStack((prev) => [...prev, { type: 'itemForm', listId: chosenId, prefillUrl: url }]);
  }

  const push = (screen: Screen) => setStack((prev) => [...prev, screen]);
  const pop = () => setStack((prev) => prev.slice(0, -1));

  const top = stack[stack.length - 1];

  return (
    <div class="app-root">
      {top ? (
        <PushedScreen screen={top} onBack={pop} onPush={push} />
      ) : (
        <>
          <div class="tab-content">
            {tab === 'lists' && <ListsScreen onPush={push} />}
            {tab === 'history' && <HistoryScreen />}
            {tab === 'settings' && <SettingsScreen />}
          </div>
          <BottomNav active={tab} onSelect={setTab} />
        </>
      )}
      <OverlayHost />
    </div>
  );
}

function PushedScreen({
  screen,
  onBack,
  onPush,
}: {
  screen: Screen;
  onBack: () => void;
  onPush: (screen: Screen) => void;
}) {
  if (screen.type === 'listDetail') {
    return <ListDetailScreen listId={screen.listId} onBack={onBack} onPush={onPush} />;
  }
  return (
    <ItemFormScreen listId={screen.listId} itemId={screen.itemId} prefillUrl={screen.prefillUrl} onBack={onBack} />
  );
}
