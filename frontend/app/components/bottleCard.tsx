import { Link } from "@remix-run/react";
import type { Bottle } from "~/types";
import classNames from "../lib/classNames";
import { formatCategoryName } from "../lib/strings";
import type { Option } from "./selectField";

type BottleFormData = {
  name: string;
  brand?: Option | null | undefined;
  distillers?: Option[] | null | undefined;
  statedAge?: number | null | undefined;
  category?: string | null | undefined;
};

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { brand } = data;
  return (
    <div className="bg-highlight flex items-center space-x-4 p-3 text-black sm:px-5 sm:py-4">
      <div className="flex-1 space-y-1">
        <h4 className="block max-w-[260px] truncate font-semibold leading-6 sm:max-w-[480px]">
          {data.name}
        </h4>
        <div className="text-sm">{brand ? brand.name : "Unknown Bottle"}</div>
      </div>
      <div className="w-22 flex flex-col items-end space-y-1 whitespace-nowrap text-sm leading-6">
        <p>{data.category ? formatCategoryName(data.category) : null}</p>
        <p>{data.statedAge ? `Aged ${data.statedAge} years` : null}</p>
      </div>
    </div>
  );
};

export default function BottleCard({
  bottle,
  noGutter,
  color,
}: {
  bottle: Bottle;
  noGutter?: boolean;
  color?: "highlight" | "default";
}) {
  return (
    <div
      className={classNames(
        "flex items-center space-x-2 sm:space-x-3",
        color === "highlight"
          ? "bg-highlight text-black"
          : "bg-slate-950 text-white",
        noGutter ? "" : "p-3 sm:px-5 sm:py-4",
      )}
    >
      <div className="flex-1 space-y-1">
        <h4>
          <Link
            to={`/bottles/${bottle.id}`}
            className="block max-w-[260px] truncate font-semibold hover:underline sm:max-w-[480px]"
            title={bottle.fullName}
          >
            {bottle.name}
          </Link>
        </h4>
        <div
          className={classNames(
            "text-sm",
            color === "highlight" ? "" : "text-light",
          )}
        >
          <span className="hidden sm:inline"></span>
          <Link to={`/entities/${bottle.brand.id}`} className="hover:underline">
            {bottle.brand.name}
          </Link>
        </div>
      </div>
      <div
        className={classNames(
          color === "highlight" ? "" : "text-light",
          "flex flex-col items-end space-y-1 whitespace-nowrap text-sm",
        )}
      >
        <p>
          {bottle.category && (
            <Link
              to={`/bottles?category=${bottle.category}`}
              className="hover:underline"
            >
              {formatCategoryName(bottle.category)}
            </Link>
          )}
        </p>
        <p>{bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}</p>
      </div>
    </div>
  );
}
