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
    <div class="sheet-list">
      <div class="sheet-title">{options.title}</div>
      {options.options.map((opt, i) => (
        <button key={i} class="sheet-item" onClick={() => close(opt.value)}>
          <span class="sheet-item-label">{opt.label}</span>
          {opt.sublabel && <span class="sheet-item-sublabel">{opt.sublabel}</span>}
        </button>
      ))}
    </div>
  ));
}
