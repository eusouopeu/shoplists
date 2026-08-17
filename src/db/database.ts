import type { FullBackup } from './backupTypes';
import { dexieDb } from './schema';
import type {
  Category,
  ListType,
  ProductLink,
  PurchaseHistoryEntry,
  ShoppingList,
  ShoppingListItem,
  StoreType,
} from './types';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function notFound(entity: string, id: number): never {
  throw new Error(`${entity} ${id} não encontrado(a)`);
}

// ---------------- Categories ----------------

export async function getCategories(): Promise<Category[]> {
  return dexieDb.categories.orderBy('nome').toArray();
}

export async function insertCategory(
  nome: string,
  extra?: { icone?: string | null; cor?: string | null },
): Promise<number> {
  return dexieDb.categories.add({ nome, icone: extra?.icone ?? null, cor: extra?.cor ?? null });
}

export async function updateCategory(
  id: number,
  patch: Partial<Omit<Category, 'id'>>,
): Promise<void> {
  await dexieDb.categories.update(id, patch);
}

export async function deleteCategory(id: number): Promise<void> {
  await dexieDb.categories.delete(id);
}

// ---------------- Shopping lists ----------------

export async function getLists(): Promise<ShoppingList[]> {
  const all = await dexieDb.shoppingLists.toArray();
  return all.sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime());
}

export async function getList(id: number): Promise<ShoppingList> {
  const list = await dexieDb.shoppingLists.get(id);
  return list ?? notFound('Lista', id);
}

export async function insertList(params: {
  nome: string;
  tipo: ListType;
  intervaloDias?: number | null;
  orcamento?: number | null;
}): Promise<number> {
  return dexieDb.shoppingLists.add({
    nome: params.nome,
    tipo: params.tipo,
    intervaloDias: params.intervaloDias ?? null,
    dataUltimaConclusao: null,
    proximaDataRessurgimento: null,
    status: 'ativa',
    dataCriacao: new Date(),
    orcamento: params.orcamento ?? null,
  });
}

export async function renameList(id: number, nome: string): Promise<void> {
  await dexieDb.shoppingLists.update(id, { nome });
}

export async function updateList(
  id: number,
  patch: Partial<Pick<ShoppingList, 'nome' | 'tipo' | 'intervaloDias' | 'orcamento'>>,
): Promise<void> {
  await dexieDb.shoppingLists.update(id, patch);
}

export async function deleteList(id: number): Promise<void> {
  await dexieDb.transaction(
    'rw',
    [dexieDb.shoppingLists, dexieDb.shoppingListItems, dexieDb.productLinks],
    async () => {
      const items = await dexieDb.shoppingListItems.where('listaId').equals(id).toArray();
      const itemIds = items.map((i) => i.id!);
      if (itemIds.length > 0) {
        await dexieDb.productLinks.where('itemId').anyOf(itemIds).delete();
      }
      await dexieDb.shoppingListItems.where('listaId').equals(id).delete();
      await dexieDb.shoppingLists.delete(id);
    },
  );
}

// ---------------- Items ----------------

export async function getItemsForList(listaId: number): Promise<ShoppingListItem[]> {
  return dexieDb.shoppingListItems.where('listaId').equals(listaId).sortBy('ordem');
}

export async function reorderItems(idsEmOrdem: number[]): Promise<void> {
  await dexieDb.shoppingListItems.bulkUpdate(
    idsEmOrdem.map((id, index) => ({ key: id, changes: { ordem: index } })),
  );
}

export async function getItem(id: number): Promise<ShoppingListItem> {
  const item = await dexieDb.shoppingListItems.get(id);
  return item ?? notFound('Item', id);
}

export interface NewItemInput {
  listaId: number;
  nomeSimplificado: string;
  categoriaId?: number | null;
  quantidade?: number;
  unidadesPorItem?: number;
  prazoGarantiaDias?: number | null;
}

export async function insertItem(input: NewItemInput): Promise<number> {
  const existentes = await dexieDb.shoppingListItems.where('listaId').equals(input.listaId).count();
  return dexieDb.shoppingListItems.add({
    listaId: input.listaId,
    nomeSimplificado: input.nomeSimplificado,
    categoriaId: input.categoriaId ?? null,
    quantidade: input.quantidade ?? 1,
    unidadesPorItem: input.unidadesPorItem ?? 1,
    comprado: false,
    dataCompra: null,
    prazoGarantiaDias: input.prazoGarantiaDias ?? null,
    dataFimGarantia: null,
    dataFimArrependimento: null,
    ordem: existentes,
  });
}

