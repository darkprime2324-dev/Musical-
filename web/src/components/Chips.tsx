import { emit } from '../core/store';
import { save } from '../core/settings';

// A row of mutually exclusive choices. Choosing saves the settings and refreshes the interface.
export function Chips<T extends string>({ id, items, value, onPick, nowrap }: { id: string; items: [T, string][]; value: string; onPick: (v: T) => void; nowrap?: boolean }) {
  return (
    <div className={'row' + (nowrap ? ' nowrap' : '')} id={id}>
      {items.map(([v, label]) => (
        <button key={v} type="button" className="chip" data-id={v} aria-pressed={String(v === value) as 'true' | 'false'}
          onClick={() => { onPick(v); save(); emit(); }}>{label}</button>
      ))}
    </div>
  );
}
