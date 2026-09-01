"use client";

import { Play, Tv } from "lucide-react";
import { useState } from "react";
import { Tile } from "./tile";

// Live TV: the current live video id is resolved server-side per channel
// (/api/tv/[channelId]) — the legacy live_stream embed endpoint shows
// "video unavailable" even mid-broadcast. Off-air channels get an honest
// state with a YouTube link, never a dead black iframe.
const CHANNELS = [
  { id: "ndtv-profit", name: "NDTV Profit", channelId: "UCZFMm1mMw0F81Z37aaEzTUA" },
  { id: "cnbc-awaaz", name: "CNBC Awaaz", channelId: "UCQIycDaLsBpMKjOCeaKUYVg" },
  { id: "aaj-tak", name: "Aaj Tak", channelId: "UCYPvAwZP8pZhSMW8qs7cVCw" },
  { id: "abp-news", name: "ABP News", channelId: "UCRWFSbif-RFENbBrSiez1DA" },
] as const;

type Channel = (typeof CHANNELS)[number];
type StreamState = { channelId: string; status: "loading" | "off-air" } | { channelId: string; status: "live"; videoId: string };

export function TvTile() {
  const [channel, setChannel] = useState<Channel>(CHANNELS[0]);
  const [stream, setStream] = useState<StreamState | null>(null);

  const tune = (next: Channel) => {
    setChannel(next);
    setStream({ channelId: next.channelId, status: "loading" });
    fetch(`/api/tv/${next.channelId}`)
      .then((r) => r.json())
      .then((d: { videoId: string | null }) =>
        setStream((current) =>
          current?.channelId === next.channelId
            ? d.videoId
              ? { channelId: next.channelId, status: "live", videoId: d.videoId }
              : { channelId: next.channelId, status: "off-air" }
            : current,
        ),
      )
      .catch(() =>
        setStream((current) => (current?.channelId === next.channelId ? { channelId: next.channelId, status: "off-air" } : current)),
      );
  };

  const active = stream?.channelId === channel.channelId ? stream : null;

  return (
    <Tile title="Live TV" meta="OFFICIAL STREAMS">
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1 bg-paper">
          {active?.status === "live" ? (
            <iframe
              key={active.videoId}
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${active.videoId}?autoplay=1`}
              title={`${channel.name} live`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : active?.status === "loading" ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-[10.5px] text-fog">
              Tuning to {channel.name}…
            </div>
          ) : active?.status === "off-air" ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5">
              <Tv size={16} className="text-silver" strokeWidth={1.5} />
              <span className="text-[11px] font-medium text-charcoal">{channel.name} — no live stream found</span>
              <a
                href={`https://www.youtube.com/channel/${channel.channelId}/live`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-ash px-2 py-px text-[9.5px] font-medium text-steel [@media(hover:hover)]:hover:bg-canvas"
              >
                Open on YouTube ↗
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => tune(channel)}
              className="group flex h-full w-full flex-col items-center justify-center gap-1.5 transition-colors duration-150 [@media(hover:hover)]:hover:bg-mint/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-canvas transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] group-active:scale-[0.94]">
                <Play size={14} fill="currentColor" />
              </span>
              <span className="text-[11px] font-medium text-charcoal">{channel.name} — tune in</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-ash px-2 py-1">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => tune(c)}
              className={`rounded-full px-2 py-px text-[9.5px] font-semibold transition-colors duration-150 ${
                channel.id === c.id ? "bg-charcoal text-canvas" : "border border-ash text-steel [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </Tile>
  );
}
