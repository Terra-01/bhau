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
    .describe("Your 2-4 sentence read of today's session and what it changes for your book."),
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
      thesis: z
        .string()
        .describe("The published thesis: specific and falsifiable. This is public, verbatim, before the outcome."),
    }),
  ),
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

export interface Deliberation {
  marketRead: string;
  proposals: ProposedDecision[];
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

function dietFilteredPack(pack: BriefingPack, persona: Persona) {
  const news: BriefingPack["news"] = {};
  for (const category of persona.diet) {
    if (pack.news[category]) news[category] = pack.news[category];
  }
  // The diet filters news, not market data — every persona sees the quant
  // sheet (price evidence for the whole universe).
  return { date: pack.date, regime: pack.regime, markets: pack.markets, quant: pack.quant, news };
}

export async function deliberate(
  persona: Persona,
  pack: BriefingPack,
  book: AgentBook,
  equity: number,
  recentDecisions: unknown[],
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
      briefing: dietFilteredPack(pack, persona),
      yourBook: { cash: book.cash, equity, positions: book.positions },
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
      thesis: d.thesis,
    })),
    noTradeReason: out.noTradeReason ?? undefined,
    noTradeTrigger: out.noTradeTrigger ?? undefined,
  };
}
