"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Tile } from "./tile";

// Click-to-load: no dead black iframe off-hours, no autoplay bandwidth.
// Channel IDs verified against the official YouTube channels.
const CHANNELS = [
  { id: "ndtv-profit", name: "NDTV Profit", channelId: "UCZFMm1mMw0F81Z37aaEzTUA" },
  { id: "cnbc-awaaz", name: "CNBC Awaaz", channelId: "UCQIycDaLsBpMKjOCeaKUYVg" },
  { id: "aaj-tak", name: "Aaj Tak", channelId: "UCYPvAwZP8pZhSMW8qs7cVCw" },
  { id: "abp-news", name: "ABP News", channelId: "UCRWFSbif-RFENbBrSiez1DA" },
] as const;

const LINKOUTS = [
  { name: "Zee Business", url: "https://www.youtube.com/results?search_query=zee+business+live" },
  { name: "ET Now", url: "https://www.youtube.com/results?search_query=et+now+live" },
] as const;

export function TvTile() {
  const [playing, setPlaying] = useState(false);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>(CHANNELS[0]);

  return (
    <Tile title="Live TV" meta="MARKET HOURS">
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1 bg-paper">
          {playing ? (
            <iframe
              key={channel.id}
              className="h-full w-full"
              src={`https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&autoplay=1`}
              title={`${channel.name} live`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group flex h-full w-full flex-col items-center justify-center gap-1.5 transition-colors duration-150 [@media(hover:hover)]:hover:bg-mint/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-canvas transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] group-active:scale-[0.94]">
                <Play size={14} fill="currentColor" />
              </span>
              <span className="text-[11px] font-medium text-charcoal">{channel.name} — live</span>
              <span className="text-[9.5px] text-fog">streams during market hours</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-ash px-2.5 py-1.5">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c)}
              className={`rounded-full px-2 py-px text-[9.5px] font-semibold transition-colors duration-150 ${
                channel.id === c.id ? "bg-charcoal text-canvas" : "border border-ash text-steel [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {c.name}
            </button>
          ))}
          {LINKOUTS.map((c) => (
            <a
              key={c.name}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ash px-2 py-px text-[9.5px] font-medium text-steel transition-transform duration-150 active:scale-[0.97]"
            >
              {c.name} ↗
            </a>
          ))}
        </div>
      </div>
    </Tile>
  );
}
