import { useState } from 'preact/hooks';
import { insertList, updateList } from '../../db/database';
import type { ListType, ShoppingList } from '../../db/types';
import { openSheet } from '../overlay';

export function openListFormSheet(existing?: ShoppingList): Promise<void> {
  return openSheet<void>((close) => <ListForm existing={existing} close={close} />).then(() => undefined);
}

function ListForm({ existing, close }: { existing?: ShoppingList; close: (result?: void) => void }) {
  const isEdit = existing != null;
  const [nome, setNome] = useState(existing?.nome ?? '');
  const [tipo, setTipo] = useState<ListType>(existing?.tipo ?? 'normal');
  const [intervaloDias, setIntervaloDias] = useState(
    existing?.intervaloDias != null ? String(existing.intervaloDias) : '30',
  );
  const [orcamento, setOrcamento] = useState(existing?.orcamento != null ? String(existing.orcamento) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro('Informe um nome');
      return;
    }
    let intervalo: number | null = null;
    if (tipo === 'periodica') {
      const n = Number.parseInt(intervaloDias, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setErro('Informe um número de dias válido');
        return;
      }
      intervalo = n;
    }
    const orcamentoTrim = orcamento.trim();
    let orcamentoValor: number | null = null;
    if (orcamentoTrim !== '') {
      const n = Number.parseFloat(orcamentoTrim.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        setErro('Orçamento inválido');
        return;
      }
      orcamentoValor = n;
    }
    setErro(null);
    setSaving(true);
    if (isEdit) {
      await updateList(existing!.id!, { nome: nomeTrim, tipo, intervaloDias: intervalo, orcamento: orcamentoValor });
    } else {
      await insertList({ nome: nomeTrim, tipo, intervaloDias: intervalo, orcamento: orcamentoValor });
    }
    close();
  };

  return (
    <div class="form-sheet">
      <h3>{isEdit ? 'Editar lista' : 'Nova lista'}</h3>
      <label class="field">
        <span>Nome da lista</span>
        <input
          autoFocus
          value={nome}
          onInput={(e) => setNome((e.target as HTMLInputElement).value)}
        />
      </label>
      <div class="segmented">
        <button class={tipo === 'normal' ? 'segment segment--active' : 'segment'} onClick={() => setTipo('normal')}>
          Normal
        </button>
        <button
          class={tipo === 'periodica' ? 'segment segment--active' : 'segment'}
          onClick={() => setTipo('periodica')}
        >
          Periódica
        </button>
      </div>
      {tipo === 'periodica' && (
        <label class="field">
          <span>Repetir a cada quantos dias?</span>
          <input
            type="number"
            value={intervaloDias}
            onInput={(e) => setIntervaloDias((e.target as HTMLInputElement).value)}
          />
        </label>
      )}
      <label class="field">
        <span>Orçamento (R$)</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Opcional"
          value={orcamento}
          onInput={(e) => setOrcamento((e.target as HTMLInputElement).value)}
        />
      </label>
      {erro && <p class="field-error">{erro}</p>}
      <button class="btn-filled btn-block" disabled={saving} onClick={salvar}>
        {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar lista'}
      </button>
    </div>
  );
}
