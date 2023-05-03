import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";

import { Checkin } from "../types";
import { StaticRating } from "./rating";
import Button from "./button";
import { Link } from "react-router-dom";
import BottleCard from "./bottleCard";
import UserAvatar from "./userAvatar";

const TimeSince = ({ date }: { date: string }) => {
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

  return (
    <li className="overflow-hidden bg-white shadow sm:rounded p-3">
      <div className="flex items-center mb-4 space-x-4">
        <span className="overflow-hidden w-48-px h-48-px rounded bg-gray-100">
          <UserAvatar size={48} user={checkin.user} />
        </span>
        <div className="space-y-1 font-medium text-peated flex-1">
          <Link to={`/users/${checkin.user.id}`} className="hover:underline">
            {checkin.user.displayName}
          </Link>
          <TimeSince date={checkin.createdAt} />
        </div>
        <StaticRating value={checkin.rating} size="small" />
      </div>
      {!noBottle && <BottleCard bottle={bottle} />}
      {checkin.imageUrl ? (
        <div className="sm:flex">
          <div className="mb-4 flex-shrink-0 sm:mb-0 sm:mr-4">
            <img
              src={checkin.imageUrl}
              crossOrigin="anonymous"
              className="max-w-32 max-h-32"
            />
          </div>
          <div>
            {checkin.tastingNotes && (
              <p className="mb-2 px-3 text-sm text-gray-500 dark:text-gray-400">
                {checkin.tastingNotes}
              </p>
            )}
          </div>
        </div>
      ) : (
        checkin.tastingNotes && (
          <p className="mb-2 px-3 text-sm text-gray-500 dark:text-gray-400">
            {checkin.tastingNotes}
          </p>
        )
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
