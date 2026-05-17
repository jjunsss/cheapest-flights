import type { RankedFlight } from "./ranking.js";

export interface GenerateReportInput {
  origin: string;
  destination: string;
  generatedAt: string;
  flights: RankedFlight[];
}

export function generateReport(input: GenerateReportInput): string {
  const lines = [
    `# ${input.origin} -> ${input.destination} flight search`,
    "",
    `Generated at: ${input.generatedAt}`,
    "",
    "| Rank | Flight | Carrier | Price | Stops | Duration | Booking |",
    "| ---: | --- | --- | ---: | ---: | ---: | --- |"
  ];

  for (const flight of input.flights) {
    lines.push(
      `| ${flight.rank} | ${flight.flightNumber} | ${flight.carrier} | ${formatNumber(
        flight.convertedTotalPrice
      )} ${flight.convertedCurrency} | ${flight.stops} | ${flight.durationMinutes}m | ${flight.bookingUrl} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
