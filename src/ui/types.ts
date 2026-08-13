export type Screen =
  | { type: 'listDetail'; listId: number }
  | { type: 'itemForm'; listId: number; itemId?: number; prefillUrl?: string };

export type Tab = 'lists' | 'history' | 'settings';
