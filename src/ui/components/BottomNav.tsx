import { IconChartBar, IconClock, IconCog, IconList } from '../icons';
import type { Tab } from '../types';

const DESTINATIONS: { tab: Tab; label: string; Icon: typeof IconList }[] = [
  { tab: 'lists', label: 'Listas', Icon: IconList },
  { tab: 'history', label: 'Histórico', Icon: IconClock },
  { tab: 'reports', label: 'Relatórios', Icon: IconChartBar },
  { tab: 'settings', label: 'Configurações', Icon: IconCog },
];

export function BottomNav({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav class="flex shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {DESTINATIONS.map((d) => (
        <button
          key={d.tab}
          title={d.label}
          aria-label={d.label}
          aria-current={d.tab === active ? 'page' : undefined}
          class={`flex flex-1 flex-col items-center gap-0.5 py-2.5 ${
            d.tab === active ? 'font-semibold text-header' : 'text-text-muted'
          }`}
          onClick={() => onSelect(d.tab)}
        >
          <d.Icon size={22} />
          <span class="text-[0.72rem]">{d.label}</span>
        </button>
      ))}
    </nav>
  );
}
