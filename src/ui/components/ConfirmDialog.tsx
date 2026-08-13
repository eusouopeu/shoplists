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
    <div class="dialog">
      {options.title && <h3>{options.title}</h3>}
      <p>{options.content}</p>
      <div class="dialog-actions">
        <button class="btn-filled" onClick={() => close()}>
          OK
        </button>
      </div>
    </div>
  )).then(() => undefined);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return openDialog<boolean>((close) => (
    <div class="dialog">
      <h3>{options.title}</h3>
      <p>{options.content}</p>
      <div class="dialog-actions">
        <button class="btn-text" onClick={() => close(false)}>
          {options.cancelLabel ?? 'Cancelar'}
        </button>
        <button class="btn-filled" onClick={() => close(true)}>
          {options.confirmLabel ?? 'Confirmar'}
        </button>
      </div>
    </div>
  )).then((r) => r ?? false);
}
