import { getFullBackup, getListExport, importListExport, restoreFullBackup } from '../db/database';
import type { FullBackup, ListExport } from '../db/database';

const DATE_FIELDS_LIST = ['dataCriacao', 'dataUltimaConclusao', 'proximaDataRessurgimento'];
const DATE_FIELDS_ITEM = ['dataCompra', 'dataFimGarantia', 'dataFimArrependimento'];
const DATE_FIELDS_HISTORY = ['data'];

function reviveDates<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string') (obj as Record<string, unknown>)[field] = new Date(value);
  }
  return obj;
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function slug(nome: string): string {
  const cleaned = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned || 'lista';
}

export async function exportFullBackup(): Promise<void> {
  const backup = await getFullBackup();
  downloadJson(`shoplist-backup-${dateStamp()}.json`, backup);
}

export async function importFullBackup(file: File): Promise<void> {
  const text = await readFileAsText(file);
  const raw = JSON.parse(text) as FullBackup;
  const revived: FullBackup = {
    ...raw,
    shoppingLists: raw.shoppingLists.map((l) => reviveDates({ ...l }, DATE_FIELDS_LIST)),
    shoppingListItems: raw.shoppingListItems.map((i) => reviveDates({ ...i }, DATE_FIELDS_ITEM)),
    purchaseHistory: (raw.purchaseHistory ?? []).map((h) => reviveDates({ ...h }, DATE_FIELDS_HISTORY)),
  };
  await restoreFullBackup(revived);
}

/** Exporta uma lista específica: tenta Web Share (arquivo) e cai para
 * download local se o navegador não suportar compartilhamento de arquivos. */
export async function exportListShare(listId: number, listNome: string): Promise<void> {
  const data = await getListExport(listId);
  const json = JSON.stringify(data, null, 2);
  const filename = `lista-${slug(listNome)}.json`;
  const file = new File([json], filename, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: `Lista: ${listNome}` });
      return;
    } catch {
      // usuário cancelou ou o share falhou — cai para download local
    }
  }
  downloadJson(filename, data);
}

export async function importListFromFile(file: File): Promise<number> {
  const text = await readFileAsText(file);
  const raw = JSON.parse(text) as ListExport;
  const list = reviveDates({ ...raw.list }, DATE_FIELDS_LIST);
  const items = raw.items.map((item) => reviveDates({ ...item }, DATE_FIELDS_ITEM));
  return importListExport({ ...raw, list, items });
}
