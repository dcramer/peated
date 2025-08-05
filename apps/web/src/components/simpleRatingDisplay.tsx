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
    icon: "🚫",
    className: "text-red-600",
  },
  [1]: {
    label: "Sip",
    icon: "🥃",
    className: "text-yellow-600",
  },
  [2]: {
    label: "Savor",
    icon: "🥃🥃",
    className: "text-green-600",
  },
};

const sizeConfig = {
  small: "text-base",
  medium: "text-xl",
  large: "text-2xl",
};

export default function SimpleRatingDisplay({
  value,
  showLabel = false,
  size = "medium",
  className,
}: Props) {
  const config = ratingConfig[value];

  if (!config) {
    console.error(`Invalid rating value: ${value}`);
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
      <span className={sizeConfig[size]}>{config.icon}</span>
      {showLabel && <span className="font-medium">{config.label}</span>}
    </div>
  );
}
