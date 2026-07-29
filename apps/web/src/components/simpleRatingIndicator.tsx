import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid";
import classNames from "../lib/classNames";

type Props = {
  avgRating: number | null;
  className?: string;
};

export default function SimpleRatingIndicator({ avgRating, className }: Props) {
  if (avgRating === null || avgRating === undefined) {
    return null;
  }

  const title = `Average rating ${avgRating.toFixed(2)}`;
  const fills =
    avgRating < 0
      ? [Math.min(Math.abs(avgRating), 1)]
      : [
          Math.min(Math.max(avgRating, 0), 1),
          Math.min(Math.max(avgRating - 1, 0), 1),
        ];
  const Icon = avgRating < 0 ? HandThumbDownIcon : HandThumbUpIcon;

  return (
    <span
      className={classNames(
        "inline-flex items-center justify-center gap-1",
        className,
      )}
      title={title}
      role="img"
      aria-label={title}
    >
      {fills.map((fill, index) => (
        <span
          key={index}
          className="relative inline-block h-4 w-4 text-slate-600"
          aria-hidden="true"
        >
          <Icon className="absolute inset-0 h-4 w-4" />
          <span
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: `${fill * 100}%` }}
          >
            <Icon className="text-highlight h-4 w-4 max-w-none" />
          </span>
        </span>
      ))}
    </span>
  );
}
