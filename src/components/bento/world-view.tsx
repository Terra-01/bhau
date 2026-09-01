"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { ChoroplethChart } from "@/components/charts/choropleth/choropleth-chart";
import { ChoroplethFeature } from "@/components/charts/choropleth/choropleth-feature";
import { ChoroplethTooltip } from "@/components/charts/choropleth/choropleth-tooltip";
import type { ChoroplethFeatureProperties } from "@/components/charts/choropleth/choropleth-context";
import { Tile } from "../tiles/tile";

// World View: the mockup's interactive map. India selected by default;
// click any country for its World Bank vitals.
interface CountryStats {
  iso: string;
  stats: Record<string, { value: number; year: string } | null>;
  policyRate: { value: number; label: string; asOf: string } | null;
}

type WorldGeo = FeatureCollection<Geometry, ChoroplethFeatureProperties> & {
  features: Array<{ id?: string | number }>;
}

const statFmt = (key: string, s: { value: number; year: string } | null): string => {
  if (!s) return "—";
  if (key === "gdp") return s.value >= 1e12 ? `$${(s.value / 1e12).toFixed(2)}T` : `$${(s.value / 1e9).toFixed(0)}B`;
  return `${s.value.toFixed(1)}%`;
};

const STAT_LABELS: Array<[string, string]> = [
  ["gdp", "GDP"],
  ["growth", "GDP growth"],
  ["inflation", "Inflation"],
  ["unemployment", "Unemployment"],
];

export function WorldView() {
  const [geo, setGeo] = useState<WorldGeo | null>(null);
  const [selected, setSelected] = useState<{ iso: string; name: string }>({ iso: "IND", name: "India" });
  const [loaded, setLoaded] = useState<{ iso: string; stats: CountryStats | null } | null>(null);
  const stats = loaded?.iso === selected.iso ? loaded.stats : null;
  const hovered = useRef<{ iso: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/geo/countries.geo.json")
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/country/${selected.iso}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setLoaded({ iso: selected.iso, stats: d }))
      .catch(() => alive && setLoaded({ iso: selected.iso, stats: null }));
    return () => {
      alive = false;
    };
  }, [selected]);

  return (
    <Tile title="World view" meta="WORLD BANK · CLICK A COUNTRY">
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="min-h-0 flex-1 cursor-pointer"
          onClick={() => {
            if (hovered.current) setSelected(hovered.current);
          }}
        >
          {geo ? (
            <ChoroplethChart data={geo} className="mx-auto h-full max-w-full" aspectRatio="1.9 / 1" center={[18, 16]}>
              <ChoroplethFeature
                stroke="var(--color-canvas)"
                strokeWidth={0.5}
                getFeatureColor={(feature) =>
                  (feature as { id?: string }).id === selected.iso ? "var(--color-blue)" : "var(--color-smoke)"
                }
              />
              <ChoroplethTooltip
                content={({ feature }) => {
                  const f = feature as { id?: string; properties?: { name?: string } };
                  if (f.id && f.properties?.name) hovered.current = { iso: String(f.id), name: f.properties.name };
                  return (
                    <span className="rounded-[4px] border border-ash bg-canvas px-2 py-1 text-[10.5px] font-medium text-charcoal shadow-sm">
                      {f.properties?.name ?? ""}
                    </span>
                  );
                }}
              />
            </ChoroplethChart>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-fog">Loading map…</div>
          )}
        </div>
        <div className="shrink-0 border-t border-ash px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[12.5px] font-semibold text-ink">{selected.name}</span>
            {STAT_LABELS.map(([key, label]) => (
              <span key={key} className="text-[10.5px] text-fog">
                {label}{" "}
                <span className="font-mono text-[11px] font-medium tabular-nums text-charcoal">
                  {stats ? statFmt(key, stats.stats[key]) : "…"}
                </span>
              </span>
            ))}
            {stats?.policyRate && (
              <span className="text-[10.5px] text-fog">
                {stats.policyRate.label}{" "}
                <span className="font-mono text-[11px] font-medium tabular-nums text-charcoal">{stats.policyRate.value.toFixed(2)}%</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Tile>
  );
}
