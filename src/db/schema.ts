import Dexie, { type EntityTable } from 'dexie';
import type { Category, ProductLink, PurchaseHistoryEntry, ShoppingList, ShoppingListItem } from './types';

const DEFAULT_CATEGORY_SEEDS = [
  'Roupas',
  'Eletrônicos',
  'Casa',
  'Alimentos',
  'Higiene e Beleza',
  'Outros',
];

class ShoplistDexie extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  shoppingLists!: EntityTable<ShoppingList, 'id'>;
  shoppingListItems!: EntityTable<ShoppingListItem, 'id'>;
  productLinks!: EntityTable<ProductLink, 'id'>;
  purchaseHistory!: EntityTable<PurchaseHistoryEntry, 'id'>;

  constructor() {
    super('shoplist');
    this.version(1).stores({
      categories: '++id, nome',
      shoppingLists: '++id, status, dataCriacao',
      shoppingListItems: '++id, listaId, categoriaId',
      productLinks: '++id, itemId',
    });

    this.version(2)
      .stores({
        categories: '++id, nome',
        shoppingLists: '++id, status, dataCriacao',
        shoppingListItems: '++id, listaId, categoriaId, ordem',
        productLinks: '++id, itemId',
        purchaseHistory: '++id, itemNome, listaId, data',
      })
      .upgrade(async (tx) => {
        await tx
          .table('categories')
          .toCollection()
          .modify((c) => {
            c.icone = c.icone ?? null;
            c.cor = c.cor ?? null;
          });
        await tx
          .table('shoppingLists')
          .toCollection()
          .modify((l) => {
            l.orcamento = l.orcamento ?? null;
          });

        const items = await tx.table('shoppingListItems').toArray();
        const byList = new Map<number, typeof items>();
        for (const item of items) {
          const bucket = byList.get(item.listaId) ?? [];
          bucket.push(item);
          byList.set(item.listaId, bucket);
        }
        for (const bucket of byList.values()) {
          bucket.sort((a, b) => a.id - b.id);
          for (let i = 0; i < bucket.length; i++) {
            await tx.table('shoppingListItems').update(bucket[i].id, { ordem: i });
          }
        }
      });

    this.on('populate', async () => {
      await this.categories.bulkAdd(
        DEFAULT_CATEGORY_SEEDS.map((nome) => ({ nome, icone: null, cor: null })),
      );
    });
  }
}

export const dexieDb = new ShoplistDexie();
