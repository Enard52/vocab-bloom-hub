'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { responseJson } from './data';
import styles from './styles.module.scss';

export const tabId = (id: string, value: string) => `${id}-${encodeURIComponent(value)}`;

export const ChoiceTabs = ({
  id,
  label,
  value,
  options,
  onChange,
  dir,
  panel,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  dir: 'ltr' | 'rtl';
  panel: string;
}) => (
  <div className={styles.tabs} role="tablist" aria-label={label} dir={dir}>
    {options.map((option, index) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        id={tabId(id, option.value)}
        aria-controls={panel}
        aria-selected={value === option.value}
        tabIndex={value === option.value ? 0 : -1}
        onClick={() => onChange(option.value)}
        onKeyDown={(event) => {
          let next = index;
          if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = options.length - 1;
          else if (event.key === 'ArrowRight') next += dir === 'rtl' ? -1 : 1;
          else if (event.key === 'ArrowLeft') next += dir === 'rtl' ? 1 : -1;
          else return;
          event.preventDefault();
          const option = options[(next + options.length) % options.length];
          onChange(option.value);
          document.getElementById(tabId(id, option.value))?.focus();
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const TermsPopover = ({
  label,
  closeLabel,
  terms,
}: {
  label: string;
  closeLabel: string;
  terms: Record<string, unknown>;
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className={styles.terms} ref={wrapper}>
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((previous) => !previous)}
      >
        {label}
      </button>
      {open && (
        <div id={id} ref={dialog} role="dialog" aria-label={label} tabIndex={-1} className={styles.popover}>
          <div className={styles.popoverHeader}>
            <strong>{label}</strong>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          <pre dir="ltr" tabIndex={0}>
            <code>{responseJson(terms, true)}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
