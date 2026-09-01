"use client";

import { ExternalLink, Play, Tv, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PauseIcon } from "@/components/ui/pause";
import { PlayIcon } from "@/components/ui/play";
import { Tile } from "./tile";

// Custom player, paused by default: while paused we render our own
// facade (stream thumbnail + play), so no YouTube chrome ever shows.
// Pressing play mounts a fresh chrome-less embed (controls=0,
// pointer-events none) — a live stream always joins at the live edge.
const CHANNELS = [
  { id: "cnbc-awaaz", name: "CNBC Awaaz", channelId: "UCQIycDaLsBpMKjOCeaKUYVg" },
  { id: "ndtv-profit", name: "NDTV Profit", channelId: "UCZFMm1mMw0F81Z37aaEzTUA" },
  { id: "india-today", name: "India Today", channelId: "UCYPvAwZP8pZhSMW8qs7cVCw" },
  { id: "aaj-tak", name: "Aaj Tak", channelId: "UCt4t-jeY85JegMlZ-E5UWtA" },
  { id: "abp-news", name: "ABP News", channelId: "UCRWFSbif-RFENbBrSiez1DA" },
] as const;

type Channel = (typeof CHANNELS)[number];
type StreamState =
  | { channelId: string; status: "loading" | "off-air" }
  | { channelId: string; status: "live"; videoId: string };

export function TvTile() {
  const [channel, setChannel] = useState<Channel>(CHANNELS[0]);
  const [stream, setStream] = useState<StreamState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const frame = useRef<HTMLIFrameElement | null>(null);

  const command = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }, []);

  // Every play mounts a fresh muted embed, so the mute state must follow.
  const play = useCallback(() => {
    setMuted(true);
    setPlaying(true);
  }, []);

  const tune = useCallback((next: Channel) => {
    setChannel(next);
    setMuted(true);
    setStream({ channelId: next.channelId, status: "loading" });
    const attemptFetch = (attempt: number) => {
      const settle = (videoId: string | null) =>
        setStream((current) => {
          if (current?.channelId !== next.channelId) return current;
          if (videoId) return { channelId: next.channelId, status: "live", videoId };
          // First resolution can time out while the server-side scrape is
          // cold — retry once before declaring the channel off-air.
          if (attempt === 0) {
            setTimeout(() => attemptFetch(1), 4000);
            return { channelId: next.channelId, status: "loading" };
          }
          return { channelId: next.channelId, status: "off-air" };
        });
      fetch(`/api/tv/${next.channelId}`)
        .then((r) => r.json())
        .then((d: { videoId: string | null }) => settle(d.videoId))
        .catch(() => settle(null));
    };
    attemptFetch(0);
  }, []);

  // Resolve the default channel's stream on mount — paused, facade only.
  useEffect(() => {
    const id = requestAnimationFrame(() => tune(CHANNELS[0]));
    return () => cancelAnimationFrame(id);
  }, [tune]);

  const active = stream?.channelId === channel.channelId ? stream : null;
  const live = active?.status === "live" ? active : null;

  return (
    <Tile
      title="Live TV"
      meta={
        live ? (
          <span className="flex items-center gap-1 text-gain">
            <span className={`h-1.5 w-1.5 rounded-full bg-gain ${playing ? "animate-pulse" : ""}`} /> LIVE
          </span>
        ) : (
          "OFFICIAL STREAMS"
        )
      }
    >
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-ink/95">
          {live && playing ? (
            <iframe
              ref={frame}
              key={live.videoId}
              className="pointer-events-none h-full w-full"
              src={`https://www.youtube.com/embed/${live.videoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&iv_load_policy=3&enablejsapi=1`}
              title={`${channel.name} live`}
              allow="autoplay; encrypted-media"
            />
          ) : live ? (
            // Paused facade: thumbnail + our play affordance, zero YouTube UI.
            <button
              type="button"
              onClick={play}
              className="group relative block h-full w-full"
              title={`Play ${channel.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- youtube thumbnail host */}
              <img
                src={`https://i.ytimg.com/vi/${live.videoId}/hqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover opacity-60"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-transform duration-150 group-active:scale-[0.94] [@media(hover:hover)]:group-hover:bg-black/80">
                  <Play size={15} fill="currentColor" className="translate-x-px" />
                </span>
              </span>
            </button>
          ) : active?.status === "loading" ? (
            <div className="flex h-full items-center justify-center text-[10.5px] text-canvas/70">Tuning to {channel.name}…</div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5">
              <Tv size={16} className="text-canvas/50" strokeWidth={1.5} />
              <span className="text-[11px] font-medium text-canvas/80">{channel.name} — no live stream found</span>
              <a
                href={`https://www.youtube.com/channel/${channel.channelId}/live`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-canvas/30 px-2 py-px text-[9.5px] font-medium text-canvas/70"
              >
                Open on YouTube ↗
              </a>
            </div>
          )}

          {/* Our control bar — the only chrome */}
          {live && (
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4">
              <button
                type="button"
                onClick={() => (playing ? setPlaying(false) : play())}
                className="flex h-5 w-5 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-[0.92] [@media(hover:hover)]:hover:bg-white/20"
                title={playing ? "Pause" : "Play from live"}
              >
                {playing ? <PauseIcon size={11} className="flex" /> : <PlayIcon size={11} className="flex" />}
              </button>
              {playing && (
                <button
                  type="button"
                  onClick={() => {
                    command(muted ? "unMute" : "mute");
                    setMuted(!muted);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-[0.92] [@media(hover:hover)]:hover:bg-white/20"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
              )}
              <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium text-white/85">{channel.name}</span>
              <a
                href={`https://www.youtube.com/watch?v=${live.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-5 w-5 items-center justify-center rounded-full text-white/70 [@media(hover:hover)]:hover:bg-white/20"
                title="Open on YouTube"
              >
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-ash px-2 py-1">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => tune(c)}
              className={`rounded-full px-1.5 py-px text-[9px] font-semibold transition-colors duration-150 ${
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
