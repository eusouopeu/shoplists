import type { StoreType } from '../db/types';

export function detectStore(url: string): StoreType {
  let host = '';
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    host = '';
  }
  if (host.includes('shopee')) return 'shopee';
  if (host.includes('mercadolivre') || host.includes('mercadolibre')) return 'mercadoLivre';
  if (host.includes('amazon')) return 'amazon';
  return 'outro';
}

export function storeLabel(tipo: StoreType): string {
  switch (tipo) {
    case 'shopee':
      return 'Shopee';
    case 'mercadoLivre':
      return 'Mercado Livre';
    case 'amazon':
      return 'Amazon';
    case 'outro':
      return 'Outra loja';
  }
}
