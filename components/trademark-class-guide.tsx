"use client";

import { useMemo, useState } from "react";
import {
  CLASS_FINDER_CATEGORIES,
  classFinderDetails,
  classFinderSuggestions,
  niceClass,
  suggestNiceClassesFromContext,
  type ClassFinderCategory,
  type NiceClassSuggestion,
} from "@/lib/trademarks/nice-classes";
import { useLanguage } from "./language-provider";

function mergeSuggestions(...groups: NiceClassSuggestion[][]) {
  return groups.flat().filter((item, index, all) => all.findIndex((candidate) => candidate.niceClass === item.niceClass) === index).slice(0, 6);
}

export function TrademarkClassGuide({ context, selectedClass, onSelect, disabled }: { context: string; selectedClass: number; onSelect: (value: number) => void; disabled?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ClassFinderCategory | "">("");
  const [detail, setDetail] = useState("");
  const contextual = useMemo(() => suggestNiceClassesFromContext(context), [context]);
  const guided = useMemo(() => classFinderSuggestions(category, detail), [category, detail]);
  const suggestions = mergeSuggestions(guided, contextual);
  const selected = niceClass(selectedClass)!;

  return <section className="trademark-class-guide" aria-labelledby="class-guide-title">
    <div className="trademark-class-guide-heading">
      <div><span>{t("trademarks.currentClass")}</span><strong>Class {selected.number}: {selected.plainTitle}</strong></div>
      <button type="button" className="trademark-quiet-button" aria-expanded={open} aria-controls="trademark-class-finder" onClick={() => setOpen((value) => !value)} disabled={disabled}>{t("trademarks.helpChooseClass")}</button>
    </div>
    {open && <div id="trademark-class-finder" className="trademark-class-finder">
      <h3 id="class-guide-title">{t("trademarks.classFinderTitle")}</h3>
      <label>{t("trademarks.classFinderQuestionOne")}
        <select value={category} onChange={(event) => { setCategory(event.target.value as ClassFinderCategory); setDetail(""); }} disabled={disabled}>
          <option value="">{t("trademarks.chooseOne")}</option>
          {CLASS_FINDER_CATEGORIES.map((item) => <option value={item.value} key={item.value}>{t(`trademarks.classFinderCategory.${item.value}`)}</option>)}
        </select>
      </label>
      {category && <label>{t("trademarks.classFinderQuestionTwo")}
        <select value={detail} onChange={(event) => setDetail(event.target.value)} disabled={disabled}>
          <option value="">{t("trademarks.chooseOne")}</option>
          {classFinderDetails(category).map((item) => <option value={item.value} key={item.value}>{t(`trademarks.classFinderDetail.${item.value}` as Parameters<typeof t>[0])}</option>)}
        </select>
      </label>}
    </div>}
    {(suggestions.length > 0 || (open && detail)) && <div className="trademark-class-suggestions" aria-live="polite">
      <h3>{t("trademarks.suggestedClasses")}</h3>
      {suggestions.length ? suggestions.map((suggestion) => {
        const item = niceClass(suggestion.niceClass)!;
        return <article key={item.number}>
          <div><span>Class {item.number}</span><small>{t(`trademarks.classConfidence.${suggestion.confidence}`)}</small></div>
          <h4>{item.plainTitle}</h4>
          <p>{suggestion.reason}</p>
          <p><b>{t("trademarks.examplesLabel")}:</b> {item.examples.join(", ")}</p>
          <button type="button" className="trademark-quiet-button" onClick={() => onSelect(item.number)} disabled={disabled || selectedClass === item.number}>{selectedClass === item.number ? t("trademarks.classSelected") : t("trademarks.selectClass")}</button>
        </article>;
      }) : <p>{t("trademarks.noClassSuggestion")}</p>}
    </div>}
    <p className="trademark-class-caveat">{t("trademarks.classificationDepends")}</p>
  </section>;
}
