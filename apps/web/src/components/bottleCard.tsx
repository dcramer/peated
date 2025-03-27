import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import {
  formatBottleName,
  formatCategoryName,
} from "@peated/server/lib/format";
import type { Bottle, BottleRelease } from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ComponentPropsWithoutRef } from "react";
import classNames from "../lib/classNames";
import BottleLink from "./bottleLink";
import Join from "./join";
import type { Option } from "./selectField";

type EntityOption = Option & {
  shortName?: string;
};

type BottleFormData = {
  name: string;
  edition?: string | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
  brand?: EntityOption | null | undefined;
  distillers?: EntityOption[] | null | undefined;
  statedAge?: number | null | undefined;
  category?: string | null | undefined;
};

function BottleScaffold({
  name,
  category,
  release,
  distillers,
  statedAge,
  color = "default",
  noGutter = false,
  onClick,
}: {
  name: any;
  category: any;
  release?: any;
  distillers: any;
  statedAge: any;
  color?: "default" | "highlight" | "inherit";
  noGutter?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={classNames(
        "flex items-center space-x-2 overflow-hidden sm:space-x-3 sm:rounded",
        color === "highlight"
          ? "bg-highlight text-black"
          : color === "inherit"
            ? ""
            : "bg-slate-950 text-white",
        noGutter ? "" : "p-4 lg:p-5",
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
        <div className="flex w-full items-center space-x-1 font-bold">
          {name}
        </div>
        <div
          className={classNames(
            "text-sm",
            color === "highlight" ? "" : "text-muted",
          )}
        >
          {release}
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
      name={formatBottleName({
        ...data,
        name: `${brand ? `${brand.shortName || brand.name} ` : ""}${data.name}`,
      })}
      category={data.category ? formatCategoryName(data.category) : null}
      distillers={
        data.distillers?.length ? (
          <Join divider=", ">
            {data.distillers.map((d) => (
              <span key={d.id}>{d.name}</span>
            ))}
          </Join>
        ) : null
      }
      statedAge={data.statedAge ? `Aged ${data.statedAge} years` : null}
      color="highlight"
    />
  );
};

function formatRelease(release: BottleRelease | null | undefined) {
  if (!release) return null;
  if (release.edition) {
    return `${release.edition}${release.releaseYear ? ` (${release.releaseYear})` : ""}${release.vintageYear ? ` (${release.vintageYear} Vintage)` : ""}`;
  }
  return `${release.releaseYear ?? release.vintageYear}`;
}

export default function BottleCard({
  bottle,
  release,
  noGutter,
  color,
  onClick,
}: {
  bottle: Bottle;
  release?: BottleRelease | null;
  onClick?: (bottle: Bottle) => void;
} & Pick<
  ComponentPropsWithoutRef<typeof BottleScaffold>,
  "color" | "noGutter"
>) {
  return (
    <BottleScaffold
      onClick={onClick ? () => onClick(bottle) : undefined}
      name={
        <div>
          <div className="space-x-1">
            <h4 className="inline font-bold" title={bottle.fullName}>
              <BottleLink bottle={bottle} className="hover:underline">
                {bottle.fullName}
              </BottleLink>
            </h4>
            {bottle.isFavorite && (
              <StarIcon className="inline w-4" aria-hidden="true" />
            )}
            {bottle.hasTasted && (
              <CheckBadgeIcon className="inline w-4" aria-hidden="true" />
            )}
          </div>
        </div>
      }
      release={release ? <div>{formatRelease(release)}</div> : null}
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
        bottle.distillers.length ? (
          <Join divider=", ">
            {bottle.distillers.map((d) => (
              <Link
                key={d.id}
                href={`/entities/${d.id}`}
                className="hover:underline"
              >
                {d.name}
              </Link>
            ))}
          </Join>
        ) : null
      }
      statedAge={bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
      color={color}
      noGutter={noGutter}
    />
  );
}
