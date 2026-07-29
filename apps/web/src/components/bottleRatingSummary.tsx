import classNames from "@peated/web/lib/classNames";
import SimpleRatingIndicator from "./simpleRatingIndicator";

export default function BottleRatingSummary({
  avgRating,
  totalRatings,
  className,
}: {
  avgRating: number | null;
  totalRatings: number;
  className?: string;
}) {
  const hasRating = totalRatings > 0 && avgRating !== null;

  return (
    <div
      className={classNames(
        "flex shrink-0 flex-col items-center justify-center gap-1 self-center text-center",
        className,
      )}
    >
      {hasRating ? (
        <SimpleRatingIndicator avgRating={avgRating} />
      ) : (
        <span className="text-muted leading-4" aria-hidden="true">
          &mdash;
        </span>
      )}
      <span className="text-muted whitespace-nowrap text-xs">
        {totalRatings.toLocaleString()}{" "}
        {totalRatings === 1 ? "rating" : "ratings"}
      </span>
    </div>
  );
}
