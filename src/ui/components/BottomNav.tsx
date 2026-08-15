import type { Tab } from '../types';

const DESTINATIONS: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'lists', label: 'Listas', icon: '📋' },
  { tab: 'history', label: 'Histórico', icon: '🕘' },
  { tab: 'reports', label: 'Relatórios', icon: '📊' },
  { tab: 'settings', label: 'Configurações', icon: '⚙️' },
];

export function BottomNav({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav class="bottom-nav">
      {DESTINATIONS.map((d) => (
        <button
          key={d.tab}
          class={d.tab === active ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'}
          onClick={() => onSelect(d.tab)}
        >
          <span class="bottom-nav-icon">{d.icon}</span>
          <span class="bottom-nav-label">{d.label}</span>
        </button>
      ))}
    </nav>
  );
}
