import type { EventKind } from "./types";

export interface FeedDef {
  id: string; // short slug, unique across feeds
  name: string;
  category: string; // war-room panel this feeds (markets | policy | economy | corporate)
  kind: EventKind;
  url: string;
}

const gnews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;

/**
 * v1 news backbone (CONCEPT.md §5): Google News RSS site/topic queries plus
 * native RSS where a publisher/regulator offers one. Every feed is assumed
 * to break eventually — keep each entry independently removable.
 */
export const FEEDS: FeedDef[] = [
  // Markets
  { id: "et-markets", name: "ET Markets", category: "markets", kind: "news", url: gnews("site:economictimes.indiatimes.com markets when:1d") },
  { id: "moneycontrol", name: "Moneycontrol", category: "markets", kind: "news", url: gnews("site:moneycontrol.com markets when:1d") },
  { id: "mint-markets", name: "Mint Markets", category: "markets", kind: "news", url: gnews("site:livemint.com market when:1d") },
  { id: "ndtv-profit", name: "NDTV Profit", category: "markets", kind: "news", url: gnews("site:ndtvprofit.com when:1d") },
  { id: "businessline", name: "BusinessLine", category: "markets", kind: "news", url: gnews("site:thehindubusinessline.com markets when:1d") },

  // RBI / policy
  { id: "rbi-press", name: "RBI Press Releases", category: "policy", kind: "policy", url: "https://www.rbi.org.in/pressreleases_rss.xml" },
  { id: "rbi-news", name: "RBI Watch", category: "policy", kind: "policy", url: gnews('"RBI" OR "Reserve Bank of India" when:1d') },
  { id: "sebi-news", name: "SEBI Watch", category: "policy", kind: "policy", url: gnews('"SEBI" regulation OR circular OR order when:2d') },

  // Macro / economy
  { id: "india-macro", name: "India Macro", category: "economy", kind: "macro", url: gnews('India (CPI OR inflation OR GDP OR IIP OR "trade deficit" OR PMI) when:2d') },
  { id: "fii-dii-news", name: "FII/DII Flows", category: "markets", kind: "news", url: gnews('India ("FII" OR "FPI" OR "DII") (bought OR sold OR flows) when:2d') },

  // Corporate
  { id: "corporate-news", name: "Corporate India", category: "corporate", kind: "news", url: gnews('India (earnings OR results OR acquisition OR "order win") NSE OR BSE when:1d') },
];
