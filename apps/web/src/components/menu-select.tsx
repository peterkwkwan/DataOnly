"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "@/components/icons";

export type MenuSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type MenuSelectProps<T extends string> = {
  label: string;
  value: T;
  options: MenuSelectOption<T>[];
  onChange: (value: T) => void;
  /** stack = form field; inline = filter row */
  layout?: "stack" | "inline";
  className?: string;
};

export function MenuSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  layout = "stack",
  className,
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        setOpen(true);
        return;
      }
      if (event.key === "ArrowDown") {
        setActive((i) => Math.min(options.length - 1, i + 1));
      }
    }
    if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = options[active];
      if (option) {
        onChange(option.value);
        setOpen(false);
      }
    }
  }

  return (
    <div
      className={`industry-field menu-select${layout === "inline" ? " menu-select--inline" : ""}${className ? ` ${className}` : ""}`}
      ref={rootRef}
    >
      <span className="industry-field-label" id={fieldId}>
        {label}
      </span>
      <button
        type="button"
        className={`industry-select-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={fieldId}
        onClick={() => {
          setOpen((wasOpen) => {
            if (!wasOpen) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
            return !wasOpen;
          });
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label ?? ""}</span>
        <Icon name="chevron" size={18} />
      </button>
      {open ? (
        <ul
          id={listboxId}
          className="industry-select-menu"
          role="listbox"
          aria-labelledby={fieldId}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === active;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`industry-select-option${isSelected ? " is-selected" : ""}${isActive ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <span className="industry-select-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
