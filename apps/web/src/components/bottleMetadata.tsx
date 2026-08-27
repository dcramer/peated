import type { EntityKind } from "@peated/server/types";
import Link from "@peated/web/components/link";
import { getEntityUrl } from "@peated/web/lib/urls";
import type { ComponentPropsWithoutRef } from "react";
import Join from "./join";
import Tooltip from "./tooltip";

type Distiller = {
  id: number;
  name: string;
  kind: EntityKind;
};

type Props = {
  data: {
    brand: {
      id: number;
      name: string;
      kind: EntityKind;
    };
    distillers?: Distiller[];
    flavorProfile?: string | undefined | null;
  };
} & ComponentPropsWithoutRef<"p">;

export default function BottleMetadata({ data, ...props }: Props) {
  return (
    <div {...props} className="text-muted flex gap-x-2">
      {data.distillers?.length ? (
        <Join divider=", ">
          {data.distillers.map((d) => {
            return (
              <Link
                key={d.id}
                href={getEntityUrl(d)}
                className="hover:underline"
              >
                {d.name}
              </Link>
            );
          })}
        </Join>
      ) : null}
    </div>
  );
}

export const Brand = ({ data: { brand } }: Props) => {
  const brandName = brand?.name || "Unknown";

  return (
    <div className="max-w-[200px] space-x-1 truncate">
      <Link href={getEntityUrl(brand)} className="hover:underline">
        {brandName}
      </Link>
    </div>
  );
};

export const Distillers = ({
  distillers,
  isBlend = false,
}: {
  distillers?: Distiller[];
  isBlend?: boolean;
}) => {
  if (!distillers?.length) return null;

  if (distillers.length > 1) {
    return (
      <Tooltip
        title={
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {isBlend ? "Distilleries" : "Distillers"}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {distillers.map((distiller) => (
                <li key={distiller.id}>
                  <Link
                    href={getEntityUrl(distiller)}
                    className="block text-slate-200 hover:text-white hover:underline"
                  >
                    {distiller.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        }
        contentClassName="w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-700 bg-slate-900 p-3 text-left text-sm shadow-xl"
        origin="center"
      >
        <span className="underline decoration-dotted">
          {distillers.length} {isBlend ? "distilleries" : "distillers"}
        </span>
      </Tooltip>
    );
  }

  const d = distillers[0];
  return (
    <div className="space-x-1">
      <span>{isBlend ? "Distillery" : "Distilled at"}</span>
      <Link
        key={d.id}
        href={getEntityUrl(d)}
        className="inline-block max-w-[200px] truncate align-bottom hover:underline"
      >
        {d.name}
      </Link>
    </div>
  );
};
