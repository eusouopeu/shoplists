import { useState } from 'preact/hooks';
import { searchAll } from '../../db/database';
import type { SearchResults } from '../../db/database';
import { useLiveQuery } from '../../state/useLiveQuery';
import type { Screen } from '../types';

export function SearchScreen({ onBack, onPush }: { onBack: () => void; onPush: (screen: Screen) => void }) {
  const [query, setQuery] = useState('');
  const results = useLiveQuery(() => searchAll(query), [query]);

  return (
    <div class="screen">
      <header class="appbar">
        <button class="icon-btn appbar-back" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <input
          autoFocus
          class="search-input"
          placeholder="Buscar listas e itens…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </header>
      <div class="screen-body">
        {query.trim() === '' ? (
          <div class="centered muted">Digite para buscar em todas as listas e itens.</div>
        ) : results === undefined ? (
          <div class="centered">Carregando…</div>
        ) : (
          <SearchResultsBody results={results} onPush={onPush} />
        )}
      </div>
    </div>
  );
}

function SearchResultsBody({ results, onPush }: { results: SearchResults; onPush: (screen: Screen) => void }) {
  if (results.lists.length === 0 && results.items.length === 0) {
    return <div class="centered muted">Nenhum resultado encontrado.</div>;
  }

  return (
    <>
      {results.lists.length > 0 && (
        <>
          <div class="section-label">Listas</div>
          {results.lists.map((l) => (
            <div
              class="list-row"
              key={l.id}
              role="button"
              tabIndex={0}
              onClick={() => onPush({ type: 'listDetail', listId: l.id! })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPush({ type: 'listDetail', listId: l.id! });
              }}
            >
              <span>{l.nome}</span>
            </div>
          ))}
        </>
      )}
      {results.items.length > 0 && (
        <>
          <div class="section-label">Itens</div>
          {results.items.map((i) => (
            <div
              class="list-row"
              key={i.id}
              role="button"
              tabIndex={0}
              onClick={() => onPush({ type: 'listDetail', listId: i.listaId })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPush({ type: 'listDetail', listId: i.listaId });
              }}
            >
              <div>
                <div>{i.nomeSimplificado}</div>
                <div class="card-subtitle">{i.listaNome}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
