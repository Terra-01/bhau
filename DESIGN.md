# Design Language — Bhau

**Base system:** Dub ([design/dub-reference.md](design/dub-reference.md)) — adopted wholesale: palette, type scale, spacing, radii, border-first elevation, pill architecture, do's/don'ts. This file records only the *direction decision*, the *deltas*, and the *product-specific extensions*. When in doubt: the reference wins for generic UI; this file wins for anything market- or agent-specific.

## Direction

**The morning broadsheet, not another dark terminal.** Every trading product is dark-mode neon (TradingView, every crypto dashboard, Bloomberg itself). Bhau is light, printed, and hairline-bordered — because the product's rhythm is daily-at-close (an edition, not a tape) and because printed-document aesthetics read as *trustworthy*, which is the entire brand (receipts, append-only log, published methodology). Light is the identity, not the default.

- **Light is the identity.** The default theme, executed well.
- **Dark is a designed variant** (since v1.1): a toggle, not an inversion — its own palette lives in `globals.css` under `[data-theme="dark"]` (blue-black canvas, warm off-white ink, brightened accents; the Value agent flips to a light neutral). Every component styles through tokens, so both themes resolve from one set.
- This supersedes the "dark-first war room at night" line that briefly lived in CONCEPT.md §6.

## Fonts & sourcing

| Role | Face | Source | Rules |
|---|---|---|---|
| Display (36–48px only) | Satoshi 500 | Fontshare (free ITF license), self-hosted via `next/font/local` | Weight 500 is the signature — never bold. Fallback: Inter 500, `letter-spacing: -0.02em` |
| Body / UI | Inter 400/500/600 | `next/font/google` | 16px/1.5 canonical body; 14px dense data; 11–12px micro-labels |
| Numbers / code / metadata | Geist Mono 400/500 | `geist` npm package | See "Numbers" below. Fallback: JetBrains Mono |

## Extension tokens (not in the Dub reference)

Dub has no red and no semantic market colors — a finance product needs them. All values stay in the same Tailwind-derived family as the base palette.

```css
/* Market semantics — numeric values, deltas, and status badges ONLY. Never surfaces. */
--color-gain: #16a34a;        /* reuses Vivid Green */
--color-gain-wash: #dcfce7;   /* reuses Soft Mint — badge backgrounds */
--color-loss: #dc2626;
--color-loss-wash: #fee2e2;
--color-warn: #d97706;
--color-warn-wash: #fef3c7;

/* Agent identity — identity elements ONLY (pill dot, avatar ring, card keyline, chart series) */
--agent-macro: #2563eb;       /* Electric Blue — top-down, systemic */
--agent-momentum: #ea580c;    /* Tangerine — heat, chase */
--agent-contrarian: #7c3aed;  /* Lavender — against the grain */
--agent-value: #262626;       /* Graphite — old-money monochrome; also avoids colliding with gain-green */

/* Regime scale — the dial and the map tint ONLY */
--regime-1-calm: #16a34a;
--regime-2-steady: #84cc16;
--regime-3-watchful: #eab308;
--regime-4-strained: #ea580c;
--regime-5-stressed: #dc2626;
```

**The separation rule (most important rule in this file):** identity colors never touch P&L numbers; semantic colors never mark identity. An agent is *blue*; its profit is *green*. If a component seems to need both, the number carries the semantic color and the identity stays on the pill/dot/keyline.

## Numbers

- **Every numeral on a market surface is Geist Mono** with `font-variant-numeric: tabular-nums` — prices, P&L, quantities, timestamps, hashes. Inter never sets market numbers.
- **₹ values use Indian digit grouping**: ₹10,00,000 — never ₹1,000,000. Lakh/crore abbreviations (₹10L, ₹1.2Cr) allowed in dense contexts.
- **P&L is always signed** (+/−, true minus U+2212) and colored (gain/loss). Color is never the only encoding — the sign carries it for accessibility.
- Percentages to 2dp; index levels to 2dp; timestamps `HH:MM IST` in mono.

## Component mappings (Floor-specific)

- **Scoreboard card** = Dashboard Card (white, 1px Ash, 12px radius). Rank in mono, agent name with identity dot, equity at 24px Geist Mono 500, day/total deltas signed + semantic, ink sparkline. **The Nifty 50 TRI benchmark appears as a row inside the ranking** — Paper Mist background, dashed Ash border, Fog text: present, unmissable, visually "not a player."
- **Decision log row** = Dashboard Table Row (1px Ash bottom border). Timestamp mono Fog · identity dot · action badge · instrument in mono · thesis in Inter 15/1.5 · hash chip (mono 11px, pill radius, Paper Mist fill). Theses render as quoted text with a 2px identity-colored left rule.
- **Action badges** (pill, 9999px): BUY = Gain Wash + gain dot · SELL = Loss Wash + loss dot · HOLD/NO TRADE = Paper Mist + Fog text · PENDING FILL = Warn Wash · FILLED = Gain Wash.
- **Regime dial** = horizontal 5-segment strip in the regime scale with an ink needle + mono value chip. Segments at full saturation only in the strip; anywhere else regime appears as a tinted wash.
- **Charts**: Charcoal ink lines on white, Ash gridlines, area fills ≤8% opacity, endpoint dot emphasized. **Benchmark is always Fog + dashed.** Agent colors appear only when comparing agents. Never red/green candles-style theming on the equity race — the race is ink; the deltas are semantic.
- **Map** (war room, Phase 2): light monochrome "rice paper" basemap — Canvas land, Paper Mist water, Ash admin borders. Data layers use the accent vocabulary sparingly; regime tint at low opacity. The map obeys the same palette as the UI — no satellite/dark styles.
- **War room panels** = Dashboard Cards in a grid with 8px gaps. Panel headers: Inter 600 12px uppercase, Steel, `letter-spacing: 0.05em`, Ash hairline below. Panel chrome stays quieter than panel data.
- **One committed CTA per surface** (near-black fill, per the reference); Electric Blue stays a highlight — links, active states, the Macro agent — never a surface.

## Do / Don't deltas

**Do**
- Treat every published surface (site, OG share cards, methodology page) as an *edition* — dateline, masthead rules, mono metadata. The dotted-grid background texture from the reference is our blueprint-paper signature; keep it ≤5% opacity.
- Use the disclaimer line ("Paper capital only · Not investment advice") as a designed footer element — mono, Fog, always present, never hidden in fine print.

**Don't**
- No dark surfaces in v1. No glow, no neon, no gradients on UI (conic spectrum stays brand-only, if we ever use it).
- No red/green as surface colors — washes on badges and the regime strip only.
- Don't let Electric Blue near P&L numbers, and don't let gain-green near the Value agent's identity elements.
- Don't invent radii, spacing steps, or type sizes outside the reference vocabulary.

## Verification

Style tile (this language applied to the scoreboard, decision log, badges, regime strip, and type): see the published sample — regenerate it whenever tokens change. When we start building real components, `emil-design-eng` governs interaction polish on top of this system.
