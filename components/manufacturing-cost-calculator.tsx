"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateManufacturingCosts, costByVolume, formatChartInr, formatInrRange, formatQuantityUnitLabel } from "@/lib/manufacturing/cost-calculator";
import type { ManufacturingAnalysis, ManufacturingQuantity } from "@/lib/manufacturing/types";
import { useLanguage } from "./language-provider";

const quantities: ManufacturingQuantity[] = [1, 10, 100, 1000, 10000];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function ManufacturingCostCalculator({ analysis, includedComponentIds, initialQuantity }: { analysis: ManufacturingAnalysis; includedComponentIds: ReadonlySet<string>; initialQuantity: ManufacturingQuantity }) {
  const [quantity, setQuantity] = useState<ManufacturingQuantity>(initialQuantity);
  const [amortise, setAmortise] = useState(false);
  const [includeLanded, setIncludeLanded] = useState(true);
  const { t } = useLanguage();
  const summary = useMemo(() => calculateManufacturingCosts(analysis, quantity, includedComponentIds, amortise, includeLanded), [analysis, quantity, includedComponentIds, amortise, includeLanded]);
  const volumeData = useMemo(() => costByVolume(analysis, includedComponentIds, amortise).map((item) => ({ ...item, label: item.quantity >= 1000 ? `${item.quantity / 1000}K` : String(item.quantity) })), [analysis, includedComponentIds, amortise]);
  const rows = [
    [t("manufacturing.bomSubtotal"), summary.bomPerUnit], [t("manufacturing.assembly"), summary.assemblyPerUnit], [t("manufacturing.testing"), summary.testingPerUnit], [t("manufacturing.packaging"), summary.packagingPerUnit], [t("manufacturing.wastageWithPercent", { percent: summary.wastagePercent }), summary.wastagePerUnit],
  ] as const;
  return <section className="manufacturing-panel" id="manufacturing-costs" aria-labelledby="manufacturing-cost-title">
    <div className="manufacturing-section-heading"><span>05</span><div><h2 id="manufacturing-cost-title">{t("manufacturing.costTitle")}</h2><p>{t("manufacturing.marketEstimate")}</p></div></div>
    <div className="manufacturing-quantity-tabs" role="group" aria-label={t("manufacturing.targetQuantity")}>{quantities.map((item) => <button type="button" key={item} aria-pressed={quantity === item} onClick={() => setQuantity(item)}>{item >= 1000 ? `${item / 1000}K` : item}</button>)}</div>
    <div className="manufacturing-cost-hero"><span>{t("manufacturing.estimatedUnit")}</span><strong>{formatInrRange(summary.unitCost)}</strong><small>{t("manufacturing.perUnitAt", { quantity: formatQuantityUnitLabel(quantity) })}</small></div>
    <div className="manufacturing-toggle-row"><label><input type="checkbox" checked={amortise} onChange={(event) => setAmortise(event.target.checked)} />{t("manufacturing.amortise")}</label><label><input type="checkbox" checked={includeLanded} disabled={summary.importedBomPerUnit.maximum === 0} onChange={(event) => setIncludeLanded(event.target.checked)} />{t("manufacturing.includeLanded")}</label></div>
    <div className="manufacturing-cost-grid">
      <div className="manufacturing-cost-table" role="table" aria-label={t("manufacturing.costBreakdown")}>
        {rows.map(([label, range]) => <div role="row" key={label}><span role="cell">{label}</span><strong role="cell">{formatInrRange(range)}</strong><small>{t("manufacturing.perUnit")}</small></div>)}
        {summary.landedCostApplied && <div role="row"><span role="cell">{t("manufacturing.landedPlanning", { percent: summary.landedCostPercent })}</span><strong role="cell">{formatInrRange(summary.landedCostPerUnit)}</strong><small>{t("manufacturing.perUnit")}</small></div>}
        {!summary.landedCostApplied && <div role="row" className="explanation"><span role="cell">{t("manufacturing.landed")}</span><small role="cell">{summary.landedCostReason}</small></div>}
        <div role="row" className="total"><span role="cell">{t("manufacturing.batchTotal")}</span><strong role="cell">{formatInrRange(summary.batchCost)}</strong><small>{t("manufacturing.perBatch")}</small></div>
        <div role="row"><span role="cell">{t("manufacturing.oneTimeCosts")}</span><strong role="cell">{formatInrRange(summary.oneTimeCost)}</strong><small>{t("manufacturing.oneTime")}</small></div>
      </div>
      <div className="manufacturing-chart" role="img" aria-label={t("manufacturing.volumeChartLabel")}>
        <h3>{t("manufacturing.costByVolume")}</h3>
        <ResponsiveContainer width="100%" height={260}><LineChart data={volumeData} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}><CartesianGrid stroke="#E8E3DB" /><XAxis dataKey="label" stroke="#8C8578" /><YAxis stroke="#8C8578" tickFormatter={formatChartInr} /><Tooltip formatter={(value) => money.format(Number(value))} contentStyle={{ background: "#FFFFFF", border: "1px solid #DCD6CC", color: "#232019" }} labelStyle={{ color: "#232019" }} /><Legend /><Line type="monotone" dataKey="minimum" name="Minimum" stroke="#3B82A0" /><Line type="monotone" dataKey="typical" name="Typical" stroke="#2D7A4F" /><Line type="monotone" dataKey="maximum" name="Maximum" stroke="#D4603A" /></LineChart></ResponsiveContainer>
      </div>
      <div className="manufacturing-chart" role="img" aria-label={t("manufacturing.categoryChartLabel")}>
        <h3>{t("manufacturing.categoryCosts")}</h3>
        <ResponsiveContainer width="100%" height={260}><BarChart data={summary.categoryTotals} layout="vertical" margin={{ top: 8, right: 12, left: 24, bottom: 8 }}><CartesianGrid stroke="#E8E3DB" /><XAxis type="number" stroke="#8C8578" tickFormatter={formatChartInr} /><YAxis type="category" dataKey="category" width={88} stroke="#8C8578" tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => money.format(Number(value))} contentStyle={{ background: "#FFFFFF", border: "1px solid #DCD6CC", color: "#232019" }} labelStyle={{ color: "#232019" }} /><Bar dataKey="typicalPerUnit" name="Typical per unit" fill="#2D7A4F" /></BarChart></ResponsiveContainer>
      </div>
    </div>
    <details className="manufacturing-accessible-table"><summary>{t("manufacturing.chartTableAlternative")}</summary><table><thead><tr><th>{t("manufacturing.targetQuantity")}</th><th>{t("manufacturing.minimum")}</th><th>{t("manufacturing.typical")}</th><th>{t("manufacturing.maximum")}</th></tr></thead><tbody>{volumeData.map((item) => <tr key={item.quantity}><td>{item.quantity.toLocaleString("en-IN")}</td><td>{money.format(item.minimum)}</td><td>{money.format(item.typical)}</td><td>{money.format(item.maximum)}</td></tr>)}</tbody></table></details>
    <p className="manufacturing-method-note">{t("manufacturing.nearestTier", { tier: summary.tier.toLocaleString("en-IN") })}</p>
    <details className="manufacturing-estimate-details"><summary>{t("manufacturing.howCalculated")}</summary><div><p><strong>{t("manufacturing.pricingTier")}</strong> {summary.tier.toLocaleString("en-IN")} · {formatQuantityUnitLabel(quantity)} · {t("manufacturing.nearestTierUsed")}</p><p><strong>{t("manufacturing.includedComponents")}</strong> {analysis.components.filter((item) => item.includedInPhysicalBom && includedComponentIds.has(item.id)).map((item) => item.name).join(", ") || t("common.none")}</p><p><strong>{t("manufacturing.excludedComponents")}</strong> {analysis.components.filter((item) => item.includedInPhysicalBom && !includedComponentIds.has(item.id)).map((item) => item.name).join(", ") || t("common.none")}</p><p>{t("manufacturing.assemblyAssumption")}: {formatInrRange(summary.assemblyPerUnit)} · {t("manufacturing.testingAssumption")}: {formatInrRange(summary.testingPerUnit)} · {t("manufacturing.packagingAssumption")}: {formatInrRange(summary.packagingPerUnit)}</p><p>{t("manufacturing.wastageWithPercent", { percent: summary.wastagePercent })}. {summary.landedCostReason}</p><p><strong>{t("manufacturing.oneTimeCategories")}</strong> {analysis.costModel.oneTimeCosts.filter((item) => item.included).map((item) => `${item.name} (${money.format(item.minimumInr)}–${money.format(item.maximumInr)})`).join("; ")}</p><p>{amortise ? t("manufacturing.amortisedOn") : t("manufacturing.amortisedOff")}</p></div></details>
  </section>;
}
