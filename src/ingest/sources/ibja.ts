import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// IBJA (India Bullion & Jewellers Association) publishes the national
// benchmark bullion fixes — the rates jewellers and gold loans actually
// reference. Gold 999 is ₹/10g, Silver 999 is ₹/kg. The homepage carries
// a dated history table of PM fixes plus today's AM/PM labels; the AM fix
// is provisional and is overwritten by the PM row on the next run.

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const ibjaFetcher: Fetcher = {
  id: "ibja",
  staleAfterMin: 72 * 60,

  async fetch(): Promise<SourceResult> {
    const res = await fetch("https://ibjarates.com", {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const bars: IngestBar[] = [];
    const seen = new Set<string>();

    // History table rows: dd/mm/yyyy followed by 7 rate cells
    // (999, 995, 916, 750, 585, silver 999, platinum 999).
    const tokens = html
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const dm = tokens[i].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!dm) continue;
      const nums = tokens.slice(i + 1, i + 8).map(Number);
      if (nums.length < 7 || nums.some((n) => !Number.isFinite(n))) continue;
      const date = `${dm[3]}-${dm[2]}-${dm[1]}`;
      if (seen.has(date)) continue;
      seen.add(date);
      bars.push({ date, symbol: "GOLD999", close: nums[0], source: "ibja" });
      bars.push({ date, symbol: "SILVER999", close: nums[5], source: "ibja" });
    }

    // Today's fix (PM preferred, AM provisional) — only when the history
    // table hasn't already published today's row.
    const today = todayIST();
    if (!seen.has(today)) {
      const label = (id: string) => {
        const m = html.match(new RegExp(`id="${id}"[^>]*>\\s*(\\d{4,7})\\s*<`));
        return m ? Number(m[1]) : undefined;
      };
      const gold = label("lblGold999_PM") ?? label("lblGold999_AM");
      const silver = label("lblSilver999_PM") ?? label("lblSilver999_AM");
      if (gold) bars.push({ date: today, symbol: "GOLD999", close: gold, source: "ibja" });
      if (silver) bars.push({ date: today, symbol: "SILVER999", close: silver, source: "ibja" });
    }

    if (bars.length === 0) throw new Error("no fixes parsed — page layout changed?");
    return { events: [], bars };
  },
};
