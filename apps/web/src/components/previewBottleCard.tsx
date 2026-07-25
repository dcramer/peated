import {
  materializeConcreteBottleIdentity,
  type ConcreteBottleExactIdentity,
} from "@peated/server/lib/concreteBottleIdentity";
import { formatCategoryName } from "@peated/server/lib/format";
import type { ReactNode } from "react";
import Join from "./join";
import type { Option } from "./selectField";

type EntityOption = Option & {
  shortName?: string;
};

type BottleFormData = {
  name: string;
  brand?: EntityOption | null | undefined;
  distillers?: EntityOption[] | null | undefined;
  sharedStatedAge?: number | null | undefined;
  exactStatedAge?: number | null | undefined;
  category?: string | null | undefined;
} & Omit<ConcreteBottleExactIdentity, "statedAge">;

function BottleScaffold({
  name,
  category,
  distillers,
  statedAge,
}: {
  name: ReactNode;
  category: ReactNode;
  distillers: ReactNode;
  statedAge: ReactNode;
}) {
  return (
    <section
      aria-label="Bottle preview"
      className="bg-highlight flex items-center space-x-2 overflow-hidden p-4 text-black sm:space-x-3 sm:rounded lg:p-5"
    >
      <div className="flex-1 overflow-hidden">
        <div className="flex w-full items-center gap-x-1 font-bold">{name}</div>
        <div className="flex flex-row gap-x-1 text-sm">{distillers}</div>
      </div>
      <div className="hidden w-[200px] flex-col items-end justify-center whitespace-nowrap text-sm sm:flex">
        <div className="max-w-full truncate">{category}</div>
        <div>{statedAge}</div>
      </div>
    </section>
  );
}

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { brand } = data;
  const stableName = data.name ?? "";
  const stableFullName =
    `${brand ? `${brand.shortName || brand.name} ` : ""}${stableName}`.trim();
  const identity = materializeConcreteBottleIdentity({
    stable: {
      name: stableName,
      fullName: stableFullName,
      statedAge: data.sharedStatedAge ?? null,
    },
    exact: {
      edition: data.edition ?? null,
      statedAge: data.exactStatedAge ?? null,
      releaseYear: data.releaseYear ?? null,
      vintageYear: data.vintageYear ?? null,
      abv: data.abv ?? null,
      singleCask: data.singleCask ?? null,
      caskStrength: data.caskStrength ?? null,
      caskType: data.caskType ?? null,
      caskSize: data.caskSize ?? null,
      caskFill: data.caskFill ?? null,
    },
  });

  return (
    <BottleScaffold
      name={identity.fullName}
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
      statedAge={identity.statedAge ? `Aged ${identity.statedAge} years` : null}
    />
  );
};
