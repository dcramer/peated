import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { Button } from "./button.stylex";

export type SelectedBottleSummaryProps = {
  brand: string;
  imageUrl?: string | null;
  metadata: string;
  name: string;
  /** Shows a change action when the owning workflow allows bottle selection. */
  onChange?: () => void;
};

/** Keeps the selected bottle visible while a member completes a related form. */
export function SelectedBottleSummary({
  brand,
  imageUrl,
  metadata,
  name,
  onChange,
}: SelectedBottleSummaryProps) {
  return (
    <section aria-label="Selected bottle">
      <BottleIdentityRow
        brand={brand}
        end={
          onChange ? (
            <Button onClick={onChange} size="sm" variant="text">
              Change bottle
            </Button>
          ) : undefined
        }
        imageUrl={imageUrl}
        layout="cell"
        metadata={metadata ? metadata.split(" · ") : []}
        name={name}
      />
    </section>
  );
}
