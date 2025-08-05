import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid";
import BottleIcon from "@peated/web/assets/bottle.svg";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import classNames from "../lib/classNames";
import {
  SIMPLE_RATING_LABELS,
  SIMPLE_RATING_VALUES,
  type SimpleRatingValue,
} from "../lib/constants";

type RatingValue = SimpleRatingValue;

type Props = {
  value: RatingValue;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
};

const ratingConfig = {
  [SIMPLE_RATING_VALUES.PASS]: {
    label: SIMPLE_RATING_LABELS[SIMPLE_RATING_VALUES.PASS],
    icon: HandThumbDownIcon,
    className: "",
    isDouble: false,
  },
  [SIMPLE_RATING_VALUES.SIP]: {
    label: SIMPLE_RATING_LABELS[SIMPLE_RATING_VALUES.SIP],
    icon: HandThumbUpIcon,
    className: "",
    isDouble: false,
  },
  [SIMPLE_RATING_VALUES.SAVOR]: {
    label: SIMPLE_RATING_LABELS[SIMPLE_RATING_VALUES.SAVOR],
    icon: HandThumbUpIcon,
    className: "",
    isDouble: true,
  },
};

const sizeConfig = {
  small: "h-4 w-4",
  medium: "h-5 w-5",
  large: "h-6 w-6",
};

export default function SimpleRatingDisplay({
  value,
  showLabel = false,
  size = "medium",
  className,
}: Props) {
  const config = ratingConfig[value];

  if (!config) {
    return null;
  }

  return (
    <div
      className={classNames(
        "inline-flex items-center gap-1",
        config.className,
        className,
      )}
      title={config.label}
    >
      <div className="flex items-center gap-1">
        <config.icon className={sizeConfig[size]} />
        {config.isDouble && <config.icon className={sizeConfig[size]} />}
      </div>
      {showLabel && <span className="font-medium">{config.label}</span>}
    </div>
  );
}
