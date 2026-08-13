import { dexieDb } from './schema';
import type {
  Category,
  ListType,
  ProductLink,
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

export async function insertCategory(nome: string): Promise<number> {
  return dexieDb.categories.add({ nome });
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
}): Promise<number> {
  return dexieDb.shoppingLists.add({
    nome: params.nome,
    tipo: params.tipo,
    intervaloDias: params.intervaloDias ?? null,
    dataUltimaConclusao: null,
    proximaDataRessurgimento: null,
    status: 'ativa',
    dataCriacao: new Date(),
  });
}

export async function renameList(id: number, nome: string): Promise<void> {
  await dexieDb.shoppingLists.update(id, { nome });
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
  return dexieDb.shoppingListItems.where('listaId').equals(listaId).sortBy('id');
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
