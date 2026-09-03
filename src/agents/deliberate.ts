import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefingPack } from "@/ingest/briefing";
import { systemPrompt, type Persona } from "./personas";
import { NIFTY100, ETF_WHITELIST } from "./universe";
import type { AgentBook, ProposedDecision } from "./rulebook";

// One deliberation call per agent per day. Structured output via
// responses.parse so a malformed decision is a parse failure, not a trade.
// The model provider is deliberately isolated to this one file.
const DeliberationSchema = z.object({
  marketRead: z
    .string()
    .describe("Your 2-4 sentence read of today's session and what it changes for your book. In your voice."),
  decisions: z.array(
    z.object({
      action: z.enum(["BUY", "SELL"]),
      symbol: z.string().describe("Exact NSE symbol from the tradeable universe."),
      allocationPct: z
        .number()
        .nullable()
        .describe("BUY only: % of current equity to deploy (max 20). Null for SELL."),
      fraction: z
        .number()
        .nullable()
        .describe("SELL only: fraction of the position to exit, 0-1. Null for BUY."),
      invalidation: z
        .object({
          level: z.number().describe("The closing price that falsifies the thesis."),
          direction: z.enum(["below", "above"]).describe('Must be "below" for this long-only book — a close below the level falsifies a long thesis.'),
        })
        .nullable()
        .describe("REQUIRED on every BUY (the rulebook rejects a BUY without one, or with level ≤ 0). Must be null for SELL."),
      thesis: z
        .string()
        .describe("The published thesis: specific and falsifiable, in your voice. Public, verbatim, before the outcome."),
    }),
  ),
  watchlist: z
    .array(
      z.object({
        symbol: z.string().describe("Exact NSE symbol from the tradeable universe."),
        trigger: z.string().describe("The specific condition (a level, a signal) that would make you act."),
      }),
    )
    .nullable()
    .describe("Up to 3 names you are watching — a pass with a watchlist is a testable prediction. Null if none."),
  noTradeReason: z
    .string()
    .nullable()
    .describe("If decisions is empty: why sitting out is the right call today."),
  noTradeTrigger: z
    .string()
    .nullable()
    .describe(
      "If decisions is empty: the specific, falsifiable condition (a level, a signal, a threshold) that would put you in the market. Published verbatim.",
    ),
});

export interface WatchEntry {
  symbol: string;
  trigger: string;
}

export interface Deliberation {
  marketRead: string;
  proposals: ProposedDecision[];
  watchlist?: WatchEntry[];
  noTradeReason?: string;
  /** The published condition that would flip a NO_TRADE into a position. */
  noTradeTrigger?: string;
}

const MODEL = "gpt-5.6-luna";

export function isMockMode(): boolean {
  return process.env.FLOOR_MOCK === "1";
}

export function hasModelKey(): boolean {
  return Boolean(process.env.OPENAI_KEY);
}

/**
 * The persona's briefing: news filtered to its diet, evidence sections
 * serialized in ITS attention order (JSON preserves insertion order), the
 * rest appended after — everyone sees everything, ordered differently.
 */
function briefingFor(pack: BriefingPack, persona: Persona) {
  const news: BriefingPack["news"] = {};
  for (const category of persona.diet) {
    if (pack.news[category]) news[category] = pack.news[category];
  }
  const sections: Record<string, unknown> = {};
  const available: Record<string, unknown> = { quant: pack.quant, ...(pack.evidence ?? {}) };
  for (const key of persona.hierarchy) {
    if (available[key] !== undefined) sections[key] = available[key];
  }
  for (const [key, value] of Object.entries(available)) {
    if (!(key in sections) && value !== undefined) sections[key] = value;
  }
  return { date: pack.date, regime: pack.regime, ...sections, markets: pack.markets, deskSynthesis: pack.synthesis, news };
}

export async function deliberate(
  persona: Persona,
  pack: BriefingPack,
  book: AgentBook,
  equity: number,
  recentDecisions: unknown[],
  mirror: unknown,
  colleagues?: unknown,
): Promise<Deliberation> {
  if (isMockMode()) {
    return {
      marketRead: "Mock deliberation — pipeline test only, no view formed.",
      proposals: [],
      noTradeReason: "FLOOR_MOCK is set; no model was consulted.",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
  const userContent = JSON.stringify(
    {
      briefing: briefingFor(pack, persona),
      yourBook: { cash: book.cash, equity, positions: book.positions },
      yourMirror: mirror,
      ...(colleagues !== undefined ? { colleaguesLatest: colleagues } : {}),
      yourRecentDecisions: recentDecisions,
      tradeableUniverse: { nifty100: NIFTY100, etfs: ETF_WHITELIST },
    },
    null,
    1,
  );

  const response = await client.responses.parse({
    model: MODEL,
    input: [
      { role: "system", content: systemPrompt(persona) },
      { role: "user", content: userContent },
    ],
    text: { format: zodTextFormat(DeliberationSchema, "deliberation") },
  });

  if (!response.output_parsed) {
    return {
      marketRead: "",
      proposals: [],
      noTradeReason: `deliberation produced no valid decision (status: ${response.status})`,
    };
  }

  const out = response.output_parsed;
  return {
    marketRead: out.marketRead,
    proposals: out.decisions.map((d) => ({
      action: d.action,
      symbol: d.symbol.toUpperCase().trim(),
      allocationPct: d.allocationPct ?? undefined,
      fraction: d.fraction ?? undefined,
      invalidation: d.invalidation ?? undefined,
      thesis: d.thesis,
    })),
    watchlist: out.watchlist?.slice(0, 3).map((w) => ({ symbol: w.symbol.toUpperCase().trim(), trigger: w.trigger })),
    noTradeReason: out.noTradeReason ?? undefined,
    noTradeTrigger: out.noTradeTrigger ?? undefined,
  };
}

const LetterSchema = z.object({
  letter: z
    .string()
    .describe("Your public weekly letter: 3-6 sentences in your voice — what you did, what you got wrong, what you watch next week."),
});

/** Letter-specific system prompt: identity + voice + honesty — no briefing,
 *  no decision rules, so the letter never apologises for a pack it wasn't sent. */
function letterPrompt(persona: Persona): string {
  return `You are ${persona.codename} — ${persona.role}, one of four AI agents in Bhau, a public, radically transparent paper-trading experiment on Indian markets. ${persona.codename} is an abstract persona, not a person: never claim to be human. The capital is paper; nothing you write is investment advice.

Your mandate: ${persona.mandate}

Your voice (all published text is written in it): ${persona.voice}

Task: your public weekly letter — 3-6 sentences reviewing your week from the mirror and decisions provided. Honest about what you got wrong, specific about what you watch next; no hedging mush, no hindsight vocabulary, no new trade decisions. It is published verbatim and permanently.`;
}

/** The Friday letter: one small call, published as a ledger NOTE. */
export async function weeklyLetter(persona: Persona, mirror: unknown, weekDecisions: unknown[]): Promise<string | null> {
  if (isMockMode() || !hasModelKey()) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
  const response = await client.responses.parse({
    model: MODEL,
    input: [
      { role: "system", content: letterPrompt(persona) },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Write your public weekly letter reviewing this week. Honest about mistakes; no hindsight vocabulary; your voice.",
            yourMirror: mirror,
            thisWeeksDecisions: weekDecisions,
          },
          null,
          1,
        ),
      },
    ],
    text: { format: zodTextFormat(LetterSchema, "weekly_letter") },
  });
  return response.output_parsed?.letter ?? null;
}
