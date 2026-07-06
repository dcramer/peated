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

  // Round the rating: < 0.5 = Pass, 0.5-1.49 = Sip, >= 1.5 = Savor
  let rating: "pass" | "sip" | "savor";
  if (avgRating < 0.5) {
    rating = "pass";
  } else if (avgRating < 1.5) {
    rating = "sip";
  } else {
    rating = "savor";
  }

  const title = `${avgRating.toFixed(2)} - ${
    rating === "pass" ? "Pass" : rating === "sip" ? "Sip" : "Savor"
  }`;

  const Icon = rating === "pass" ? HandThumbDownIcon : HandThumbUpIcon;
  const icons =
    rating === "savor" ? (
      <>
        <HandThumbUpIcon className="h-4 w-4" />
        <HandThumbUpIcon className="h-4 w-4" />
      </>
    ) : (
      <Icon className="h-4 w-4" />
    );

  return (
    <span
      className={classNames(
        "inline-flex items-center justify-center gap-0.5",
        className,
      )}
      title={title}
    >
      {icons}
    </span>
  );
}
