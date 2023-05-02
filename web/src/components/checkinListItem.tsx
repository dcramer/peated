import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";

import { Checkin } from "../types";
import { StaticRating } from "./rating";
import Button from "./button";

const TimeSince = ({ date }) => {
  return (
    <time
      dateTime={date}
      className="block text-sm text-gray-500 dark:text-gray-400"
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

export default ({ checkin }: { checkin: Checkin }) => {
  const title = (
    <>
      {checkin.bottle.name}
      {checkin.bottle.series && (
        <em className="text-peated-light font-normal ml-1">
          {checkin.bottle.series}
        </em>
      )}
    </>
  );
  return (
    <li className="overflow-hidden bg-white shadow sm:rounded-md">
      <div className="flex items-center mb-4 space-x-4 bg-peated text-white py-2 px-3">
        <div className="space-y-1 font-medium flex-1">
          <p>
            <p className="text-sm font-semibold leading-6 text-white">
              {title}
            </p>
            <p className="mt-1 flex text-xs leading-5 text-peated-light truncate">
              {checkin.bottle.brand.name}
            </p>
          </p>
        </div>
      </div>
      <div className="flex items-center mb-4 space-x-4 px-3">
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
          <p>
            {checkin.user.displayName}
            <TimeSince date={checkin.createdAt} />
          </p>
        </div>
        <StaticRating value={checkin.rating} size="small" />
      </div>
      {checkin.tastingNotes && (
        <p className="mb-2 px-3 text-gray-500 dark:text-gray-400">
          {checkin.tastingNotes}
        </p>
      )}
      <aside className="px-3 pb-2">
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
