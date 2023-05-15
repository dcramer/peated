import { Link } from "react-router-dom";
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

  if (distillers.length == 1 && brand?.name !== distillers[0].name) {
    return null;
  }

  const d = distillers[0];
  return (
    <span>
      {" "}
      &middot; Distilled at{" "}
      {d.id ? (
        <Link key={d.id} to={`/distillers/${d.id}`} className="hover:underline">
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
      <div className="space-y-1">
        <p className="leading-6 ">
          {data.category ? data.category.name : null}
        </p>
        <p className="mt-1 text-sm leading-5 ">
          {data.statedAge ? `Aged ${data.statedAge} years` : null}
        </p>
      </div>
    </div>
  );
};

export default ({ bottle }: { bottle: Bottle }) => {
  const { distillers } = bottle;
  return (
    <div className="flex items-center space-x-4 bg-slate-950 p-3 sm:px-5 sm:py-4">
      <div className="flex-1 space-y-1">
        <p className="font-semibold leading-6">
          <Link to={`/bottles/${bottle.id}`} className="hover:underline">
            <BottleName bottle={bottle} />
          </Link>
        </p>
        <p className="text-light text-sm">
          Produced by{" "}
          <Link to={`/brands/${bottle.brand.id}`} className="hover:underline">
            {bottle.brand.name}
          </Link>
          <Distillers bottle={bottle} />
        </p>
      </div>
      <div className="text-light space-y-1">
        <p className="leading-6 ">
          {bottle.category && formatCategoryName(bottle.category)}
        </p>
        <p className="mt-1 text-sm leading-5 ">
          {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
        </p>
      </div>
    </div>
  );
};
