import { getRatingBandById, type RatingBandId } from "@peated/server/constants";

export default function TastingBandDisplay({
  ratingBand,
}: {
  ratingBand: RatingBandId;
}) {
  const item = getRatingBandById(ratingBand);
  return (
    <span className="font-medium">
      {item.label}{" "}
      <span className="text-muted">
        ({item.min}–{item.max})
      </span>
    </span>
  );
}
