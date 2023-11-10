import { CheckBadgeIcon, StarIcon } from "@heroicons/react/24/outline";
import type { Bottle } from "@peated/server/types";
import { Link } from "@remix-run/react";
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

function BottleScaffold({
  name,
  category,
  brand,
  statedAge,
  color = "default",
  noGutter = false,
}: {
  name: any;
  category: any;
  brand: any;
  statedAge: any;

  color?: "default" | "highlight";
  noGutter?: boolean;
}) {
  return (
    <div
      className={classNames(
        "flex items-center space-x-2 overflow-hidden sm:space-x-3",
        color === "highlight"
          ? "bg-highlight text-black"
          : "bg-slate-950 text-white",
        noGutter ? "" : "p-3 sm:px-5 sm:py-4",
      )}
    >
      <div className="flex-auto overflow-hidden">
        <h4 className="flex items-center truncate font-semibold">{name}</h4>
        <div
          className={classNames(
            "text-sm",
            color === "highlight" ? "" : "text-light",
          )}
        >
          {category}
        </div>
      </div>
      <div
        className={classNames(
          color === "highlight" ? "" : "text-light",
          "hidden w-[200px] flex-col items-end justify-center whitespace-nowrap text-sm sm:flex",
        )}
      >
        <div className="max-w-full truncate">{brand}</div>
        <div>{statedAge}</div>
      </div>
    </div>
  );
}

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { brand } = data;
  return (
    <BottleScaffold
      name={data.name}
      category={data.category ? formatCategoryName(data.category) : null}
      brand={brand ? brand.name : "Unknown Bottle"}
      statedAge={data.statedAge ? `Aged ${data.statedAge} years` : null}
      color="highlight"
    />
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
    <BottleScaffold
      name={
        <>
          <Link
            to={`/bottles/${bottle.id}`}
            className="block truncate font-semibold hover:underline sm:max-w-[480px]"
            title={bottle.fullName}
          >
            {bottle.fullName}
          </Link>
          {bottle.isFavorite && (
            <StarIcon className="h-auto w-4 lg:w-8" aria-hidden="true" />
          )}
          {bottle.hasTasted && (
            <CheckBadgeIcon className="h-auto w-4 lg:w-8" aria-hidden="true" />
          )}
        </>
      }
      category={
        <div>
          {bottle.category && (
            <Link
              to={`/bottles?category=${bottle.category}`}
              className="hover:underline"
            >
              {formatCategoryName(bottle.category)}
            </Link>
          )}
        </div>
      }
      brand={
        <Link to={`/entities/${bottle.brand.id}`} className="hover:underline">
          {bottle.brand.name}
        </Link>
      }
      statedAge={bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
      color={color}
      noGutter={noGutter}
    />
  );
}
