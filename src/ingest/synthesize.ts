import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BriefingPack } from "./briefing";

// The desk's own read: one synthesis call per day turning the pack into
// 3-5 "what matters" bullets. Distinct from the agents' persona-flavored
// marketReads — this is the intelligence layer, not the show.
const SynthesisSchema = z.object({
  headline: z.string().describe("One sentence: the single most important thing about today's session."),
  bullets: z
    .array(
      z.object({
        text: z
          .string()
          .describe("One connected observation with the specific numbers that carry it. 1-2 sentences, ≤40 words. No hedging filler."),
        tone: z.enum(["risk", "constructive", "neutral"]),
      }),
    )
    .describe("4 to 7 bullets, most important first, each earning its place with a number."),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

const SYSTEM = `You are the desk analyst for Bhau, an Indian-market intelligence dashboard. From the briefing pack, produce the day's synthesis: what actually matters for Indian markets, ranked. Connect signals across streams (flows vs. price, policy vs. sectors, global vs. local) rather than restating headlines. The pack's "evidence" block (flows, rates, mood, commodities, forex, breadth, sectors, street, calendar) is measured data - cite it by number. Be specific — name numbers, names, and directions. Never give investment advice or price targets; describe, connect, and flag. No hindsight vocabulary.`;

export async function synthesize(pack: BriefingPack): Promise<Synthesis | null> {
  if (!process.env.OPENAI_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6-luna",
    input: [
      { role: "system", content: SYSTEM },
      // the quant sheet is for the agents, not the desk synthesis
      { role: "user", content: JSON.stringify({ ...pack, quant: undefined }, null, 1) },
    ],
    text: { format: zodTextFormat(SynthesisSchema, "synthesis") },
  });
  return response.output_parsed ?? null;
}
