import type { ComponentChild } from 'preact';
import { useEffect, useState } from 'preact/hooks';

type OverlayKind = 'dialog' | 'sheet';

interface OverlayEntry {
  kind: OverlayKind;
  render: (close: (result?: unknown) => void) => ComponentChild;
  close: (result?: unknown) => void;
}

let current: OverlayEntry | null = null;
const listeners = new Set<(entry: OverlayEntry | null) => void>();

function notify() {
  for (const l of listeners) l(current);
}

function openOverlay<T>(
  kind: OverlayKind,
  render: (close: (result?: T) => void) => ComponentChild,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const close = (result?: T) => {
      current = null;
      notify();
      resolve(result);
    };
    current = { kind, render: render as OverlayEntry['render'], close: close as OverlayEntry['close'] };
    notify();
  });
}

/** Equivalente a showDialog: overlay centralizado, fecha ao tocar fora. */
export function openDialog<T>(render: (close: (result?: T) => void) => ComponentChild): Promise<T | undefined> {
  return openOverlay('dialog', render);
}

/** Equivalente a showModalBottomSheet: painel ancorado embaixo. */
export function openSheet<T>(render: (close: (result?: T) => void) => ComponentChild): Promise<T | undefined> {
  return openOverlay('sheet', render);
}

export function OverlayHost() {
  const [entry, setEntry] = useState<OverlayEntry | null>(current);

  useEffect(() => {
    listeners.add(setEntry);
    return () => {
      listeners.delete(setEntry);
    };
  }, []);

  if (!entry) return null;

  const alignment = entry.kind === 'dialog' ? 'items-center justify-center p-6' : 'items-end justify-center';
  const boxClass =
    entry.kind === 'dialog'
      ? 'w-full max-w-[400px] rounded-2xl bg-surface text-text shadow-xl'
      : 'w-full max-w-[560px] max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface text-text pb-[env(safe-area-inset-bottom)] shadow-xl';

  return (
    <div
      class={`fixed inset-0 z-[1000] flex bg-black/50 ${alignment}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) entry.close(undefined);
      }}
    >
      <div class={boxClass}>{entry.render(entry.close)}</div>
    </div>
  );
}
