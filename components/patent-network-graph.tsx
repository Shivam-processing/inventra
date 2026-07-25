"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState, type RefObject } from "react";
import { classificationLabel, type LandscapePatent } from "@/lib/patents/patent-landscape";

type GraphNode = d3.SimulationNodeDatum & { id: string; patent: LandscapePatent | null; centre: boolean };
type GraphLink = d3.SimulationLinkDatum<GraphNode> & { status: LandscapePatent["classification"] };

const colours = { high: "#F87171", partial: "#FBBF24", low: "#34D399", insufficient: "#94A3B8" } as const;

function shortTitle(value: string, maximum = 24) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

export function PatentNetworkGraph({
  patents,
  inventionTitle,
  onSelect,
  svgRef,
}: {
  patents: LandscapePatent[];
  inventionTitle: string;
  onSelect: (patent: LandscapePatent) => void;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<LandscapePatent | null>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const width = 980;
    const height = 580;
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("role", "group").attr("aria-label", `Patent landscape network for ${inventionTitle}`);

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "landscape-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("stdDeviation", 5).attr("result", "blur");
    const merge = glow.append("feMerge"); merge.append("feMergeNode").attr("in", "blur"); merge.append("feMergeNode").attr("in", "SourceGraphic");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#050B18");
    const viewport = svg.append("g");

    const centre: GraphNode = { id: "your-invention", patent: null, centre: true, x: width / 2, y: height / 2, fx: width / 2, fy: height / 2 };
    const nodes: GraphNode[] = [centre, ...patents.map((patent) => ({ id: patent.publicationNumber, patent, centre: false }))];
    const links: GraphLink[] = patents.map((patent) => ({ source: centre, target: patent.publicationNumber, status: patent.classification }));
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((node) => node.id).distance((link) => 130 + (100 - (link.target as GraphNode).patent!.score) * 0.7).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-420))
      .force("collide", d3.forceCollide<GraphNode>().radius((node) => node.centre ? 65 : 34 + (node.patent?.score ?? 0) * 0.09).iterations(2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.08));

    const link = viewport.append("g").attr("aria-hidden", "true").selectAll("line").data(links).join("line")
      .attr("class", patents.length <= 30 ? "landscape-edge flowing" : "landscape-edge")
      .attr("stroke", (item) => colours[item.status]).attr("stroke-opacity", 0.45).attr("stroke-width", 1.4);

    const node = viewport.append("g").selectAll<SVGGElement, GraphNode>("g").data(nodes).join("g")
      .attr("class", (item) => item.centre ? "landscape-node centre" : "landscape-node patent")
      .attr("tabindex", (item) => item.centre ? null : 0)
      .attr("role", (item) => item.centre ? "img" : "button")
      .attr("aria-label", (item) => item.centre ? `Your invention: ${inventionTitle}` : `${item.patent!.title}, ${item.patent!.publicationNumber}, ${classificationLabel(item.patent!.classification)}, observed overlap score ${item.patent!.classification === "insufficient" ? "not available" : item.patent!.score}`)
      .on("mouseenter focus", (_, item) => { if (item.patent) setHovered(item.patent); })
      .on("mouseleave blur", () => setHovered(null))
      .on("click", (_, item) => { if (item.patent) onSelect(item.patent); })
      .on("keydown", (event: KeyboardEvent, item) => { if (item.patent && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(item.patent); } });

    node.append("circle")
      .attr("r", (item) => item.centre ? 43 : 16 + (item.patent?.score ?? 0) * 0.1)
      .attr("fill", (item) => item.centre ? "#082F49" : colours[item.patent!.classification])
      .attr("fill-opacity", (item) => item.centre ? 1 : 0.86)
      .attr("stroke", (item) => item.centre ? "#22D3EE" : "#E2E8F0")
      .attr("stroke-opacity", (item) => item.centre ? 1 : 0.55)
      .attr("stroke-width", (item) => item.centre ? 2.5 : 1.2)
      .attr("filter", (item) => item.centre || item.patent?.classification === "high" ? "url(#landscape-glow)" : null);
    node.append("text").attr("text-anchor", "middle").attr("dy", (item) => item.centre ? 3 : (22 + (item.patent?.score ?? 0) * 0.1))
      .attr("fill", "#F8FAFC").attr("font-size", (item) => item.centre ? 12 : 10).attr("font-weight", 700)
      .text((item) => item.centre ? "Your invention" : shortTitle(item.patent!.title));
    node.filter((item) => !item.centre).append("text").attr("text-anchor", "middle").attr("dy", (item) => 35 + (item.patent?.score ?? 0) * 0.1)
      .attr("fill", "#94A3B8").attr("font-size", 8.5).text((item) => `${item.patent!.classification === "insufficient" ? "N/A" : item.patent!.score} · ${item.patent!.publicationNumber}`);

    const drag = d3.drag<SVGGElement, GraphNode>()
      .on("start", (event, item) => { if (!event.active) simulation.alphaTarget(0.25).restart(); item.fx = item.x; item.fy = item.y; })
      .on("drag", (event, item) => { item.fx = Math.max(45, Math.min(width - 45, event.x)); item.fy = Math.max(45, Math.min(height - 45, event.y)); })
      .on("end", (event, item) => { if (!event.active) simulation.alphaTarget(0); if (!item.centre) { item.fx = null; item.fy = null; } });
    node.call(drag);

    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.55, 2.4]).on("zoom", (event) => viewport.attr("transform", event.transform)));
    simulation.on("tick", () => {
      nodes.forEach((item) => { item.x = Math.max(38, Math.min(width - 38, item.x ?? width / 2)); item.y = Math.max(38, Math.min(height - 38, item.y ?? height / 2)); });
      link.attr("x1", (item) => (item.source as GraphNode).x ?? 0).attr("y1", (item) => (item.source as GraphNode).y ?? 0).attr("x2", (item) => (item.target as GraphNode).x ?? 0).attr("y2", (item) => (item.target as GraphNode).y ?? 0);
      node.attr("transform", (item) => `translate(${item.x ?? 0},${item.y ?? 0})`);
    });
    return () => { simulation.stop(); svg.on(".zoom", null); };
  }, [inventionTitle, onSelect, patents, svgRef]);

  return <div className="network-graph-host" ref={hostRef}>
    <svg ref={svgRef} className="landscape-svg network-svg" />
    {hovered && <div className="landscape-tooltip" role="status"><strong>{hovered.title}</strong><span>{hovered.publicationNumber} · {hovered.applicant}</span><span>{hovered.date ?? "Date not listed"}</span><b>{hovered.classification === "insufficient" ? "Score not available" : hovered.score} · {classificationLabel(hovered.classification)}</b></div>}
    <ol className="sr-only" aria-label="Patents shown in network">{patents.map((patent) => <li key={patent.publicationNumber}><button type="button" onClick={() => onSelect(patent)}>{patent.title}, {patent.publicationNumber}, {classificationLabel(patent.classification)}, score {patent.classification === "insufficient" ? "not available" : patent.score}</button></li>)}</ol>
  </div>;
}
