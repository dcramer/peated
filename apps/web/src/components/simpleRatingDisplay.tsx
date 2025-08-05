import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid";
import BottleIcon from "@peated/web/assets/bottle.svg";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import classNames from "../lib/classNames";

type RatingValue = -1 | 1 | 2;

type Props = {
  value: RatingValue;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
};

const ratingConfig = {
  [-1]: {
    label: "Pass",
    icon: HandThumbDownIcon,
    className: "",
    isDouble: false,
  },
  [1]: {
    label: "Sip",
    icon: HandThumbUpIcon,
    className: "",
    isDouble: false,
  },
  [2]: {
    label: "Savor",
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
