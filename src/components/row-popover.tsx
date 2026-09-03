"use client";

import { useRef, type ReactNode } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";

/**
 * Detached details popover for `<table>` rows: `<tbody>` may only
 * contain `<tr>`, so a per-row trigger (with its hidden focus guards)
 * breaks hydration. Instead the row sets itself as the anchor via
 * onClick and this single popover opens against it.
 *
 * The consumer clears anchor and children together on close — but the
 * popup stays mounted through its exit transition, so both are retained
 * here for the closing pass: the card shrinks toward the row it came
 * from with its content still visible, never as an empty shell at the
 * viewport corner.
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
  const lastAnchor = useRef<HTMLElement | null>(null);
  const lastChildren = useRef<ReactNode>(null);
  if (anchor !== null) {
    lastAnchor.current = anchor;
    lastChildren.current = children;
  }
  return (
    <Popover
      open={anchor !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverContent anchor={anchor ?? lastAnchor.current} align="start" className="p-0">
        {children ?? lastChildren.current}
      </PopoverContent>
    </Popover>
  );
}
