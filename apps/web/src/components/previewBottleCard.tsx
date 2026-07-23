import {
  formatBottleName,
  formatCategoryName,
} from "@peated/server/lib/format";
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
  statedAge?: number | null | undefined;
  category?: string | null | undefined;
};

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
    <div className="bg-highlight flex items-center space-x-2 overflow-hidden p-4 text-black sm:space-x-3 sm:rounded lg:p-5">
      <div className="flex-1 overflow-hidden">
        <div className="flex w-full items-center gap-x-1 font-bold">{name}</div>
        <div className="flex flex-row gap-x-1 text-sm">{distillers}</div>
      </div>
      <div className="hidden w-[200px] flex-col items-end justify-center whitespace-nowrap text-sm sm:flex">
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
    />
  );
};
