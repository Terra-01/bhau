import { getExchangeData } from "@/lib/exchange";
import { Calendars } from "./calendars";
import { Economy } from "./economy";
import { ForexMatrix } from "./forex-matrix";
import { IndicesHero } from "./indices-hero";
import { Section } from "./section";
import { EtfRow, StocksGrid } from "./stocks-grid";

export async function ExchangeSections() {
  const data = await getExchangeData();
  return (
    <div className="flex flex-col pb-4">
      <Section
        id="indices"
        title="Indices"
        fresh={`EOD · ${data.asOf}`}
        seeAll={{ href: "https://www.nseindia.com/market-data/live-market-indices", label: "All indices on NSE" }}
      >
        <IndicesHero indices={data.indices} history={data.indicesHistory} />
      </Section>

      <Section
        id="stocks"
        title="Stocks"
        fresh={`EOD · ${data.asOf} · FULL NSE UNIVERSE`}
        seeAll={{ href: "https://www.nseindia.com/market-data/top-gainers-losers", label: "Movers on NSE" }}
      >
        <StocksGrid data={data} />
        <div className="mt-2">
          <EtfRow etfs={data.etfs} />
        </div>
      </Section>

      <Section id="forex" title="Forex vs INR" fresh="ECB REFERENCE · DAILY">
        <ForexMatrix forex={data.forex} />
      </Section>

      <Section id="calendars" title="Calendars" fresh="NSE + CURATED SCHEDULE">
        <Calendars data={data} />
      </Section>

      <Section
        id="economy"
        title="Economy"
        fresh="WORLD BANK · ANNUAL"
        seeAll={{ href: "https://data.worldbank.org/country/IN", label: "All indicators" }}
      >
        <Economy economy={data.economy} />
      </Section>
    </div>
  );
}
