import { Link } from "react-router-dom";
import { formatCategoryName } from "../lib/strings";
import { Bottle } from "../types";
import BottleName from "./bottleName";

export default ({ bottle }: { bottle: Bottle }) => {
  return (
    <div className="flex items-center sm:mb-4 space-x-4 bg-gray-100 text-peated p-3 rounded">
      <div className="space-y-1 flex-1">
        <p className="font-semibold leading-6 text-peated">
          <Link to={`/bottles/${bottle.id}`} className="hover:underline">
            <BottleName bottle={bottle} />
          </Link>
        </p>
        <p className="text-xs font-light text-gray-500">
          Produced by{" "}
          <Link to={`/brands/${bottle.brand.id}`} className="hover:underline">
            {bottle.brand.name}
          </Link>
          {bottle.distiller && bottle.brand.name !== bottle.distiller.name && (
            <span>
              {" "}
              &middot; Distilled at{" "}
              <Link
                to={`/distillers/${bottle.brand.id}`}
                className="hover:underline"
              >
                {bottle.distiller.name}
              </Link>
            </span>
          )}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-sm leading-6 text-gray-500">
          {bottle.category && formatCategoryName(bottle.category)}
        </p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
        </p>
      </div>
    </div>
  );
};
