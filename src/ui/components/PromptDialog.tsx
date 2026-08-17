import { useRef } from 'preact/hooks';
import { PrimaryButton, TextButton, TextInput } from '../kit';
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
    <div class="flex flex-col gap-2.5 p-5">
      <h3 class="m-0 text-lg font-bold">{options.title}</h3>
      <TextInput
        ref={inputRef}
        type={options.inputType ?? 'text'}
        placeholder={options.placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <div class="mt-2 flex justify-end gap-2">
        <TextButton onClick={() => close(undefined)}>Cancelar</TextButton>
        <PrimaryButton onClick={submit}>{options.confirmLabel ?? 'Adicionar'}</PrimaryButton>
      </div>
    </div>
  );
}
