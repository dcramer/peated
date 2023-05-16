import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

import { useState } from "react";
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

  const [hasToasted, setHasToasted] = useState(tasting.hasToasted);

  const isTaster = user?.id === tasting.createdBy.id;

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="card"
    >
      <div className="card-header">
        <UserAvatar size={48} user={tasting.createdBy} />
        <div className="flex-1 space-y-1 font-semibold">
          <Link
            to={`/users/${tasting.createdBy.id}`}
            className="hover:underline"
          >
            {tasting.createdBy.displayName}
          </Link>
          <TimeSince
            className="block text-sm font-light"
            date={tasting.createdAt}
          />
        </div>
        <div className="flex flex-col items-end gap-y-2">
          <StaticRating value={tasting.rating} size="small" />
          <Tags tags={tasting.tags} />
        </div>
        <div className="flex min-h-full flex-shrink">
          <Menu as="div" className="menu">
            <Menu.Button className="text-light block h-full w-full rounded bg-inherit p-3 px-1">
              <EllipsisVerticalIcon className="h-full w-6" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 z-10 w-44 origin-top-right">
              {(user?.admin || isTaster) && (
                <Menu.Item
                  as="button"
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
      <div>
        {tasting.imageUrl ? (
          <div className="p-3 sm:flex">
            <div className="flex-shrink-0 sm:mb-0 sm:mr-4">
              <img src={tasting.imageUrl} className="max-w-32 max-h-32" />
            </div>
            <div>
              {tasting.comments && (
                <p className="text-peated text-sm">{tasting.comments}</p>
              )}
            </div>
          </div>
        ) : (
          tasting.comments && (
            <p className="text-peated p-3 text-sm">{tasting.comments}</p>
          )
        )}
        {!isTaster && user && (
          <aside className="flex items-center space-x-3 p-3">
            {!hasToasted ? (
              <Button
                icon={
                  <HandThumbUpIcon
                    className="-ml-0.5 h-5 w-5"
                    aria-hidden="true"
                  />
                }
                onClick={async () => {
                  await api.post(`/tastings/${tasting.id}/toasts`);
                  setHasToasted(true);
                  onToast && onToast(tasting);
                }}
              >
                Toast
              </Button>
            ) : (
              <Button
                icon={
                  <HandThumbUpIcon className="text-highlight -ml-0.5 h-5 w-5" />
                }
                active
                disabled
              >
                1
              </Button>
            )}
            <Button
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
          </aside>
        )}
      </div>
    </motion.li>
  );
};
