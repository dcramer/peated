import { Link } from "react-router-dom";
import { ReactComponent as BottleIcon } from "../assets/bottle.svg";
import classNames from "../lib/classNames";
import { formatCategoryName } from "../lib/strings";
import { Bottle } from "../types";
import BottleMetadata from "./bottleMetadata";
import BottleName from "./bottleName";
import { Option } from "./selectField";

type BottleFormData = {
  name: string;
  brand: Option;
  distillers?: Option[] | undefined;
  statedAge?: number | undefined;
  category?: Option;
};

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { distillers, brand } = data;
  return (
    <div className="bg-highlight flex items-center space-x-4 p-3 text-black sm:px-5 sm:py-4">
      <div className="flex-1 space-y-1">
        <p className="block max-w-[260px] truncate font-semibold leading-6 hover:underline sm:max-w-[480px]">
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
        <BottleMetadata className="text-sm" data={data} />
      </div>
      <div className="w-22 flex flex-col items-end space-y-1 whitespace-nowrap text-sm leading-6">
        <p>{data.category ? data.category.name : null}</p>
        <p>{data.statedAge ? `Aged ${data.statedAge} years` : null}</p>
      </div>
    </div>
  );
};

export default ({
  bottle,
  noGutter,
  color,
}: {
  bottle: Bottle;
  noGutter?: boolean;
  color?: "highlight" | "default";
}) => {
  const { distillers } = bottle;
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
      <div>
        <BottleIcon className="h-10 w-auto" />
      </div>
      <div className="flex-1 space-y-1">
        <Link
          to={`/bottles/${bottle.id}`}
          className="block max-w-[260px] truncate font-semibold leading-6 hover:underline sm:max-w-[480px]"
        >
          <BottleName bottle={bottle} />
        </Link>
        <BottleMetadata
          data={bottle}
          className={classNames(
            color === "highlight" ? "" : "text-light",
            "text-sm",
          )}
        />
      </div>
      <div
        className={classNames(
          color === "highlight" ? "" : "text-light",
          "w-22 flex flex-col items-end space-y-1 whitespace-nowrap text-sm leading-6",
        )}
      >
        <p>{bottle.category && formatCategoryName(bottle.category)}</p>
        <p>{bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}</p>
      </div>
    </div>
  );
};
