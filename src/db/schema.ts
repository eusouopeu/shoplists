import Dexie, { type EntityTable } from 'dexie';
import type { Category, ProductLink, ShoppingList, ShoppingListItem } from './types';

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

  constructor() {
    super('shoplist');
    this.version(1).stores({
      categories: '++id, nome',
      shoppingLists: '++id, status, dataCriacao',
      shoppingListItems: '++id, listaId, categoriaId',
      productLinks: '++id, itemId',
    });

    this.on('populate', async () => {
      await this.categories.bulkAdd(DEFAULT_CATEGORY_SEEDS.map((nome) => ({ nome })));
    });
  }
}

export const dexieDb = new ShoplistDexie();
