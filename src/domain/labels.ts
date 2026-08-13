import type { ListStatus, ListType } from '../db/types';

export function listTypeLabel(tipo: ListType): string {
  return tipo === 'periodica' ? 'Periódica' : 'Normal';
}

export function listStatusLabel(status: ListStatus): string {
  switch (status) {
    case 'ativa':
      return 'Ativa';
    case 'concluida':
      return 'Concluída';
    case 'aguardandoRessurgir':
      return 'Aguardando repetição';
  }
}
