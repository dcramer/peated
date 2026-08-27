import { getTastingBand } from "@peated/server/constants";
import classNames from "../lib/classNames";

export default function ReviewScoreDisplay({
  score,
  count,
  showBand = true,
  className,
}: {
  score: number;
  count?: number;
  showBand?: boolean;
  className?: string;
}) {
  const band = getTastingBand(score);

  return (
    <span
      className={classNames(
        "inline-flex flex-wrap items-baseline gap-x-1",
        className,
      )}
    >
      <span className="font-semibold">{score} points</span>
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
