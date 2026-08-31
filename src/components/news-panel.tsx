import type { BriefingPack } from "@/ingest/briefing";
import { timeIST } from "@/lib/format";
import { Panel } from "./panel";

type NewsItem = BriefingPack["news"][string][number];

export function NewsPanel({
  title,
  items,
  meta,
}: {
  title: string;
  items: NewsItem[];
  meta?: string;
}) {
  return (
    <Panel title={title} meta={meta}>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-fog">Nothing in this stream yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.source}-${item.title}`} className="border-b border-ash last:border-b-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper"
              >
                <p className="text-[13px] leading-snug text-charcoal line-clamp-2">{item.title}</p>
                <p className="mt-1 font-mono text-[10.5px] text-fog">
                  {item.source.replace("gnews:", "")} · {timeIST(new Date(item.ts))} IST
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
