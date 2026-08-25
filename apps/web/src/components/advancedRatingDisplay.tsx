import { getAdvancedRatingBand } from "@peated/server/constants";
import classNames from "../lib/classNames";

export default function AdvancedRatingDisplay({
  score,
  count,
  aggregate = false,
  showBand = true,
  className,
}: {
  score: number;
  count?: number;
  aggregate?: boolean;
  showBand?: boolean;
  className?: string;
}) {
  const band = getAdvancedRatingBand(score);

  return (
    <span
      className={classNames(
        "inline-flex flex-wrap items-baseline gap-x-1",
        className,
      )}
    >
      <span className="font-semibold">
        {aggregate ? score.toFixed(1) : score} points
      </span>
      {showBand && band ? (
        <span className="text-muted">· {band.label}</span>
      ) : null}
      {count !== undefined ? (
        <span className="text-muted">
          · {count.toLocaleString()} {count === 1 ? "score" : "scores"}
        </span>
      ) : null}
    </span>
  );
}
