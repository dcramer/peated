import { Link } from "react-router-dom";
import classNames from "../lib/classNames";
import { formatCategoryName } from "../lib/strings";
import { Bottle } from "../types";
import BottleName from "./bottleName";
import { Option } from "./selectField";
import VintageName from "./vintageName";

type BottleFormData = {
  name: string;
  brand?: Option | null | undefined;
  series?: string | null | undefined;
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
        <p className="block max-w-[260px] truncate font-semibold leading-6 sm:max-w-[480px]">
          {data.name ? (
            <BottleName
              bottle={{
                name: data.name,
                brand: brand
                  ? {
                      name: brand.name,
                    }
                  : undefined,
              }}
            />
          ) : (
            "Unknown Bottle"
          )}
        </p>
        {data.series && <VintageName series={data.series} />}
      </div>
      <div className="w-22 flex flex-col items-end space-y-1 whitespace-nowrap text-sm leading-6">
        <p>{data.category ? formatCategoryName(data.category) : null}</p>
        <p>{data.statedAge ? `Aged ${data.statedAge} years` : null}</p>
      </div>
    </div>
  );
};

export default ({
  bottle,
  vintage,
  noGutter,
  color,
}: {
  bottle: Bottle;
  vintage?: {
    series?: string;
    vintageYear?: number;
    barrel?: number;
  };
  noGutter?: boolean;
  color?: "highlight" | "default";
}) => {
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
        <Link
          to={`/bottles/${bottle.id}`}
          className="block max-w-[260px] truncate font-semibold leading-6 hover:underline sm:max-w-[480px]"
        >
          <BottleName bottle={bottle} />
        </Link>
        {vintage && (
          <div className="text-light">
            <VintageName {...vintage} />
          </div>
        )}
      </div>
      <div
        className={classNames(
          color === "highlight" ? "" : "text-light",
          "flex flex-col items-end space-y-1 whitespace-nowrap text-sm leading-6",
        )}
      >
        <p>{bottle.category && formatCategoryName(bottle.category)}</p>
        <p>{bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}</p>
      </div>
    </div>
  );
};