export async function updateItemFields(
  id: number,
  patch: Partial<Omit<ShoppingListItem, 'id'>>,
): Promise<void> {
  await dexieDb.shoppingListItems.update(id, patch);
}

export async function deleteItem(id: number): Promise<void> {
  await dexieDb.transaction('rw', [dexieDb.shoppingListItems, dexieDb.productLinks], async () => {
    await dexieDb.productLinks.where('itemId').equals(id).delete();
    await dexieDb.shoppingListItems.delete(id);
  });
}

export async function markItemPurchased(
  itemId: number,
  prazoGarantiaDiasOverride?: number | null,
): Promise<void> {
  const now = new Date();
  const item = await getItem(itemId);
  const prazo = prazoGarantiaDiasOverride ?? item.prazoGarantiaDias ?? null;
  await dexieDb.shoppingListItems.update(itemId, {
    comprado: true,
    dataCompra: now,
    prazoGarantiaDias: prazo,
    dataFimGarantia: prazo != null ? addDays(now, prazo) : null,
    dataFimArrependimento: addDays(now, 7),
  });
  await recordPurchaseHistory(item, now);
}

async function recordPurchaseHistory(item: ShoppingListItem, data: Date): Promise<void> {
  try {
    const preco = await unitPriceForItem({ ...item, comprado: true });
    const lista = await dexieDb.shoppingLists.get(item.listaId);
    await dexieDb.purchaseHistory.add({
      itemNome: item.nomeSimplificado,
      categoriaId: item.categoriaId,
      listaId: item.listaId,
      listaNome: lista?.nome ?? '',
      precoPago: preco,
      quantidade: item.quantidade,
      data,
    });
  } catch (err) {
    console.error('recordPurchaseHistory falhou', err);
  }
}

export async function unmarkItemPurchased(itemId: number): Promise<void> {
  await dexieDb.shoppingListItems.update(itemId, {
    comprado: false,
    dataCompra: null,
    dataFimGarantia: null,
    dataFimArrependimento: null,
  });
}

/** Marca todos os itens pendentes da lista como comprados. Se a lista for
 * periódica, agenda o próximo ressurgimento; caso contrário, conclui. */
export async function markListPurchased(listId: number): Promise<void> {
  const pendentes = (await dexieDb.shoppingListItems.where('listaId').equals(listId).toArray()).filter(
    (i) => !i.comprado,
  );
  for (const item of pendentes) {
    await markItemPurchased(item.id!);
  }

  const list = await getList(listId);
  if (list.tipo === 'periodica' && list.intervaloDias != null) {
    const now = new Date();
    const proxima = addDays(now, list.intervaloDias);
    await dexieDb.shoppingLists.update(listId, {
      dataUltimaConclusao: now,
      proximaDataRessurgimento: proxima,
      status: 'aguardandoRessurgir',
    });
  } else {
    await dexieDb.shoppingLists.update(listId, { status: 'concluida' });
  }
}

/** Roda ao abrir o app: reativa listas periódicas cujo prazo já venceu,
 * preservando o histórico da execução anterior (os itens ficam com
 * comprado=false para a nova rodada, mas a compra antiga já foi
 * persistida nos campos de data_compra/garantia daquele ciclo). */
export async function checkPeriodicListsResurgence(): Promise<void> {
  const now = new Date();
  const candidatas = (
    await dexieDb.shoppingLists.where('status').equals('aguardandoRessurgir').toArray()
  ).filter((l) => l.proximaDataRessurgimento != null && l.proximaDataRessurgimento <= now);

  for (const list of candidatas) {
    await dexieDb.shoppingLists.update(list.id!, { status: 'ativa' });
    const items = await dexieDb.shoppingListItems.where('listaId').equals(list.id!).toArray();
    await dexieDb.shoppingListItems.bulkUpdate(
      items.map((i) => ({ key: i.id!, changes: { comprado: false, dataCompra: null } })),
    );
  }
}

// ---------------- Product links ----------------

export async function getLinksForItem(itemId: number): Promise<ProductLink[]> {
  return dexieDb.productLinks.where('itemId').equals(itemId).sortBy('id');
}

export interface NewLinkInput {
  itemId: number;
  url: string;
  loja: StoreType;
  imagemUrl?: string | null;
  preco?: number | null;
  escolhido?: boolean;
}

export async function insertLink(input: NewLinkInput): Promise<number> {
  return dexieDb.productLinks.add({
    itemId: input.itemId,
    url: input.url,
    loja: input.loja,
    imagemUrl: input.imagemUrl ?? null,
    preco: input.preco ?? null,
    precoAtualizadoEm: null,
    escolhido: input.escolhido ?? false,
  });
}

