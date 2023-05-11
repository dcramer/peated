import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";

import { Tasting } from "../types";
import { StaticRating } from "./rating";
import Button from "./button";
import { Link } from "react-router-dom";
import BottleCard from "./bottleCard";
import UserAvatar from "./userAvatar";
import Chip from "./chip";

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
  tasting,
  noBottle,
}: {
  tasting: Tasting;
  noBottle?: boolean;
}) => {
  const { bottle } = tasting;

  return (
    <li className="overflow-hidden bg-white shadow sm:rounded p-3">
      <div className="flex items-center mb-4 space-x-4">
        <span className="overflow-hidden w-48-px h-48-px rounded bg-gray-100">
          <UserAvatar size={48} user={tasting.createdBy} />
        </span>
        <div className="space-y-1 font-medium text-peated flex-1">
          <Link
            to={`/users/${tasting.createdBy.id}`}
            className="hover:underline"
          >
            {tasting.createdBy.displayName}
          </Link>
          <TimeSince date={tasting.createdAt} />
        </div>
        <div className="flex flex-col items-end gap-y-2">
          <StaticRating value={tasting.rating} size="small" />
          <div className="flex gap-x-1">
            {tasting.tags &&
              tasting.tags.map((t) => <Chip size="small">{t}</Chip>)}
          </div>
        </div>
      </div>
      {!noBottle && <BottleCard bottle={bottle} />}
      {tasting.imageUrl ? (
        <div className="sm:flex">
          <div className="mb-4 flex-shrink-0 sm:mb-0 sm:mr-4">
            <img
              src={tasting.imageUrl}
              crossOrigin="anonymous"
              className="max-w-32 max-h-32"
            />
          </div>
          <div>
            {tasting.comments && (
              <p className="mb-2 px-3 text-sm text-gray-500 dark:text-gray-400">
                {tasting.comments}
              </p>
            )}
          </div>
        </div>
      ) : (
        tasting.comments && (
          <p className="mb-2 px-3 text-sm text-gray-500 dark:text-gray-400">
            {tasting.comments}
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
