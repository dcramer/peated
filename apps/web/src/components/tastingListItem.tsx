import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import api from "../lib/api";
import { Tasting } from "../types";
import BottleCard from "./bottleCard";
import Button from "./button";
import { ImageModal } from "./imageModal";
import { StaticRating } from "./rating";
import Tags from "./tags";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

export default ({
  tasting,
  noBottle,
  onDelete,
  onToast,
  noComment = false,
}: {
  tasting: Tasting;
  noBottle?: boolean;
  onDelete?: (tasting: Tasting) => void;
  onToast?: (tasting: Tasting) => void;
  noComment?: boolean;
}) => {
  const { bottle } = tasting;
  const { user } = useAuth();

  const [imageOpen, setImageOpen] = useState(false);

  const [hasToasted, setHasToasted] = useState(tasting.hasToasted);
  const isTaster = user?.id === tasting.createdBy.id;
  const totalToasts =
    tasting.toasts + (hasToasted && !tasting.hasToasted ? 1 : 0);

  return (
    <li className="card">
      <div className="card-header p-3 sm:px-5 sm:py-4">
        <UserAvatar size={48} user={tasting.createdBy} />
        <div className="flex-1 space-y-1 font-semibold">
          <Link
            to={`/users/${tasting.createdBy.username}`}
            className="truncate hover:underline"
          >
            {tasting.createdBy.displayName}
          </Link>
          <Link to={`/tastings/${tasting.id}`} className="hover:underline">
            <TimeSince
              className="block text-sm font-light"
              date={tasting.createdAt}
            />
          </Link>
        </div>
        <div className="flex flex-col items-end gap-y-2">
          {tasting.rating && (
            <StaticRating value={tasting.rating} size="small" />
          )}
          <Tags tags={tasting.tags} />
        </div>
      </div>
      {!noBottle && (
        <BottleCard
          bottle={bottle}
          vintage={{
            series: bottle.series,
            vintageYear: tasting.vintageYear,
            barrel: tasting.barrel,
          }}
        />
      )}
      <div>
        {!!tasting.imageUrl && (
          <div className="flex max-h-[250px] min-w-full items-center justify-center overflow-hidden bg-black sm:mb-0 sm:mr-4">
            <img
              src={tasting.imageUrl}
              className="h-full"
              onClick={() => setImageOpen(true)}
            />
            <ImageModal
              image={tasting.imageUrl}
              open={imageOpen}
              setOpen={setImageOpen}
            />
          </div>
        )}
        {!!tasting.notes && (
          <p className="text-peated p-3 text-sm sm:px-5 sm:py-4">
            {tasting.notes}
          </p>
        )}

        <aside className="flex items-center space-x-3 p-3 sm:px-5 sm:py-4">
          {!hasToasted && !isTaster && user ? (
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
              icon={<HandThumbUpIcon className="-ml-0.5 h-5 w-5" />}
              active={hasToasted}
              disabled
            >
              {totalToasts.toLocaleString()}
            </Button>
          )}
          {user && !noComment && (
            <Button
              icon={
                <ChatBubbleLeftRightIcon
                  className="-ml-0.5 h-5 w-5"
                  aria-hidden="true"
                />
              }
              to={`/tastings/${tasting.id}`}
            >
              {tasting.comments.toLocaleString()}
            </Button>
          )}
          {(user?.admin || isTaster) && (
            <Menu as="div" className="menu">
              <Menu.Button as={Button}>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Menu.Items className="absolute inset-x-0 bottom-10 right-0 z-10 w-44 origin-bottom-right">
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
          )}
        </aside>
      </div>
    </li>
  );
};
