import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import api from "../lib/api";
import { Tasting } from "../types";
import BottleCard from "./bottleCard";
import Button from "./button";
import { StaticRating } from "./rating";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

const Tags = ({ tags }: { tags: string[] }) => {
  if (!tags) return null;
  return (
    <div className="text-sm">
      <div className="hidden sm:block">
        <span>{tags.slice(0, 5).join(", ")}</span>
        {tags.length > 4 && (
          <span>
            , and{" "}
            <span
              className="underline decoration-dotted"
              title={tags.join(", ")}
            >
              {tags.length - 4} more
            </span>
          </span>
        )}
      </div>
      <div className="sm:hidden">
        <span className="underline decoration-dotted" title={tags.join(", ")}>
          {tags.length} flavor note{tags.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};
export default ({
  tasting,
  noBottle,
  onDelete,
  onToast,
  onComment,
}: {
  tasting: Tasting;
  noBottle?: boolean;
  onDelete?: (tasting: Tasting) => void;
  onToast?: (tasting: Tasting) => void;
  onComment?: (tasting: Tasting) => void;
}) => {
  const { bottle } = tasting;
  const { user } = useAuth();

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="overflow-hidden bg-white p-3 shadow sm:rounded"
    >
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
        <div className="flex min-h-full flex-shrink">
          <Menu as="div" className="relative">
            <Menu.Button className="text-peated block h-full w-full rounded border-gray-200 bg-white p-3 px-1 hover:bg-gray-200">
              <EllipsisVerticalIcon className="h-full w-6" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 z-10 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-10 focus:outline-none">
              {(user?.admin || user?.id === tasting.createdBy.id) && (
                <Menu.Item
                  as="button"
                  className="text-peated block w-full px-4 py-2 text-left text-sm hover:bg-gray-200"
                  onClick={async () => {
                    await api.delete(`/tastings/${tasting.id}`);
                    if (onDelete) onDelete(tasting);
                    else location.reload();
                  }}
                >
                  Delete Tasting
                </Menu.Item>
              )}
            </Menu.Items>
          </Menu>
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
            onClick={() => onToast && onToast(tasting)}
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
            onClick={() => onComment && onComment(tasting)}
          >
            Comment
          </Button>
        </div>
      </aside>
    </motion.li>
  );
};
