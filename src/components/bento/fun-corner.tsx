"use client";

import { Music } from "lucide-react";
import { FlipView } from "@/components/motion/flip-view";
import type { ExchangeData } from "@/lib/exchange";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { useCarousel } from "@/lib/use-carousel";
import { Tile } from "../tiles/tile";

// The fun corner: trending songs + the famous tongue-in-cheek recession
// indicators, computed for real from listed names.
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
  const { index, select, pauseProps } = useCarousel(tabs.length, 23_000);
  const tab = tabs[index]?.id ?? "songs";
  const basket = baskets.find((b) => b.id === tab);

  return (
    <Tile
      title="Off the tape"
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
          <ul className="px-2.5 py-1">
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
                  {song.url ? (
                    <a href={song.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[11px] font-medium text-charcoal [@media(hover:hover)]:hover:underline">
                      {song.title}
                    </a>
                  ) : (
                    <span className="block truncate text-[11px] font-medium text-charcoal">{song.title}</span>
                  )}
                  <span className="block truncate text-[9.5px] text-fog">{song.artist}</span>
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
          <ul className="mt-1.5">
            {basket.constituents.map((c) => (
              <li key={c.symbol} className="flex items-baseline justify-between border-b border-ash py-[3px] last:border-b-0">
                <span className="font-mono text-[10.5px] text-charcoal">{c.symbol}</span>
                <span className={`font-mono text-[10px] tabular-nums ${deltaClass(c.changePct)}`}>{signedPct(c.changePct)}</span>
              </li>
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
