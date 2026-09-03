"use client";

import { Music, Sparkles } from "lucide-react";
import { AssetPopover } from "@/components/asset-popover";
import { FlipView } from "@/components/motion/flip-view";
import type { ExchangeData } from "@/lib/exchange";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { useCarousel } from "@/lib/use-carousel";
import { Tile } from "../tiles/tile";

// The fun corner: trending songs + the famous tongue-in-cheek recession
// indicators, computed for real from listed names.

// Brand glyphs (lucide dropped brand icons) — link-sized, currentColor.
const SpotifyGlyph = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0Zm5.5 17.3c-.22.36-.68.47-1.04.25-2.85-1.74-6.44-2.13-10.66-1.17-.41.1-.83-.17-.92-.58-.1-.41.17-.83.58-.92 4.62-1.06 8.58-.6 11.78 1.35.37.22.48.7.26 1.07Zm1.47-3.27c-.28.45-.86.6-1.31.32-3.26-2-8.23-2.58-12.08-1.41-.5.15-1.04-.13-1.19-.64-.15-.5.13-1.04.64-1.19 4.4-1.34 9.88-.69 13.62 1.62.45.27.6.86.32 1.3Zm.13-3.4C15.24 8.3 8.8 8.09 5.07 9.22c-.6.18-1.24-.16-1.42-.76-.18-.6.16-1.24.76-1.42 4.28-1.3 11.4-1.05 15.9 1.62.54.32.72 1.02.4 1.56-.32.54-1.02.72-1.56.4Z" />
  </svg>
);
const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M16.37 12.72c-.02-2.05 1.68-3.03 1.75-3.08-.95-1.39-2.44-1.58-2.97-1.6-1.26-.13-2.47.74-3.11.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.03-1.43 2.48-.37 6.15 1.03 8.17.68.99 1.49 2.1 2.56 2.06 1.03-.04 1.42-.66 2.66-.66 1.24 0 1.59.66 2.68.64 1.11-.02 1.81-1 2.49-2 .78-1.15 1.1-2.26 1.12-2.32-.02-.01-2.15-.83-2.17-3.28ZM14.3 6.7c.57-.69.95-1.65.85-2.6-.82.03-1.8.54-2.39 1.23-.52.6-.98 1.58-.86 2.51.91.07 1.84-.46 2.4-1.14Z" />
  </svg>
);
export function FunCorner({
  songs,
  mood,
  baskets,
}: {
  songs: WarRoomData["songs"];
  mood: WarRoomData["songMood"];
  baskets: ExchangeData["funBaskets"];
}) {
  const tabs = [{ id: "songs", label: "Songs" }, ...baskets.map((b) => ({ id: b.id, label: b.name.split(" ")[0] }))];
  const { index, select, pauseProps, hold } = useCarousel(tabs.length, 36_000, 30_000);
  const tab = tabs[index]?.id ?? "songs";
  const basket = baskets.find((b) => b.id === tab);

  return (
    <Tile
      title="Off the tape"
      icon={<Sparkles size={10} strokeWidth={2} className="text-lavender" />}
      meta={
        <span className="flex gap-1">
          {tabs.map(({ id, label }, i) => (
            <button
              key={id}
              type="button"
              onClick={() => select(i)}
              className={`rounded-full px-2 py-px font-sans text-[9.5px] font-semibold transition-colors duration-150 ${
                tab === id ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      }
      scroll
    >
      <div {...pauseProps}>
      <FlipView id={tab}>
      {tab === "songs" ? (
        !songs || songs.length === 0 ? (
          <p className="px-3 py-3 text-[11.5px] text-fog">Charts unavailable.</p>
        ) : (
          <ul className="flip-stagger px-2.5 py-1">
            {mood && (
              <li className="mb-0.5 flex items-baseline gap-1.5 rounded-[4px] bg-paper/70 px-1.5 py-1">
                <span className="text-[12px]">{mood.emoji}</span>
                <span className="min-w-0">
                  <span className="text-[10.5px] font-semibold text-ink">India&apos;s mood: {mood.label}</span>
                  <span className="block text-[9.5px] leading-snug text-fog">{mood.line}</span>
                </span>
              </li>
            )}
            {songs.map((song, i) => (
              <li key={song.title} className="flex items-center gap-2 border-b border-ash py-[3px] last:border-b-0">
                <span className="w-3 font-mono text-[9.5px] tabular-nums text-silver">{i + 1}</span>
                {song.art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={song.art} alt="" className="h-7 w-7 shrink-0 rounded-[4px] border border-ash object-cover" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-paper">
                    <Music size={11} className="text-silver" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-charcoal">{song.title}</span>
                  <span className="block truncate text-[9.5px] text-fog">{song.artist}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <a
                    href={`https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Find on Spotify"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[#1DB954] transition-colors [@media(hover:hover)]:hover:bg-paper"
                  >
                    <SpotifyGlyph />
                  </a>
                  {song.url && (
                    <a
                      href={song.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open on Apple Music"
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[#FA57C1] transition-colors [@media(hover:hover)]:hover:bg-paper"
                    >
                      <AppleGlyph />
                    </a>
                  )}
                </span>
              </li>
            ))}
            <li className="pt-1 text-[9px] text-silver">iTunes top songs · India</li>
          </ul>
        )
      ) : basket ? (
        <div className="px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-semibold text-ink">{basket.name}</span>
            <span className={`font-mono text-[15px] font-medium tabular-nums ${deltaClass(basket.changePct)}`}>
              {signedPct(basket.changePct)}
            </span>
          </div>
          <p className="mt-0.5 text-[9.5px] leading-snug text-fog">{basket.blurb}</p>
          <ul className="flip-stagger mt-1.5">
            {basket.constituents.map((c) => (
              <AssetPopover
                key={c.symbol}
                symbol={c.symbol}
                onOpenChange={(open) => hold(open ? 60_000 : 3_000)}
                render={
                  <li
                    role="button"
                    tabIndex={0}
                    className="pressable flex cursor-pointer items-baseline justify-between border-b border-ash py-[3px] transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60"
                  >
                    <span className="font-mono text-[10.5px] text-charcoal">{c.symbol}</span>
                    <span className={`font-mono text-[10px] tabular-nums ${deltaClass(c.changePct)}`}>{signedPct(c.changePct)}</span>
                  </li>
                }
              />
            ))}
            {basket.constituents.length === 0 && <li className="py-2 text-[10.5px] text-fog">Accumulating sessions…</li>}
          </ul>
          <p className="pt-1 text-[9px] text-silver">Equal-weight 1D basket · not a real index · definitely not advice</p>
        </div>
      ) : null}
      </FlipView>
      </div>
    </Tile>
  );
}
