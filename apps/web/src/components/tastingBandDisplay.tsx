import {
  getTastingBandById,
  type TastingBandId,
} from "@peated/server/constants";

export default function TastingBandDisplay({
  ratingBand,
}: {
  ratingBand: TastingBandId;
}) {
  const item = getTastingBandById(ratingBand);
  return (
    <span className="font-medium">
      {item.label}{" "}
      <span className="text-muted">
        ({item.min}–{item.max})
      </span>
    </span>
  );
}
