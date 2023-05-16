import { Link } from "react-router-dom";
import classNames from "../lib/classNames";
import { formatCategoryName } from "../lib/strings";
import { Bottle } from "../types";
import BottleName from "./bottleName";
import { Option } from "./selectField";

const Distillers = ({
  bottle: { distillers, brand },
}: {
  bottle: {
    brand?: {
      name: string;
    };
    distillers?: {
      id?: string | undefined | null;
      name: string;
    }[];
  };
}) => {
  if (!distillers || !distillers.length) return null;

  if (distillers.length > 1) {
    return (
      <span>
        {" "}
        &middot;{" "}
        <span
          className="underline decoration-dotted"
          title={distillers.map((d) => d.name).join(", ")}
        >
          {distillers.length} distillers
        </span>
      </span>
    );
  }

  if (distillers.length == 1 && brand?.name === distillers[0].name) {
    return null;
  }

  const d = distillers[0];
  return (
    <span>
      {" "}
      &middot; Distilled at{" "}
      {d.id ? (
        <Link key={d.id} to={`/entities/${d.id}`} className="hover:underline">
          {d.name}
        </Link>
      ) : (
        d.name
      )}
    </span>
  );
};

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
        <p className="font-semibold leading-6">
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
        <p className="text-sm">
          Produced by {brand?.name || "Unknown"}
          <Distillers bottle={data} />
        </p>
      </div>
      <div className="flex flex-col items-end space-y-1 text-sm leading-6">
        <p>{data.category ? data.category.name : null}</p>
        <p>{data.statedAge ? `Aged ${data.statedAge} years` : null}</p>
      </div>
    </div>
  );
};

export default ({
  bottle,
  noGutter,
}: {
  bottle: Bottle;
  noGutter?: boolean;
}) => {
  const { distillers } = bottle;
  return (
    <div
      className={classNames(
        "flex items-center space-x-4 bg-slate-950",
        noGutter ? "" : "p-3 sm:px-5 sm:py-4",
      )}
    >
      <div className="flex-1 space-y-1">
        <p className="font-semibold leading-6">
          <Link to={`/bottles/${bottle.id}`} className="hover:underline">
            <BottleName bottle={bottle} />
          </Link>
        </p>
        <p className="text-light text-sm">
          Produced by{" "}
          <Link to={`/entities/${bottle.brand.id}`} className="hover:underline">
            {bottle.brand.name}
          </Link>
          <Distillers bottle={bottle} />
        </p>
      </div>
      <div className="text-light flex flex-col items-end space-y-1 text-sm leading-6">
        <p>{bottle.category && formatCategoryName(bottle.category)}</p>
        <p>{bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}</p>
      </div>
    </div>
  );
};
