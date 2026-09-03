import {
  getBottleIdentityProps,
  type BottleIdentitySource,
} from "@peated/web/lib/bottleListItem";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { Button } from "./button.stylex";

export type SelectedBottleSummaryProps = {
  bottle: BottleIdentitySource & { imageUrl?: string | null };
  imageUrl?: string | null;
  /** Shows a change action when the owning workflow allows bottle selection. */
  onChange?: () => void;
};

/** Keeps the selected bottle visible while a member completes a related form. */
export function SelectedBottleSummary({
  bottle,
  imageUrl,
  onChange,
}: SelectedBottleSummaryProps) {
  return (
    <section aria-label="Selected bottle">
      <BottleIdentityRow
        {...getBottleIdentityProps(bottle)}
        end={
          onChange ? (
            <Button onClick={onChange} size="sm" variant="text">
              Change bottle
            </Button>
          ) : undefined
        }
        imageUrl={imageUrl ?? bottle.imageUrl}
        layout="cell"
      />
    </section>
  );
}
