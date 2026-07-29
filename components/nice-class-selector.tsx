"use client";

import { useMemo, useState } from "react";
import { NICE_CLASSES, searchNiceClasses } from "@/lib/trademarks/nice-classes";
import { useLanguage } from "./language-provider";

export function NiceClassSelector({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const options = useMemo(() => searchNiceClasses(query).slice(0, 45), [query]);
  const selected = NICE_CLASSES.find((item) => item.number === value)!;

  return <div className="trademark-nice-selector">
    <label htmlFor="trademark-nice-search">{t("trademarks.niceClass")}</label>
    <input
      role="combobox"
      aria-expanded={open}
      aria-controls="trademark-nice-list"
      aria-haspopup="listbox"
      id="trademark-nice-search"
      value={open ? query : `Class ${selected.number} — ${selected.plainTitle}`}
      placeholder={t("trademarks.niceSearchPlaceholder")}
      onFocus={() => { setOpen(true); setQuery(""); }}
      onBlur={() => window.setTimeout(() => setOpen(false), 100)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      disabled={disabled}
      autoComplete="off"
      aria-autocomplete="list"
    />
    {open && <ul id="trademark-nice-list" role="listbox" aria-label={t("trademarks.niceResults")}>
      {options.length ? options.map((item) => <li key={item.number} role="option" aria-selected={item.number === value}>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(item.number); setOpen(false); setQuery(""); }}>
          <b>Class {item.number}</b>
          <span><strong>{item.plainTitle}</strong><small>{t("trademarks.examplesLabel")}: {item.examples.join(", ")}</small></span>
          <em>{item.type}</em>
        </button>
      </li>) : <li className="trademark-nice-empty">{t("trademarks.noNiceResults")}</li>}
    </ul>}
    <div className="trademark-selected-class" data-testid="selected-nice-class">
      <span>{t("trademarks.selectedClass")}</span>
      <strong>Class {selected.number}: {selected.heading}</strong>
      <small>{t("trademarks.examplesLabel")}: {selected.examples.join(", ")}</small>
    </div>
    <small>{t("trademarks.niceNote")}</small>
  </div>;
}
