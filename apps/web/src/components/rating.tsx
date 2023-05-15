import { RadioGroup } from "@headlessui/react";
import { StarIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
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

export default ({
  name,
  id,
  onChange,
  required = false,
  ...props
}: {
  id?: string;
  name?: string;
  value?: number | null | undefined;
  onChange?: (value: number) => void;
  required?: boolean;
}) => {
  const [value, setValue] = useState<number>(props.value || 0);

  return (
    <RadioGroup
      id={id}
      {...props}
      onChange={(value) => {
        setValue(value || 0);
        onChange && onChange(value || 0);
      }}
    >
      <div className="rating">
        {[5, 4, 3, 2, 1].map((item) => {
          console.log(value, item);
          return [
            <RadioGroup.Option
              key={item}
              value={item}
              className={({ active, checked }) =>
                classNames(
                  "cursor-pointer",
                  "hover:text-slate-400",
                  "rating-half-2",
                  "peer",
                  "peer-hover:text-highlight",
                  active || checked || value >= item
                    ? "text-highlight"
                    : "text-slate-600",
                )
              }
            >
              <RadioGroup.Label as={StarIcon} className="h-full" />
            </RadioGroup.Option>,
            <RadioGroup.Option
              key={item - 0.5}
              value={item - 0.5}
              className={({ active, checked }) =>
                classNames(
                  "cursor-pointer",
                  "hover:text-slate-400",
                  "rating-half-1",
                  "peer",
                  "peer-hover:text-highlight",
                  active || checked || value >= item - 0.5
                    ? "text-highlight"
                    : "text-slate-600",
                )
              }
            >
              <RadioGroup.Label as={StarIcon} className="h-full" />
            </RadioGroup.Option>,
          ];
        })}
      </div>
    </RadioGroup>
  );
};
