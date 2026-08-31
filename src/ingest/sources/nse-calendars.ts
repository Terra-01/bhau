import { createHash } from "node:crypto";
import { parseNseDate } from "./nse-indices";
import { USER_AGENT, type Fetcher, type IngestEvent, type SourceResult } from "../types";

// NSE corporate calendars → events of kind "calendar": board meetings
// (earnings when the purpose says results) and IPO issues. Same cookie
// dance, same isolation.
interface BoardMeeting {
  symbol?: string;
  company?: string;
  purpose?: string;
  bm_desc?: string;
  date?: string; // "02-Sep-2026"
}

interface IpoIssue {
  symbol?: string;
  companyName?: string;
  issueStartDate?: string;
  issueEndDate?: string;
  issuePrice?: string; // "Rs.168 to Rs.177"
  issueSize?: string;
  status?: string; // Active | Upcoming | ...
  series?: string;
}

const HEADERS = {
  "user-agent": USER_AGENT,
  accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

function calEvent(
  calType: "earnings" | "ipo",
  key: string,
  date: string,
  title: string,
  payload: Record<string, unknown>,
): IngestEvent {
  const source = "nse-cal";
  return {
    ts: new Date(`${date}T09:00:00+05:30`),
    source,
    kind: "calendar",
    title,
    entities: [],
    payload: { calType, date, ...payload },
    hash: createHash("sha256").update(`${source}|${calType}|${key}|${date}`).digest("hex"),
  };
}

export const nseCalendarsFetcher: Fetcher = {
  id: "nse-calendars",
  staleAfterMin: 36 * 60,

  async fetch(): Promise<SourceResult> {
    const warmup = await fetch("https://www.nseindia.com", {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    const cookies = warmup.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const get = async (path: string) => {
      const res = await fetch(`https://www.nseindia.com${path}`, {
        headers: { ...HEADERS, cookie: cookies, referer: "https://www.nseindia.com/" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
      return res.json();
    };

    const events: IngestEvent[] = [];
    const failures: string[] = [];

    try {
      const meetings = (await get("/api/event-calendar")) as BoardMeeting[];
      for (const m of Array.isArray(meetings) ? meetings : []) {
        const date = m.date ? parseNseDate(m.date) : undefined;
        if (!date || !m.symbol) continue;
        const isResults = /result/i.test(`${m.purpose} ${m.bm_desc}`);
        events.push(
          calEvent("earnings", m.symbol, date, `${m.symbol} — ${m.purpose ?? "board meeting"}`, {
            symbol: m.symbol,
            company: m.company,
            purpose: m.purpose,
            isResults,
          }),
        );
      }
    } catch (err) {
      failures.push(`event-calendar: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const issues = (await get("/api/all-upcoming-issues?category=ipo")) as IpoIssue[];
      for (const issue of Array.isArray(issues) ? issues : []) {
        const date = issue.issueStartDate ? parseNseDate(issue.issueStartDate) : undefined;
        const end = issue.issueEndDate ? parseNseDate(issue.issueEndDate) : undefined;
        if (!date || !issue.symbol) continue;
        events.push(
          calEvent("ipo", issue.symbol, date, `${issue.symbol} IPO — ${issue.companyName ?? ""}`, {
            symbol: issue.symbol,
            company: issue.companyName,
            endDate: end,
            priceBand: issue.issuePrice,
            issueSize: issue.issueSize,
            status: issue.status,
            series: issue.series,
          }),
        );
      }
    } catch (err) {
      failures.push(`ipo: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (events.length === 0 && failures.length > 0) {
      throw new Error(`all calendars failed — ${failures.join("; ")}`);
    }
    if (failures.length > 0) console.warn(`[nse-calendars] partial: ${failures.join("; ")}`);
    return { events, bars: [] };
  },
};
