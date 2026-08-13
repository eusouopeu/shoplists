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

  return (
    <div
      class={`overlay-backdrop overlay-backdrop--${entry.kind}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) entry.close(undefined);
      }}
    >
      <div class={entry.kind === 'dialog' ? 'dialog-box' : 'sheet-box'}>{entry.render(entry.close)}</div>
    </div>
  );
}