export async function updateLink(id: number, patch: Partial<Omit<ProductLink, 'id'>>): Promise<void> {
  await dexieDb.productLinks.update(id, patch);
}

export async function deleteLink(id: number): Promise<void> {
  await dexieDb.productLinks.delete(id);
}

/** Marca `linkId` como o link escolhido/comprado do item, desmarcando
 * qualquer outro link do mesmo item. */
export async function chooseLink(itemId: number, linkId: number): Promise<void> {
  await dexieDb.transaction('rw', dexieDb.productLinks, async () => {
    const links = await dexieDb.productLinks.where('itemId').equals(itemId).toArray();
    await dexieDb.productLinks.bulkUpdate(
      links.map((l) => ({ key: l.id!, changes: { escolhido: l.id === linkId } })),
    );
  });
}

// ---------------- Cálculos agregados ----------------

export async function unitPriceForItem(item: ShoppingListItem): Promise<number | null> {
  const links = await getLinksForItem(item.id!);
  if (links.length === 0) return null;
  if (item.comprado) {
    const chosen = links.find((l) => l.escolhido);
    return chosen?.preco ?? null;
  }
  const prices = links.map((l) => l.preco).filter((p): p is number => p != null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/** Preço total da lista: soma, por item, do preço do link escolhido
 * (se já comprado) ou do menor preço entre os links disponíveis
 * (se ainda pendente), multiplicado pela quantidade do item. */
export async function totalPriceForList(listId: number): Promise<number> {
  const items = await dexieDb.shoppingListItems.where('listaId').equals(listId).toArray();
  let total = 0;
  for (const item of items) {
    const unit = await unitPriceForItem(item);
    if (unit != null) total += unit * item.quantidade;
  }
  return total;
}

// ---------------- Histórico de compras ----------------

export async function getPurchaseHistory(): Promise<PurchaseHistoryEntry[]> {
  const all = await dexieDb.purchaseHistory.toArray();
  return all.sort((a, b) => b.data.getTime() - a.data.getTime());
}

export async function getPriceHistoryForItemName(itemNome: string): Promise<PurchaseHistoryEntry[]> {
  const entries = await dexieDb.purchaseHistory.where('itemNome').equals(itemNome).toArray();
  return entries.sort((a, b) => a.data.getTime() - b.data.getTime());
}

export interface FrequentItem {
  nome: string;
  categoriaId: number | null;
  vezes: number;
}

/** Nomes de itens mais comprados no histórico, para sugestão em listas
 * vazias (mais recente prevalece na categoria em caso de repetição). */
export async function getFrequentItemNames(limit = 8): Promise<FrequentItem[]> {
  const all = await dexieDb.purchaseHistory.orderBy('data').reverse().toArray();
  const byName = new Map<string, FrequentItem>();
  for (const entry of all) {
    const existing = byName.get(entry.itemNome);
    if (existing) {
      existing.vezes += 1;
    } else {
      byName.set(entry.itemNome, { nome: entry.itemNome, categoriaId: entry.categoriaId, vezes: 1 });
    }
  }
  return Array.from(byName.values())
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, limit);
}

export interface RecurringSuggestion {
  nome: string;
  categoriaId: number | null;
  vezes: number;
  ultimaCompra: Date;
  intervaloMedioDias: number;
  diasDesdeUltimaCompra: number;
}

/** Itens com >=2 compras no histórico cujo intervalo médio entre compras já
 * foi ultrapassado desde a última vez, ordenados pelos mais atrasados.
 * Exclui nomes que já estão pendentes (não comprados) em alguma lista ativa. */
export async function getRecurringItemSuggestions(limit = 6): Promise<RecurringSuggestion[]> {
  const all = await dexieDb.purchaseHistory.orderBy('data').toArray();
  const byName = new Map<string, PurchaseHistoryEntry[]>();
  for (const entry of all) {
    const bucket = byName.get(entry.itemNome) ?? [];
    bucket.push(entry);
    byName.set(entry.itemNome, bucket);
  }

  const pendentes = await dexieDb.shoppingListItems.filter((i) => !i.comprado).toArray();
  const nomesPendentes = new Set(pendentes.map((i) => i.nomeSimplificado));

  const now = new Date();
  const candidatas: RecurringSuggestion[] = [];
  for (const [nome, entries] of byName) {
    if (entries.length < 2 || nomesPendentes.has(nome)) continue;
    const intervalos: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      intervalos.push((entries[i].data.getTime() - entries[i - 1].data.getTime()) / 86_400_000);
    }
    const intervaloMedioDias = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const ultima = entries[entries.length - 1];
    const diasDesdeUltimaCompra = (now.getTime() - ultima.data.getTime()) / 86_400_000;
    if (diasDesdeUltimaCompra < intervaloMedioDias) continue;
    candidatas.push({
      nome,
      categoriaId: ultima.categoriaId,
      vezes: entries.length,
      ultimaCompra: ultima.data,
      intervaloMedioDias,
      diasDesdeUltimaCompra,
    });
  }

  return candidatas
    .sort((a, b) => b.diasDesdeUltimaCompra - b.intervaloMedioDias - (a.diasDesdeUltimaCompra - a.intervaloMedioDias))
    .slice(0, limit);
}

