"use client";

import { useState } from "react";
import type { WarRoomData } from "@/lib/warroom";
import { dateIST, timeIST } from "@/lib/format";
import { Tile } from "./tile";
import { AGENT_COLOR } from "./floor-tile";

const TAB_ORDER = ["all", "macro", "momentum", "value", "contrarian"] as const;
const TAB_LABEL: Record<string, string> = {
  all: "All",
  macro: "Macro",
  momentum: "Momentum",
  value: "Value",
  contrarian: "Contrarian",
};

function Badge({ action, accepted }: { action: string; accepted: boolean }) {
  if (!accepted) return <span className="rounded-full bg-warn-wash px-2 py-px text-[9px] font-semibold text-warn">REJECTED</span>;
  const style = action === "BUY" ? "bg-gain-wash text-gain" : action === "SELL" ? "bg-loss-wash text-loss" : "bg-paper text-fog";
  return <span className={`rounded-full px-2 py-px text-[9px] font-semibold ${style}`}>{action.replace("_", " ")}</span>;
}

export function ThesesTile({ theses }: { theses: WarRoomData["floor"]["theses"] }) {
  const [tab, setTab] = useState<string>("all");
  const visible = theses.filter((t) => tab === "all" || t.agentId === tab);

  return (
    <Tile
      title="Theses"
      meta={
        <span className="flex gap-1">
          {TAB_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-2 py-px font-sans text-[9.5px] font-semibold transition-colors duration-150 ${
                tab === id ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </span>
      }
      scroll
    >
      <ul>
        {visible.length === 0 && <li className="px-3 py-4 text-[12px] text-fog">No decisions from this agent yet.</li>}
        {visible.map((t) => (
          <li key={t.seq} className="border-b border-ash px-3 py-2 last:border-b-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-charcoal">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: AGENT_COLOR[t.agentId] }} />
                {t.agentName.replace("The ", "")}
              </span>
              <Badge action={t.action} accepted={t.accepted} />
              {t.symbol && (
                <span className="font-mono text-[10.5px] text-charcoal">
                  {t.symbol}
                  {t.allocationPct ? ` ${t.allocationPct}%` : ""}
                </span>
              )}
              <span className="ml-auto font-mono text-[9.5px] tabular-nums text-silver">
                {dateIST(t.ts).slice(0, 6)} {timeIST(t.ts)}
              </span>
            </div>
            <p
              className="mt-1 border-l-2 pl-2 text-[11.5px] leading-snug text-steel"
              style={{ borderColor: AGENT_COLOR[t.agentId] }}
            >
              {t.thesis}
              {t.rejectReason ? <span className="text-warn"> — rulebook: {t.rejectReason}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
