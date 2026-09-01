import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// A playful consensus read from the day's top 3 trending songs: what's
// the mood of India? One tiny model call, cached per unique chart.
const MoodSchema = z.object({
  label: z.string().describe("One or two words for the mood, e.g. Upbeat, Heartbroken, Festive, Devotional, Nostalgic."),
  emoji: z.string().describe("A single emoji matching the mood."),
  line: z.string().describe("One playful sentence (≤18 words) reading India's mood from these songs. Never advice."),
});

export type SongMood = z.infer<typeof MoodSchema>;

const cache = new Map<string, { at: number; mood: SongMood | null }>();
const TTL_MS = 6 * 60 * 60 * 1000;

export async function readSongMood(songs: Array<{ title: string; artist: string }>): Promise<SongMood | null> {
  if (!process.env.OPENAI_KEY || songs.length === 0) return null;
  const key = songs.map((s) => s.title).join("|");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.mood;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
    const response = await client.responses.parse({
      model: "gpt-5.6-luna",
      input: [
        {
          role: "system",
          content:
            "You read the collective mood of India from its trending songs — playful cultural read, one clear verdict. If you don't recognize a song, infer from its title and artist.",
        },
        { role: "user", content: JSON.stringify(songs) },
      ],
      text: { format: zodTextFormat(MoodSchema, "song_mood") },
    });
    const mood = response.output_parsed ?? null;
    cache.set(key, { at: Date.now(), mood });
    return mood;
  } catch {
    cache.set(key, { at: Date.now(), mood: null });
    return null;
  }
}
