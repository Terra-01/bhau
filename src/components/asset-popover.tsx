"use client";

import type { ReactNode } from "react";
import { AssetCard } from "@/components/asset-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Makes any row open the asset details view on click — the terminal-wide
 * contract: every instrument row is clickable. The row element itself is
 * the trigger (Base UI render prop), so layout is untouched.
 */
export function AssetPopover({
  symbol,
  name,
  onRemove,
  onOpen,
  render,
}: {
  symbol: string;
  name?: string;
  onRemove?: () => void;
  /** Extra side effect on click (e.g. select the row for the chart). */
  onOpen?: () => void;
  /** The row element; it receives the trigger props. */
  render: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        onClick={onOpen}
        render={render as React.ReactElement<Record<string, unknown>>}
      />
      <PopoverContent align="start" className="p-0">
        <AssetCard symbol={symbol} fallbackName={name} onRemove={onRemove} />
      </PopoverContent>
    </Popover>
  );
}
