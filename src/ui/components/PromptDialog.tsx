import { useRef } from 'preact/hooks';
import { openDialog } from '../overlay';

interface PromptOptions {
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  inputType?: string;
}

export function promptText(options: PromptOptions): Promise<string | null> {
  return openDialog<string>((close) => <PromptForm options={options} close={close} />).then((r) => r ?? null);
}

function PromptForm({ options, close }: { options: PromptOptions; close: (result?: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const value = inputRef.current?.value.trim() ?? '';
    if (value) close(value);
  };

  return (
    <div class="dialog">
      <h3>{options.title}</h3>
      <input
        ref={inputRef}
        type={options.inputType ?? 'text'}
        placeholder={options.placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <div class="dialog-actions">
        <button class="btn-text" onClick={() => close(undefined)}>
          Cancelar
        </button>
        <button class="btn-filled" onClick={submit}>
          {options.confirmLabel ?? 'Adicionar'}
        </button>
      </div>
    </div>
  );
}
