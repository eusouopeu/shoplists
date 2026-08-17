export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'shoplist:theme';
const listeners = new Set<(pref: ThemePreference) => void>();
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function getThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // localStorage indisponível — cai para o padrão
  }
  return 'system';
}

function resolvedIsDark(pref: ThemePreference): boolean {
  return pref === 'dark' || (pref === 'system' && (media?.matches ?? false));
}

function applyTheme(pref: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolvedIsDark(pref));
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // sem persistência nesta sessão, não é crítico
  }
  applyTheme(pref);
  for (const l of listeners) l(pref);
}

/** Aplica o tema salvo assim que o app inicia, e mantém o modo "sistema"
 * reativo a mudanças no tema do SO enquanto o app está aberto. */
export function initTheme(): void {
  applyTheme(getThemePreference());
  media?.addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system');
  });
}

export function onThemeChange(listener: (pref: ThemePreference) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
