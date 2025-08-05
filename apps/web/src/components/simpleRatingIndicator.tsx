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

  if (rating === "savor") {
    return (
      <div
        className={classNames("inline-flex gap-0.5", className)}
        title={title}
      >
        <HandThumbUpIcon className="h-4 w-4" />
        <HandThumbUpIcon className="h-4 w-4" />
      </div>
    );
  }

  const Icon = rating === "pass" ? HandThumbDownIcon : HandThumbUpIcon;

  return <Icon className={classNames("h-4 w-4", className)} title={title} />;
}
