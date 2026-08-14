export type ListType = 'normal' | 'periodica';

export type ListStatus = 'ativa' | 'concluida' | 'aguardandoRessurgir';

export type StoreType = 'shopee' | 'mercadoLivre' | 'amazon' | 'outro';

export interface Category {
  id: number;
  nome: string;
  icone: string | null;
  cor: string | null;
}

export interface ShoppingList {
  id: number;
  nome: string;
  tipo: ListType;
  intervaloDias: number | null;
  dataUltimaConclusao: Date | null;
  proximaDataRessurgimento: Date | null;
  status: ListStatus;
  dataCriacao: Date;
  orcamento: number | null;
}

export interface ShoppingListItem {
  id: number;
  listaId: number;
  nomeSimplificado: string;
  categoriaId: number | null;
  quantidade: number;
  unidadesPorItem: number;
  comprado: boolean;
  dataCompra: Date | null;
  prazoGarantiaDias: number | null;
  dataFimGarantia: Date | null;
  dataFimArrependimento: Date | null;
  ordem: number;
}

export interface PurchaseHistoryEntry {
  id: number;
  itemNome: string;
  categoriaId: number | null;
  listaId: number;
  listaNome: string;
  precoPago: number | null;
  quantidade: number;
  data: Date;
}

export interface ProductLink {
  id: number;
  itemId: number;
  url: string;
  loja: StoreType;
  imagemUrl: string | null;
  preco: number | null;
  precoAtualizadoEm: Date | null;
  escolhido: boolean;
}
