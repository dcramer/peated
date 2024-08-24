import {
  type CaskFill,
  type CaskSize,
  type CaskType,
} from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ComponentPropsWithoutRef } from "react";
import Join from "./join";
import Tooltip from "./tooltip";

type Props = {
  data: {
    brand: {
      id: string | number | undefined | null;
      name: string;
    };
    distillers?: {
      id: string | number | undefined | null;
      name: string;
    }[];
    caskFill?: CaskFill | null;
    caskSize?: CaskSize | null;
    caskType?: CaskType | null;
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
                href={`/entities/${d.id}`}
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
      <Link href={`/entities/${brand.id}`} className="hover:underline">
        {brandName}
      </Link>
    </div>
  );
};

export const Distillers = ({ data: { distillers } }: Props) => {
  if (!distillers?.length) return null;

  if (distillers.length > 1) {
    return (
      <Tooltip title={distillers.map((d) => d.name).join(", ")} origin="center">
        <span className="underline decoration-dotted">
          {distillers.length} distillers
        </span>
      </Tooltip>
    );
  }

  const d = distillers[0];
  return (
    <div className="space-x-1">
      <span>Distilled at</span>
      <Link
        key={d.id}
        href={`/entities/${d.id}`}
        className="inline-block max-w-[200px] truncate align-bottom hover:underline"
      >
        {d.name}
      </Link>
    </div>
  );
};
