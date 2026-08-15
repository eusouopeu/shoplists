import { useRef, useState } from 'preact/hooks';
import { insertItem, insertLink, markItemPurchased } from '../../db/database';
import { parseReceiptLines, recognizeReceiptText } from '../../services/receiptOcrService';
import type { ParsedReceiptItem } from '../../services/receiptOcrService';
import { openSheet } from '../overlay';

export function openReceiptImportSheet(listId: number): Promise<void> {
  return openSheet<void>((close) => <ReceiptImportForm listId={listId} close={close} />).then(() => undefined);
}

interface EditableLine extends ParsedReceiptItem {
  incluir: boolean;
}

type Stage = 'pick' | 'reading' | 'review' | 'saving';

function ReceiptImportForm({ listId, close }: { listId: number; close: (result?: void) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [linhas, setLinhas] = useState<EditableLine[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    setErro(null);
    setStage('reading');
    setProgress(0);
    try {
      const text = await recognizeReceiptText(file, setProgress);
      const parsed = parseReceiptLines(text);
      if (parsed.length === 0) {
        setErro('Não foi possível identificar itens na foto. Tente uma foto mais nítida e bem enquadrada.');
        setStage('pick');
        return;
      }
      setLinhas(parsed.map((p) => ({ ...p, incluir: true })));
      setStage('review');
    } catch {
      setErro('Falha ao processar a imagem. Tente novamente.');
      setStage('pick');
    }
  };

  const atualizarLinha = (i: number, patch: Partial<EditableLine>) => {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const confirmar = async () => {
    const selecionadas = linhas.filter((l) => l.incluir && l.nome.trim() && l.preco > 0);
    if (selecionadas.length === 0) {
      close();
      return;
    }
    setStage('saving');
    for (const linha of selecionadas) {
      const itemId = await insertItem({
        listaId: listId,
        nomeSimplificado: linha.nome.trim(),
        quantidade: linha.quantidade,
      });
      const linkId = await insertLink({
        itemId,
        url: 'Nota fiscal (importado)',
        loja: 'outro',
        preco: linha.preco,
        escolhido: true,
      });
      void linkId;
      await markItemPurchased(itemId);
    }
    close();
  };

  return (
    <div class="form-sheet">
      <h3>Importar nota fiscal</h3>
      {stage === 'pick' && (
        <>
          <p class="card-subtitle">
            Tire uma foto (ou escolha uma imagem) da nota fiscal. Os itens reconhecidos são adicionados a
            esta lista já marcados como comprados, com o preço lido.
          </p>
          {erro && <div class="field-error">{erro}</div>}
          <button class="btn-filled btn-block" onClick={() => fileRef.current?.click()}>
            📷 Escolher foto da nota
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden-file-input"
            onChange={onFile}
          />
          <button class="btn-text" onClick={() => close()}>
            Cancelar
          </button>
        </>
      )}
      {stage === 'reading' && (
        <div class="centered-column">
          <div class="centered">Lendo a nota fiscal… {progress}%</div>
        </div>
      )}
      {stage === 'review' && (
        <>
          <p class="card-subtitle">Confira os itens reconhecidos antes de adicionar. Você pode editar nome, quantidade e preço.</p>
          <div class="receipt-review-list">
            {linhas.map((linha, i) => (
              <div class="receipt-review-row" key={i}>
                <input
                  type="checkbox"
                  checked={linha.incluir}
                  onChange={(e) => atualizarLinha(i, { incluir: (e.target as HTMLInputElement).checked })}
                />
                <input
                  class="receipt-review-nome"
                  type="text"
                  value={linha.nome}
                  onInput={(e) => atualizarLinha(i, { nome: (e.target as HTMLInputElement).value })}
                />
                <input
                  class="receipt-review-qtd"
                  type="number"
                  min="1"
                  value={linha.quantidade}
                  onInput={(e) => atualizarLinha(i, { quantidade: Number((e.target as HTMLInputElement).value) || 1 })}
                />
                <input
                  class="receipt-review-preco"
                  type="number"
                  min="0"
                  step="0.01"
                  value={linha.preco}
                  onInput={(e) => atualizarLinha(i, { preco: Number((e.target as HTMLInputElement).value) || 0 })}
                />
              </div>
            ))}
          </div>
          <button class="btn-filled btn-block" onClick={confirmar}>
            Adicionar {linhas.filter((l) => l.incluir).length} itens
          </button>
          <button class="btn-text" onClick={() => close()}>
            Cancelar
          </button>
        </>
      )}
      {stage === 'saving' && (
        <div class="centered-column">
          <div class="centered">Adicionando itens…</div>
        </div>
      )}
    </div>
  );
}
