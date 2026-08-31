import type { WarRoomData } from "@/lib/warroom";
import { Tile } from "./tile";

const TONE_COLOR: Record<string, string> = {
  risk: "var(--color-loss)",
  constructive: "var(--color-gain)",
  neutral: "var(--color-silver)",
};

export function BriefTile({ synthesis }: { synthesis: WarRoomData["synthesis"] }) {
  return (
    <Tile title="What matters" meta="DESK SYNTHESIS" scroll>
      {synthesis ? (
        <div className="px-3 py-2">
          <p className="text-[12.5px] font-medium leading-snug text-ink">{synthesis.headline}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {synthesis.bullets.map((b) => (
              <li key={b.text} className="flex gap-1.5 text-[11px] leading-snug text-steel">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[b.tone] }} />
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-3 py-4 text-[11.5px] text-fog">Synthesis lands with the evening pipeline run.</p>
      )}
    </Tile>
  );
}
