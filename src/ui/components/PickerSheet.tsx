import type { ComponentChild } from 'preact';
import { openSheet } from '../overlay';

export interface PickerOption<T> {
  value: T;
  label: ComponentChild;
  sublabel?: ComponentChild;
}

interface PickerOptions<T> {
  title: string;
  options: PickerOption<T>[];
}

export function pickOne<T>(options: PickerOptions<T>): Promise<T | undefined> {
  return openSheet<T>((close) => (
    <div class="py-3 pb-5">
      <div class="px-5 py-3 font-bold">{options.title}</div>
      {options.options.map((opt, i) => (
        <button
          key={i}
          class="flex w-full flex-col items-start gap-0.5 px-5 py-3 text-left text-text hover:bg-surface-muted"
          onClick={() => close(opt.value)}
        >
          <span class="w-full truncate">{opt.label}</span>
          {opt.sublabel && <span class="text-[0.85rem] text-text-muted">{opt.sublabel}</span>}
        </button>
      ))}
    </div>
  ));
}
