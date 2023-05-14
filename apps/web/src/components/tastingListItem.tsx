import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";

import { Link } from "react-router-dom";
import { Tasting } from "../types";
import BottleCard from "./bottleCard";
import Button from "./button";
import Chip from "./chip";
import { StaticRating } from "./rating";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

const Tags = ({ tags }: { tags: string[] }) => {
  if (!tags) return null;
  return (
    <div className="flex gap-x-1">
      {tags.slice(0, 3).map((t) => (
        <Chip key={t} size="small">
          {t}
        </Chip>
      ))}
      {tags.length > 3 && (
        <Chip size="small" title={tags.join(", ")}>
          ⋯
        </Chip>
      )}
    </div>
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
    <li className="overflow-hidden bg-white p-3 shadow sm:rounded">
      <div className="mb-4 flex items-center space-x-4">
        <span className="w-48-px h-48-px overflow-hidden rounded bg-gray-100">
          <UserAvatar size={48} user={tasting.createdBy} />
        </span>
        <div className="text-peated flex-1 space-y-1 font-medium">
          <Link
            to={`/users/${tasting.createdBy.id}`}
            className="hover:underline"
          >
            {tasting.createdBy.displayName}
          </Link>
          <TimeSince
            className="block text-sm font-light text-gray-500 dark:text-gray-400"
            date={tasting.createdAt}
          />
        </div>
        <div className="flex flex-col items-end gap-y-2">
          <StaticRating value={tasting.rating} size="small" />
          <Tags tags={tasting.tags} />
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
        <div className="mt-3 flex items-center space-x-3">
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
