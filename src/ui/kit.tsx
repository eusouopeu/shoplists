import type { ComponentChildren, JSX } from 'preact';

/** Componentes de UI compartilhados, com classes utilitárias Tailwind
 * seguindo uma identidade visual inspirada na Amazon: header azul-marinho
 * escuro, CTAs em laranja, cards brancos com borda sutil, cantos pouco
 * arredondados (não em pílula, exceto chips/FAB). */

export function Screen({ children }: { children: ComponentChildren }) {
  return <div class="relative flex h-full min-h-0 flex-col bg-canvas">{children}</div>;
}

export function AppBar({ children }: { children: ComponentChildren }) {
  return (
    <header class="flex items-center gap-0.5 bg-header px-3 pb-3.5 pt-[calc(env(safe-area-inset-top)+14px)] text-white sm:px-4">
      {children}
    </header>
  );
}

export function AppBarTitle({ children }: { children: ComponentChildren }) {
  return <h1 class="flex-1 truncate text-[1.05rem] font-bold">{children}</h1>;
}

export function ScreenBody({ children }: { children: ComponentChildren }) {
  return <div class="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-3">{children}</div>;
}

interface IconButtonProps {
  label: string;
  onClick?: (e: MouseEvent) => void;
  children: ComponentChildren;
  variant?: 'header' | 'default';
  active?: boolean;
  class?: string;
}

/** Botão apenas com ícone. Sempre leva `title` (tooltip nativo no hover) e
 * `aria-label` (acessibilidade para leitor de tela) a partir do mesmo texto. */
export function IconButton({ label, onClick, children, variant = 'default', active, class: className }: IconButtonProps) {
  const base = 'shrink-0 rounded-full p-1.5 transition-colors cursor-pointer';
  const styles =
    variant === 'header'
      ? `text-white/90 hover:bg-white/15 active:bg-white/25 ${active ? 'bg-white/20' : ''}`
      : `text-text-muted hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 ${active ? 'bg-accent/15 text-accent-hover' : ''}`;
  return (
    <button type="button" title={label} aria-label={label} class={`${base} ${styles} ${className ?? ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

interface ButtonProps {
  children: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  block?: boolean;
  type?: 'button' | 'submit';
}

export function PrimaryButton({ children, onClick, disabled, block, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      class={`rounded-lg border border-black/10 bg-accent px-5 py-3 font-semibold text-accent-ink shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50 ${block ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

export function TextButton({ children, onClick, disabled, block }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      class={`rounded-lg px-3 py-2 font-semibold text-link hover:underline disabled:cursor-default disabled:opacity-50 ${block ? 'w-full text-center' : ''}`}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: ComponentChildren }) {
  return <div class="mx-1 mb-2 mt-2 text-[0.8rem] font-bold uppercase tracking-wide text-text-muted">{children}</div>;
}

export function Card({
  children,
  highlight,
  onClick,
  class: className,
}: {
  children: ComponentChildren;
  highlight?: boolean;
  onClick?: () => void;
  class?: string;
}) {
  const highlightCls = highlight
    ? 'border-accent/50 bg-accent/10'
    : 'border-border bg-surface';
  return (
    <div
      class={`mb-2.5 flex items-center gap-3 rounded-lg border px-3 py-3.5 shadow-sm ${highlightCls} ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function Chip({ children, class: className }: { children: ComponentChildren; class?: string }) {
  return (
    <span class={`inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text ${className ?? ''}`}>
      {children}
    </span>
  );
}

export function ActionChip({
  children,
  onClick,
  selected,
  title,
}: {
  children: ComponentChildren;
  onClick?: () => void;
  selected?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      class={
        selected
          ? 'rounded-full border border-header bg-header px-3 py-1.5 text-sm font-semibold text-white'
          : 'rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text hover:bg-surface-muted'
      }
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <label class="flex min-w-0 flex-col gap-1.5">
      <span class="text-[0.85rem] text-text-muted">{label}</span>
      {children}
      {hint && <small class="text-[0.75rem] text-text-muted">{hint}</small>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40';

export function TextInput(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} class={`${inputClass} ${props.class ?? ''}`} />;
}

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} class={`${inputClass} ${props.class ?? ''}`} />;
}

export function FieldError({ children }: { children: ComponentChildren }) {
  return <p class="m-0 text-[0.85rem] text-danger">{children}</p>;
}

export function ListRow({
  children,
  onClick,
  muted,
  action,
  class: className,
}: {
  children: ComponentChildren;
  onClick?: () => void;
  muted?: boolean;
  action?: boolean;
  class?: string;
}) {
  return (
    <div
      class={`flex w-full items-center gap-2.5 border-b border-border py-3 text-left ${
        muted ? 'cursor-default text-text-muted' : ''
      } ${action ? 'cursor-pointer font-semibold text-link' : ''} ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function Fab({ label, onClick, children }: { label: string; onClick: () => void; children: ComponentChildren }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      class="absolute bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}

export function Spinner({ class: className }: { class?: string }) {
  return (
    <span
      class={`inline-block h-3 w-3 animate-spin-slow rounded-full border-2 border-border border-t-accent ${className ?? ''}`}
    />
  );
}

export function ProgressBar({ pct, danger }: { pct: number; danger?: boolean }) {
  return (
    <div class="h-1.5 overflow-hidden rounded-full bg-surface-muted">
      <div
        class={`h-full rounded-full transition-[width] duration-200 ${danger ? 'bg-danger' : 'bg-accent'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="flex overflow-hidden rounded-lg border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          class={`flex-1 py-2.5 text-sm ${
            o.value === value ? 'bg-accent/15 font-semibold text-header' : 'bg-surface text-text hover:bg-surface-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Centered({ children, muted }: { children: ComponentChildren; muted?: boolean }) {
  return (
    <div class={`flex h-full items-center justify-center p-6 text-center ${muted ? 'text-text-muted' : ''}`}>
      {children}
    </div>
  );
}