// ---------------- Garantias ----------------

export interface ExpiringWarranty {
  item: ShoppingListItem;
  listaNome: string;
  diasRestantes: number;
}

export async function getExpiringWarranties(withinDays = 3): Promise<ExpiringWarranty[]> {
  const now = new Date();
  const limite = addDays(now, withinDays);
  const items = await dexieDb.shoppingListItems
    .filter((i) => i.comprado && i.dataFimGarantia != null && i.dataFimGarantia >= now && i.dataFimGarantia <= limite)
    .toArray();

  const result: ExpiringWarranty[] = [];
  for (const item of items) {
    const lista = await dexieDb.shoppingLists.get(item.listaId);
    const diasRestantes = Math.ceil((item.dataFimGarantia!.getTime() - now.getTime()) / 86_400_000);
    result.push({ item, listaNome: lista?.nome ?? '', diasRestantes });
  }
  return result.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

// ---------------- Relatório de gastos ----------------

export interface CategorySpending {
  categoriaId: number | null;
  categoriaNome: string;
  total: number;
  vezes: number;
}

export interface SpendingReport {
  inicio: Date;
  fim: Date;
  total: number;
  porCategoria: CategorySpending[];
  entradas: PurchaseHistoryEntry[];
}

/** Agrega o histórico de compras (precoPago * quantidade) por categoria
 * dentro do período [inicio, fim], para relatórios de gastos. */
export async function getSpendingReport(inicio: Date, fim: Date): Promise<SpendingReport> {
  const [entradas, categorias] = await Promise.all([
    dexieDb.purchaseHistory.where('data').between(inicio, fim, true, true).toArray(),
    dexieDb.categories.toArray(),
  ]);
  const nomeById = new Map(categorias.map((c) => [c.id, c.nome]));

  const porCategoriaMap = new Map<number | null, CategorySpending>();
  let total = 0;
  for (const entrada of entradas) {
    if (entrada.precoPago == null) continue;
    const valor = entrada.precoPago * entrada.quantidade;
    total += valor;
    const key = entrada.categoriaId;
    const existing = porCategoriaMap.get(key);
    if (existing) {
      existing.total += valor;
      existing.vezes += 1;
    } else {
      porCategoriaMap.set(key, {
        categoriaId: key,
        categoriaNome: key != null ? (nomeById.get(key) ?? 'Sem categoria') : 'Sem categoria',
        total: valor,
        vezes: 1,
      });
    }
  }

  const porCategoria = Array.from(porCategoriaMap.values()).sort((a, b) => b.total - a.total);
  return { inicio, fim, total, porCategoria, entradas };
}

// ---------------- Busca global ----------------

export interface SearchResults {
  lists: ShoppingList[];
  items: (ShoppingListItem & { listaNome: string })[];
}

export async function searchAll(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (!q) return { lists: [], items: [] };

  const [lists, items] = await Promise.all([
    dexieDb.shoppingLists.toArray(),
    dexieDb.shoppingListItems.toArray(),
  ]);

  const matchedLists = lists.filter((l) => l.nome.toLowerCase().includes(q));
  const listNameById = new Map(lists.map((l) => [l.id, l.nome]));
  const matchedItems = items
    .filter((i) => i.nomeSimplificado.toLowerCase().includes(q))
    .map((i) => ({ ...i, listaNome: listNameById.get(i.listaId) ?? '' }));

  return { lists: matchedLists, items: matchedItems };
}

// ---------------- Backup / exportação ----------------

export type { FullBackup } from './backupTypes';

export async function getFullBackup(): Promise<FullBackup> {
  const [categories, shoppingLists, shoppingListItems, productLinks, purchaseHistory] = await Promise.all([
    dexieDb.categories.toArray(),
    dexieDb.shoppingLists.toArray(),
    dexieDb.shoppingListItems.toArray(),
    dexieDb.productLinks.toArray(),
    dexieDb.purchaseHistory.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    shoppingLists,
    shoppingListItems,
    productLinks,
    purchaseHistory,
  };
}

/** Substitui todo o conteúdo do banco pelo backup informado, preservando os IDs originais. */
export async function restoreFullBackup(backup: FullBackup): Promise<void> {
  await dexieDb.transaction(
    'rw',
    [dexieDb.categories, dexieDb.shoppingLists, dexieDb.shoppingListItems, dexieDb.productLinks, dexieDb.purchaseHistory],
    async () => {
      await Promise.all([
        dexieDb.categories.clear(),
        dexieDb.shoppingLists.clear(),
        dexieDb.shoppingListItems.clear(),
        dexieDb.productLinks.clear(),
        dexieDb.purchaseHistory.clear(),
      ]);
      await dexieDb.categories.bulkAdd(backup.categories);
      await dexieDb.shoppingLists.bulkAdd(backup.shoppingLists);
      await dexieDb.shoppingListItems.bulkAdd(backup.shoppingListItems);
      await dexieDb.productLinks.bulkAdd(backup.productLinks);
      await dexieDb.purchaseHistory.bulkAdd(backup.purchaseHistory ?? []);
    },
  );
}

export interface ListExport {
  version: 1;
  list: Omit<ShoppingList, 'id'>;
  items: (Omit<ShoppingListItem, 'id' | 'listaId'> & { links: Omit<ProductLink, 'id' | 'itemId'>[] })[];
}

export async function getListExport(listId: number): Promise<ListExport> {
  const list = await getList(listId);
  const items = await getItemsForList(listId);
  const itemsWithLinks = await Promise.all(
    items.map(async (item) => {
      const links = await getLinksForItem(item.id!);
      const { id: _id, listaId: _listaId, ...itemRest } = item;
      return {
        ...itemRest,
        links: links.map(({ id: _linkId, itemId: _itemId, ...linkRest }) => linkRest),
      };
    }),
  );
  const { id: _id, ...listRest } = list;
  return { version: 1, list: listRest, items: itemsWithLinks };
}

/** Importa uma lista exportada como uma lista nova (IDs novos), sem tocar no restante do banco. */
export async function importListExport(data: ListExport): Promise<number> {
  return dexieDb.transaction(
    'rw',
    [dexieDb.shoppingLists, dexieDb.shoppingListItems, dexieDb.productLinks],
    async () => {
      const listId = await dexieDb.shoppingLists.add({
        ...data.list,
        status: 'ativa',
        dataCriacao: new Date(),
      });
      for (let i = 0; i < data.items.length; i++) {
        const { links, ...itemRest } = data.items[i];
        const itemId = await dexieDb.shoppingListItems.add({
          ...itemRest,
          listaId: listId,
          ordem: i,
        });
        for (const link of links) {
          await dexieDb.productLinks.add({ ...link, itemId });
        }
      }
      return listId;
    },
  );
}

// ---------------- Backup automático incremental ----------------

const MAX_AUTO_SNAPSHOTS = 5;

export interface BackupSnapshotSummary {
  id: number;
  createdAt: Date;
}

/** Tira um snapshot completo do banco e mantém só os `MAX_AUTO_SNAPSHOTS`
 * mais recentes — funciona como um backup incremental automático (sem o
 * usuário precisar lembrar de exportar manualmente). */
export async function createAutoBackupSnapshot(): Promise<void> {
  const data = await getFullBackup();
  await dexieDb.backupSnapshots.add({ createdAt: new Date(), data });

  const all = await dexieDb.backupSnapshots.orderBy('createdAt').toArray();
  const excedentes = all.slice(0, Math.max(0, all.length - MAX_AUTO_SNAPSHOTS));
  if (excedentes.length > 0) {
    await dexieDb.backupSnapshots.bulkDelete(excedentes.map((s) => s.id));
  }
}

export async function getLatestSnapshotDate(): Promise<Date | null> {
  const latest = await dexieDb.backupSnapshots.orderBy('createdAt').last();
  return latest?.createdAt ?? null;
}

export async function listBackupSnapshots(): Promise<BackupSnapshotSummary[]> {
  const all = await dexieDb.backupSnapshots.orderBy('createdAt').reverse().toArray();
  return all.map((s) => ({ id: s.id, createdAt: s.createdAt }));
}

export async function restoreBackupSnapshot(id: number): Promise<void> {
  const snapshot = await dexieDb.backupSnapshots.get(id);
  if (!snapshot) throw new Error(`Snapshot ${id} não encontrado`);
  await restoreFullBackup(snapshot.data);
}
