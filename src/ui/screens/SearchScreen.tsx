import { useState } from 'preact/hooks';
import { searchAll } from '../../db/database';
import type { SearchResults } from '../../db/database';
import { useLiveQuery } from '../../state/useLiveQuery';
import { IconArrowLeft } from '../icons';
import { AppBar, Centered, IconButton, ListRow, ScreenBody, SectionLabel, Screen } from '../kit';
import type { Screen as AppScreen } from '../types';

export function SearchScreen({ onBack, onPush }: { onBack: () => void; onPush: (screen: AppScreen) => void }) {
  const [query, setQuery] = useState('');
  const results = useLiveQuery(() => searchAll(query), [query]);

  return (
    <Screen>
      <AppBar>
        <IconButton label="Voltar" variant="header" onClick={onBack}>
          <IconArrowLeft size={22} />
        </IconButton>
        <input
          autoFocus
          class="flex-1 rounded-lg bg-white/15 px-3 py-2 text-white placeholder-white/75 focus:outline-none focus:ring-2 focus:ring-white/40"
          placeholder="Buscar listas e itens…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </AppBar>
      <ScreenBody>
        {query.trim() === '' ? (
          <Centered muted>Digite para buscar em todas as listas e itens.</Centered>
        ) : results === undefined ? (
          <Centered>Carregando…</Centered>
        ) : (
          <SearchResultsBody results={results} onPush={onPush} />
        )}
      </ScreenBody>
    </Screen>
  );
}

function SearchResultsBody({ results, onPush }: { results: SearchResults; onPush: (screen: AppScreen) => void }) {
  if (results.lists.length === 0 && results.items.length === 0) {
    return <Centered muted>Nenhum resultado encontrado.</Centered>;
  }

  return (
    <>
      {results.lists.length > 0 && (
        <>
          <SectionLabel>Listas</SectionLabel>
          {results.lists.map((l) => (
            <ListRow key={l.id} onClick={() => onPush({ type: 'listDetail', listId: l.id! })}>
              <span>{l.nome}</span>
            </ListRow>
          ))}
        </>
      )}
      {results.items.length > 0 && (
        <>
          <SectionLabel>Itens</SectionLabel>
          {results.items.map((i) => (
            <ListRow key={i.id} onClick={() => onPush({ type: 'listDetail', listId: i.listaId })}>
              <div>
                <div>{i.nomeSimplificado}</div>
                <div class="mt-0.5 text-[0.85rem] text-text-muted">{i.listaNome}</div>
              </div>
            </ListRow>
          ))}
        </>
      )}
    </>
  );
}
