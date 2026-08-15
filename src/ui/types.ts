export type Screen =
  | { type: 'listDetail'; listId: number }
  | { type: 'itemForm'; listId: number; itemId?: number; prefillUrl?: string }
  | { type: 'search' };

export type Tab = 'lists' | 'history' | 'reports' | 'settings';
