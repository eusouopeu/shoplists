import { useState } from 'preact/hooks';
import { insertList } from '../../db/database';
import type { ListType } from '../../db/types';
import { openSheet } from '../overlay';

export function openListFormSheet(): Promise<void> {
  return openSheet<void>((close) => <ListForm close={close} />).then(() => undefined);
}

function ListForm({ close }: { close: (result?: void) => void }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ListType>('normal');
  const [intervaloDias, setIntervaloDias] = useState('30');
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
    setErro(null);
    setSaving(true);
    await insertList({ nome: nomeTrim, tipo, intervaloDias: intervalo });
    close();
  };

  return (
    <div class="form-sheet">
      <h3>Nova lista</h3>
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
      {erro && <p class="field-error">{erro}</p>}
      <button class="btn-filled btn-block" disabled={saving} onClick={salvar}>
        {saving ? 'Salvando…' : 'Criar lista'}
      </button>
    </div>
  );
}
