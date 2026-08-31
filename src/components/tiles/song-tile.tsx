import { Music } from "lucide-react";
import type { WarRoomData } from "@/lib/warroom";
import { Tile } from "./tile";

/** The day's soundtrack — iTunes top songs, India. Garnish, on purpose. */
export function SongTile({ songs }: { songs: WarRoomData["songs"] }) {
  return (
    <Tile title="Trending — India" meta="TOP SONGS">
      {!songs || songs.length === 0 ? (
        <p className="px-3 py-3 text-[11.5px] text-fog">Charts unavailable.</p>
      ) : (
        <ul className="flex h-full flex-col justify-center px-2.5 py-1">
          {songs.map((song, i) => (
            <li key={song.title} className="flex items-center gap-2 border-b border-ash py-[4px] last:border-b-0">
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
        </ul>
      )}
    </Tile>
  );
}
