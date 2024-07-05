import {
  type CaskFill,
  type CaskSize,
  type CaskType,
} from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ComponentPropsWithoutRef } from "react";
import Tooltip from "./tooltip";

type Props = {
  data: {
    flavorProfile: string | undefined | null;
    brand: {
      id: string | number | undefined | null;
      name: string;
    };
    distillers: {
      id: string | number | undefined | null;
      name: string;
    }[];
    caskFill: CaskFill | null;
    caskSize: CaskSize | null;
    caskType: CaskType | null;
  };
} & ComponentPropsWithoutRef<"p">;

export default function BottleMetadata({ data, ...props }: Props) {
  return (
    <div {...props} className="flex gap-x-2">
      {data.caskFill && data.caskType && (
        <CaskDetails
          caskFill={data.caskFill}
          caskSize={data.caskSize}
          caskType={data.caskType}
        />
      )}
    </div>
  );
}

import { toTitleCase } from "@peated/server/src/lib/strings";

function CaskDetails({
  caskFill,
  caskSize,
  caskType,
}: {
  caskFill: CaskFill | null;
  caskSize: CaskSize | null;
  caskType: CaskType | null;
}) {
  return (
    <div className="text-light">
      {caskFill ? toTitleCase(caskFill) : ""}{" "}
      {caskType ? toTitleCase(caskType) : ""}{" "}
      {caskSize ? toTitleCase(caskSize) : ""}
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
