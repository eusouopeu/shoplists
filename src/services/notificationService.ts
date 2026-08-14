import { getExpiringWarranties } from '../db/database';

const STORAGE_KEY = 'shoplist:warranty-notified';

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  return Notification.requestPermission();
}

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // armazenamento indisponível — sem dedupe nesta sessão, não é crítico
  }
}

/** Roda ao abrir o app: notifica (best-effort) garantias que vencem em breve.
 * Sem backend, só dispara enquanto o app está aberto — não há push agendado
 * para quando o app estiver fechado. */
export async function checkExpiringWarranties(withinDays = 3): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;

  const expiring = await getExpiringWarranties(withinDays);
  if (expiring.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const notified = loadNotified();
  let changed = false;

  for (const { item, diasRestantes } of expiring) {
    const key = `${item.id}:${today}`;
    if (notified.has(key)) continue;
    notified.add(key);
    changed = true;
    const dias = diasRestantes <= 0 ? 'hoje' : `em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`;
    new Notification('Garantia expirando', {
      body: `${item.nomeSimplificado} — garantia termina ${dias}`,
      tag: `warranty-${item.id}`,
    });
  }

  if (changed) saveNotified(notified);
}
