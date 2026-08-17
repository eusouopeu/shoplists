import { PrimaryButton, TextButton } from '../kit';
import { openDialog } from '../overlay';

interface ConfirmOptions {
  title: string;
  content: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface AlertOptions {
  title?: string;
  content: string;
}

export function alertDialog(options: AlertOptions): Promise<void> {
  return openDialog<void>((close) => (
    <div class="flex flex-col gap-2.5 p-5">
      {options.title && <h3 class="m-0 text-lg font-bold">{options.title}</h3>}
      <p class="m-0 text-text-muted">{options.content}</p>
      <div class="mt-2 flex justify-end gap-2">
        <PrimaryButton onClick={() => close()}>OK</PrimaryButton>
      </div>
    </div>
  )).then(() => undefined);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return openDialog<boolean>((close) => (
    <div class="flex flex-col gap-2.5 p-5">
      <h3 class="m-0 text-lg font-bold">{options.title}</h3>
      <p class="m-0 text-text-muted">{options.content}</p>
      <div class="mt-2 flex justify-end gap-2">
        <TextButton onClick={() => close(false)}>{options.cancelLabel ?? 'Cancelar'}</TextButton>
        <PrimaryButton onClick={() => close(true)}>{options.confirmLabel ?? 'Confirmar'}</PrimaryButton>
      </div>
    </div>
  )).then((r) => r ?? false);
}
