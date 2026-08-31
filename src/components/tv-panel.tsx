"use client";

import { useState } from "react";
import { Panel } from "./panel";

// Official live streams only. Embeds use the channel's permanent
// live_stream URL; channels whose IDs we haven't verified link out.
const EMBEDS = [
  { id: "ndtv-profit", name: "NDTV Profit", channelId: "UCZFMm1mMw0F81Z37aaEzTUA" },
] as const;

const LINKOUTS = [
  { name: "CNBC-TV18", url: "https://www.youtube.com/results?search_query=cnbc+tv18+live" },
  { name: "ET Now", url: "https://www.youtube.com/results?search_query=et+now+live" },
] as const;

export function TvPanel() {
  const [active, setActive] = useState<(typeof EMBEDS)[number]>(EMBEDS[0]);

  return (
    <Panel title="Live TV" meta="OFFICIAL STREAMS">
      <div className="aspect-video w-full bg-paper">
        <iframe
          key={active.id}
          className="h-full w-full"
          src={`https://www.youtube.com/embed/live_stream?channel=${active.channelId}`}
          title={`${active.name} live`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        {EMBEDS.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => setActive(channel)}
            className={`rounded-button border px-3 py-1 text-[12px] font-medium transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.97] ${
              active.id === channel.id
                ? "border-charcoal bg-charcoal text-canvas"
                : "border-ash bg-canvas text-charcoal"
            }`}
          >
            {channel.name}
          </button>
        ))}
        {LINKOUTS.map((channel) => (
          <a
            key={channel.name}
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-button border border-ash bg-canvas px-3 py-1 text-[12px] font-medium text-steel transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.97]"
          >
            {channel.name} ↗
          </a>
        ))}
        <span className="ml-auto text-[10.5px] text-fog">Streams run market hours — if dark, open on YouTube.</span>
      </div>
    </Panel>
  );
}
