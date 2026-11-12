import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type FsoOption = { value: string; label: string };

/**
 * Compact dropdown for the phone field app. Native <select> lists open full-screen on phones
 * and cannot be styled, so this renders a small scrollable list anchored to the button.
 */
export default function FsoSelect({ label, value, options, onChange }: { label: string; value: string; options: FsoOption[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null), list = useRef<HTMLUListElement>(null), id = useId();
  const selected = options.find(option => option.value === value);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect(), width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16, maxHeight = Math.min(280, Math.max(below, above));
    const top = below >= Math.min(200, above) ? rect.bottom + 6 : Math.max(8, rect.top - 6 - Math.min(maxHeight, options.length * 40 + 8));
    setPlace({ top, left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8), width, maxHeight });
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, options.findIndex(option => option.value === value));
    setActive(index);
    requestAnimationFrame(() => list.current?.children[index]?.scrollIntoView({ block: 'nearest' }));
    const close = (event: Event) => { if (event.type === 'scroll' && list.current?.contains(event.target as Node)) return; setOpen(false); };
    window.addEventListener('resize', close); window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (option: FsoOption) => { onChange(option.value); setOpen(false); button.current?.focus(); };
  return <div className={'fso-select' + (value ? ' has-value' : '')}>
    <button ref={button} type="button" className="fso-select-button" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={`${label}: ${selected?.label || 'All'}`}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOpen(true); return; }
        if (!open) return;
        if (event.key === 'Escape' || event.key === 'Tab') { setOpen(false); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const next = (active + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
          setActive(next); list.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (options[active]) choose(options[active]); }
      }}>
      <span>{value ? selected?.label || value : label}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <>
      <div className="fso-select-backdrop" onClick={() => setOpen(false)} />
      <ul ref={list} id={id} role="listbox" aria-label={label} className="fso-select-list" style={place ? { top: place.top, left: place.left, width: place.width, maxHeight: place.maxHeight } : { visibility: 'hidden' }}>
        {options.map((option, index) => <li key={option.value} role="option" aria-selected={option.value === value} className={(index === active ? 'active ' : '') + (option.value === value ? 'selected' : '')}
          onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
          <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
        </li>)}
      </ul>
    </>}
  </div>;
}
