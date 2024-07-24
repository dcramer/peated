import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ComponentPropsWithoutRef } from "react";
import classNames from "../lib/classNames";
import BottleLink from "./bottleLink";
import type { Option } from "./selectField";

type EntityOption = Option & {
  shortName?: string;
};

type BottleFormData = {
  name: string;
  vintageYear?: number | null;
  brand?: EntityOption | null | undefined;
  distillers?: EntityOption[] | null | undefined;
  statedAge?: number | null | undefined;
  category?: string | null | undefined;
};

function BottleScaffold({
  name,
  category,
  distillers,
  statedAge,
  color = "default",
  noGutter = false,
  onClick,
}: {
  name: any;
  category: any;
  distillers: any;
  statedAge: any;
  color?: "default" | "highlight" | "inherit";
  noGutter?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={classNames(
        "flex items-center space-x-2 overflow-hidden sm:space-x-3",
        color === "highlight"
          ? "bg-highlight text-black"
          : color === "inherit"
            ? ""
            : "bg-slate-950 text-white",
        noGutter ? "" : "p-3 sm:px-5 sm:py-4",
        onClick
          ? color === "highlight"
            ? "hover:bg-highlight-dark"
            : "hover:bg-slate-900"
          : "",
        onClick ? "cursor-pointer" : "",
      )}
      onClick={onClick}
    >
      <div className="flex-1 overflow-hidden">
        <div className="flex w-full items-center space-x-1 truncate font-bold">
          {name}
        </div>
        <div
          className={classNames(
            "text-sm",
            color === "highlight" ? "" : "text-muted",
          )}
        >
          {distillers}
        </div>
      </div>
      <div
        className={classNames(
          color === "highlight" ? "" : "text-muted",
          "hidden w-[200px] flex-col items-end justify-center whitespace-nowrap text-sm sm:flex",
        )}
      >
        <div className="max-w-full truncate">{category}</div>
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
      name={`${brand ? `${brand.shortName || brand.name} ${data.name}` : data.name}${data.vintageYear ? ` (${data.vintageYear})` : ""}`}
      category={data.category ? formatCategoryName(data.category) : null}
      distillers={
        data.distillers?.length
          ? data.distillers.map((d) => d.name).join(" ")
          : null
      }
      statedAge={data.statedAge ? `Aged ${data.statedAge} years` : null}
      color="highlight"
    />
  );
};

export default function BottleCard({
  bottle,
  noGutter,
  color,
  onClick,
}: {
  bottle: Bottle;
  onClick?: (bottle: Bottle) => void;
} & Pick<
  ComponentPropsWithoutRef<typeof BottleScaffold>,
  "color" | "noGutter"
>) {
  return (
    <BottleScaffold
      onClick={onClick ? () => onClick(bottle) : undefined}
      name={
        <>
          <h4 className="truncate font-bold">
            <BottleLink bottle={bottle} className="hover:underline">
              {bottle.fullName}
            </BottleLink>
            {bottle.vintageYear && (
              <>
                {" "}
                <span
                  className={
                    color === "highlight" ? "text-black" : "text-muted"
                  }
                >
                  ({bottle.vintageYear})
                </span>
              </>
            )}
          </h4>
          {bottle.isFavorite && (
            <div className="w-4">
              <StarIcon className="w-4" aria-hidden="true" />
            </div>
          )}
          {bottle.hasTasted && (
            <div className="w-4">
              <CheckBadgeIcon className="w-4" aria-hidden="true" />
            </div>
          )}
        </>
      }
      category={
        <div>
          {bottle.category && (
            <Link
              href={`/bottles?category=${bottle.category}`}
              className="hover:underline"
            >
              {formatCategoryName(bottle.category)}
            </Link>
          )}
        </div>
      }
      distillers={
        bottle.distillers?.length
          ? bottle.distillers.map((d) => (
              <Link
                key={d.id}
                href={`/entities/${d.id}`}
                className="hover:underline"
              >
                {d.name}
              </Link>
            ))
          : null
      }
      statedAge={bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
      color={color}
      noGutter={noGutter}
    />
  );
}
