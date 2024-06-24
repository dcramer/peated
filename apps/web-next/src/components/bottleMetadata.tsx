import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import FlavorProfile from "./flavorProfile";
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
  };
} & ComponentPropsWithoutRef<"p">;

export default function BottleMetadata({ data, ...props }: Props) {
  return (
    <div {...props}>
      <div className="inline-flex flex-col items-center space-x-1 truncate sm:flex-row sm:items-start">
        {!!data.flavorProfile && <FlavorProfile profile={data.flavorProfile} />}
      </div>
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
