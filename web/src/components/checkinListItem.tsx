import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";

import { Checkin } from "../types";
import { StaticRating } from "./rating";
import Button from "./button";
import { formatCategoryName } from "../lib/strings";
import { Link } from "react-router-dom";
import BottleName from "./bottleName";

const TimeSince = ({ date }) => {
  return (
    <time
      dateTime={date}
      className="block text-sm font-light text-gray-500 dark:text-gray-400"
    >
      {new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    </time>
  );
};

export default ({
  checkin,
  noBottle,
}: {
  checkin: Checkin;
  noBottle?: boolean;
}) => {
  const { bottle } = checkin;

  const title = (
    <Link to={`/bottles/${bottle.id}`} className="hover:underline">
      <BottleName bottle={bottle} />
    </Link>
  );

  return (
    <li className="overflow-hidden bg-white shadow sm:rounded-md p-3">
      <div className="flex items-center mb-4 space-x-4">
        <span className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
          <svg
            className="h-full w-full text-gray-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </span>
        <div className="space-y-1 font-medium text-peated flex-1">
          <Link to={`/users/${checkin.user.id}`} className="hover:underline">
            {checkin.user.displayName}
          </Link>
          <TimeSince date={checkin.createdAt} />
        </div>
        <StaticRating value={checkin.rating} size="small" />
      </div>
      {!noBottle && (
        <div className="flex items-center mb-4 space-x-4 bg-gray-100 text-peated p-3 rounded-md">
          <div className="space-y-1 flex-1">
            <p className="font-semibold leading-6 text-peated">{title}</p>
            <p className="text-xs font-light text-gray-500">
              Produced by{" "}
              <Link
                to={`/brands/${bottle.brand.id}`}
                className="hover:underline"
              >
                {bottle.brand.name}
              </Link>
              {bottle.distiller &&
                bottle.brand.name !== bottle.distiller.name && (
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
      )}
      {checkin.tastingNotes && (
        <p className="mb-2 px-3 text-sm text-gray-500 dark:text-gray-400">
          {checkin.tastingNotes}
        </p>
      )}
      <aside>
        <div className="flex items-center mt-3 space-x-3">
          <Button
            type="button"
            icon={
              <HandThumbUpIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
            }
          >
            Toast
          </Button>
          <Button
            type="button"
            icon={
              <ChatBubbleLeftRightIcon
                className="-ml-0.5 h-5 w-5"
                aria-hidden="true"
              />
            }
          >
            Comment
          </Button>
        </div>
      </aside>
    </li>
  );
};
