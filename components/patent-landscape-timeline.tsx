"use client";

import { useMemo, useState, type RefObject } from "react";
import { classificationLabel, sortLandscapeTimeline, timelineInsight, type LandscapePatent } from "@/lib/patents/patent-landscape";

const colours = { high: "#F87171", partial: "#FBBF24", low: "#34D399", insufficient: "#94A3B8" } as const;

export function PatentLandscapeTimeline({ patents, onSelect, svgRef }: { patents: LandscapePatent[]; onSelect: (patent: LandscapePatent) => void; svgRef: RefObject<SVGSVGElement | null> }) {
  const [hovered, setHovered] = useState<LandscapePatent | null>(null);
  const dated = useMemo(() => sortLandscapeTimeline(patents).filter((patent) => patent.date), [patents]);
  const years = dated.map((patent) => Number(patent.date!.slice(0, 4)));
  const minimum = years.length ? Math.min(...years) : new Date().getFullYear();
  const maximum = years.length ? Math.max(...years) : minimum;
  const span = Math.max(1, maximum - minimum);
  const activity = useMemo(() => {
    const values = new Map<number, { total: number; high: number }>();
    dated.forEach((patent) => { const year = Number(patent.date!.slice(0, 4)); const current = values.get(year) ?? { total: 0, high: 0 }; current.total += 1; if (patent.classification === "high") current.high += 1; values.set(year, current); });
    return [...values.entries()].sort(([left], [right]) => left - right);
  }, [dated]);

  return <div className="timeline-visual">
    {dated.length ? <>
      <div className="timeline-svg-wrap">
        <svg ref={svgRef} className="landscape-svg timeline-svg" viewBox="0 0 1000 280" role="group" aria-label="Patent filing timeline">
          <rect width="1000" height="280" fill="#050B18" /><line x1="70" y1="130" x2="930" y2="130" stroke="#164E63" strokeWidth="3" />
          {dated.map((patent, index) => { const year = Number(patent.date!.slice(0, 4)); const x = 70 + ((year - minimum) / span) * 800 + (span === 1 ? (index % 3) * 14 : 0); const upper = index % 2 === 0; return <g key={patent.publicationNumber} role="button" tabIndex={0} aria-label={`${patent.title}, ${patent.date}, observed overlap score ${patent.classification === "insufficient" ? "not available" : patent.score}, ${classificationLabel(patent.classification)}`} onMouseEnter={() => setHovered(patent)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(patent)} onBlur={() => setHovered(null)} onClick={() => onSelect(patent)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(patent); } }}>
            <line x1={x} y1="130" x2={x} y2={upper ? 78 : 182} stroke={colours[patent.classification]} strokeOpacity=".55" /><circle cx={x} cy="130" r={8 + patent.score * 0.035} fill={colours[patent.classification]} stroke="#F8FAFC" strokeOpacity=".7" />
            <text x={x} y={upper ? 64 : 202} textAnchor="middle" fill="#F8FAFC" fontSize="10" fontWeight="700">{patent.publicationNumber.slice(0, 16)}</text><text x={x} y={upper ? 48 : 218} textAnchor="middle" fill="#94A3B8" fontSize="9">{patent.date}</text>
          </g>; })}
          <g><circle cx="950" cy="130" r="13" fill="#082F49" stroke="#22D3EE" strokeWidth="2" /><text x="950" y="164" textAnchor="end" fill="#67E8F9" fontSize="10" fontWeight="700">Your invention — Current</text></g>
          <text x="70" y="255" fill="#94A3B8" fontSize="10">{minimum}</text><text x="930" y="255" textAnchor="end" fill="#94A3B8" fontSize="10">{maximum}</text>
        </svg>
        {hovered && <div className="landscape-tooltip timeline-tooltip" role="status"><strong>{hovered.title}</strong><span>{hovered.publicationNumber} · {hovered.applicant}</span><span>{hovered.date}</span><b>{hovered.classification === "insufficient" ? "Score not available" : hovered.score} · {classificationLabel(hovered.classification)}</b></div>}
      </div>
      <ol className="timeline-mobile-list">{dated.map((patent) => <li key={patent.publicationNumber}><button type="button" onClick={() => onSelect(patent)}><i style={{ background: colours[patent.classification] }} /><span><strong>{patent.title}</strong><small>{patent.date} · {patent.publicationNumber}</small></span><b>{patent.classification === "insufficient" ? "N/A" : patent.score}</b></button></li>)}</ol>
      <div className="timeline-summary"><div><strong>Yearly activity</strong><div>{activity.map(([year, count]) => <span key={year}>{year}: {count.total} patent{count.total === 1 ? "" : "s"} · {count.high} high</span>)}</div></div><p>{timelineInsight(dated)}</p></div>
    </> : <div className="landscape-empty"><strong>No dated patent results</strong><p>The stored results do not contain usable publication or priority dates.</p></div>}
  </div>;
}
