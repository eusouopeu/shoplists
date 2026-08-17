import { getExpiringWarranties } from '../db/database';

const STORAGE_KEY = 'shoplist:warranty-notified';
const BUDGET_STORAGE_KEY = 'shoplist:budget-notified';
const BUDGET_THRESHOLDS = [0.8, 1] as const;

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

function loadNotifiedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // armazenamento indisponível — sem dedupe nesta sessão, não é crítico
  }
}

function loadNotified(): Set<string> {
  return loadNotifiedSet(STORAGE_KEY);
}

function saveNotified(set: Set<string>): void {
  saveNotifiedSet(STORAGE_KEY, set);
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

/** Roda sempre que o total de uma lista com orçamento definido muda:
 * notifica (best-effort, dedupe por lista+limiar) ao cruzar 80% e 100% do
 * orçamento, em vez de só avisar depois que já passou do limite. */
export async function checkBudgetAlert(
  listId: number,
  listNome: string,
  total: number,
  orcamento: number,
): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  if (orcamento <= 0) return;

  const pct = total / orcamento;
  const notified = loadNotifiedSet(BUDGET_STORAGE_KEY);
  let changed = false;

  for (const threshold of BUDGET_THRESHOLDS) {
    const key = `${listId}:${threshold}`;
    if (pct < threshold) {
      // caiu abaixo do limiar de novo (ex.: item removido) — permite reavisar se voltar a cruzar
      if (notified.delete(key)) changed = true;
      continue;
    }
    if (notified.has(key)) continue;
    notified.add(key);
    changed = true;
    const label = threshold >= 1 ? 'Orçamento estourado' : `Orçamento em ${Math.round(threshold * 100)}%`;
    new Notification(label, {
      body: `${listNome}: R$ ${total.toFixed(2)} de R$ ${orcamento.toFixed(2)}`,
      tag: `budget-${listId}-${threshold}`,
    });
  }

  if (changed) saveNotifiedSet(BUDGET_STORAGE_KEY, notified);
}
