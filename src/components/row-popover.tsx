"use client";

import type { ReactNode } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";

/**
 * Detached details popover for `<table>` rows: `<tbody>` may only
 * contain `<tr>`, so a per-row trigger (with its hidden focus guards)
 * breaks hydration. Instead the row sets itself as the anchor via
 * onClick and this single popover opens against it.
 */
export function RowPopover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Popover
      open={anchor !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverContent anchor={anchor} align="start" className="p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}
