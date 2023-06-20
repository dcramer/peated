import { StarIcon } from "@heroicons/react/20/solid";
import classNames from "../lib/classNames";

type RatingSize = "small" | "medium";

type Props = {
  value: number;
  size: RatingSize;
  className?: string;
};

export const StaticRating = ({ value, size, className }: Props) => {
  return (
    <div
      className={classNames(
        "rating",
        size === "small" ? "rating-sm" : "",
        className,
      )}
    >
      {[5, 4, 3, 2, 1].map((item) => {
        return [
          <div
            key={item}
            className={classNames(
              "rating-half-2",
              value >= item ? "text-highlight" : "text-slate-600",
            )}
          >
            <StarIcon className="h-full" />
          </div>,
          <div
            key={item - 0.5}
            className={classNames(
              "rating-half-1",
              value >= item - 0.5 ? "text-highlight" : "text-slate-600",
            )}
          >
            <StarIcon className="h-full" />
          </div>,
        ];
      })}
    </div>
  );
};
