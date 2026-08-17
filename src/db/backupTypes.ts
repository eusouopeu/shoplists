import type { Category, ProductLink, PurchaseHistoryEntry, ShoppingList, ShoppingListItem } from './types';

export interface FullBackup {
  version: 1;
  exportedAt: string;
  categories: Category[];
  shoppingLists: ShoppingList[];
  shoppingListItems: ShoppingListItem[];
  productLinks: ProductLink[];
  purchaseHistory: PurchaseHistoryEntry[];
}
