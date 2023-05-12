import { Link } from "react-router-dom";
import { formatCategoryName } from "../lib/strings";
import { Bottle } from "../types";
import BottleName from "./bottleName";

export default ({ bottle }: { bottle: Bottle }) => {
  const { distillers } = bottle;
  return (
    <div className="text-peated flex items-center space-x-4 rounded bg-gray-100 p-3 sm:mb-4">
      <div className="flex-1 space-y-1">
        <p className="text-peated font-semibold leading-6">
          <Link to={`/bottles/${bottle.id}`} className="hover:underline">
            <BottleName bottle={bottle} />
          </Link>
        </p>
        <p className="text-sm font-light text-gray-500">
          Produced by{" "}
          <Link to={`/brands/${bottle.brand.id}`} className="hover:underline">
            {bottle.brand.name}
          </Link>
          {distillers &&
            distillers.length > 0 &&
            (distillers.length > 0 ||
              bottle.brand.name !== distillers[0].name) && (
              <span>
                {" "}
                &middot; Distilled at{" "}
                {distillers
                  .map<React.ReactNode>((d) => (
                    <Link
                      key={d.id}
                      to={`/distillers/${d.id}`}
                      className="hover:underline"
                    >
                      {d.name}
                    </Link>
                  ))
                  .reduce((prev, curr) => [prev, ", ", curr])}
              </span>
            )}
        </p>
      </div>
      <div className="space-y-1">
        <p className="leading-6 text-gray-500">
          {bottle.category && formatCategoryName(bottle.category)}
        </p>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
        </p>
      </div>
    </div>
  );
};
