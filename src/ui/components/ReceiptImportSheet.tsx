import { useRef, useState } from 'preact/hooks';
import { insertItem, insertLink, markItemPurchased } from '../../db/database';
import { parseReceiptLines, recognizeReceiptText } from '../../services/receiptOcrService';
import type { ParsedReceiptItem } from '../../services/receiptOcrService';
import { IconCamera } from '../icons';
import { Centered, FieldError, PrimaryButton, TextButton } from '../kit';
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
      await insertLink({
        itemId,
        url: 'Nota fiscal (importado)',
        loja: 'outro',
        preco: linha.preco,
        escolhido: true,
      });
      await markItemPurchased(itemId);
    }
    close();
  };

  return (
    <div class="flex flex-col gap-4 p-5">
      <h3 class="m-0 text-lg font-bold">Importar nota fiscal</h3>
      {stage === 'pick' && (
        <>
          <p class="m-0 text-[0.85rem] text-text-muted">
            Tire uma foto (ou escolha uma imagem) da nota fiscal. Os itens reconhecidos são adicionados a
            esta lista já marcados como comprados, com o preço lido.
          </p>
          {erro && <FieldError>{erro}</FieldError>}
          <PrimaryButton block onClick={() => fileRef.current?.click()}>
            <span class="inline-flex items-center gap-2">
              <IconCamera size={20} /> Escolher foto da nota
            </span>
          </PrimaryButton>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" class="hidden" onChange={onFile} />
          <TextButton block onClick={() => close()}>
            Cancelar
          </TextButton>
        </>
      )}
      {stage === 'reading' && (
        <div class="flex flex-col items-stretch gap-4 pt-2">
          <Centered>Lendo a nota fiscal… {progress}%</Centered>
        </div>
      )}
      {stage === 'review' && (
        <>
          <p class="m-0 text-[0.85rem] text-text-muted">
            Confira os itens reconhecidos antes de adicionar. Você pode editar nome, quantidade e preço.
          </p>
          <div class="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
            {linhas.map((linha, i) => (
              <div class="flex items-center gap-1.5" key={i}>
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-[var(--color-accent)]"
                  checked={linha.incluir}
                  onChange={(e) => atualizarLinha(i, { incluir: (e.target as HTMLInputElement).checked })}
                />
                <input
                  class="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-[0.9rem] text-text"
                  type="text"
                  value={linha.nome}
                  onInput={(e) => atualizarLinha(i, { nome: (e.target as HTMLInputElement).value })}
                />
                <input
                  class="w-11 rounded-lg border border-border bg-surface px-2 py-1.5 text-[0.9rem] text-text"
                  type="number"
                  min="1"
                  value={linha.quantidade}
                  onInput={(e) => atualizarLinha(i, { quantidade: Number((e.target as HTMLInputElement).value) || 1 })}
                />
                <input
                  class="w-[72px] rounded-lg border border-border bg-surface px-2 py-1.5 text-[0.9rem] text-text"
                  type="number"
                  min="0"
                  step="0.01"
                  value={linha.preco}
                  onInput={(e) => atualizarLinha(i, { preco: Number((e.target as HTMLInputElement).value) || 0 })}
                />
              </div>
            ))}
          </div>
          <PrimaryButton block onClick={confirmar}>
            Adicionar {linhas.filter((l) => l.incluir).length} itens
          </PrimaryButton>
          <TextButton block onClick={() => close()}>
            Cancelar
          </TextButton>
        </>
      )}
      {stage === 'saving' && (
        <div class="flex flex-col items-stretch gap-4 pt-2">
          <Centered>Adicionando itens…</Centered>
        </div>
      )}
    </div>
  );
}
