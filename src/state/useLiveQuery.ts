import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Equivalente aos StreamProviders do Riverpod: reexecuta `querier` sempre
 * que uma tabela Dexie usada dentro dela muda. */
export function useLiveQuery<T>(querier: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    setValue(undefined);
    const subscription = liveQuery(querier).subscribe({
      next: (v) => setValue(v),
      error: (err) => console.error('useLiveQuery error', err),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
