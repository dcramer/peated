import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { Link } from "@remix-run/react";
import { useState } from "react";

import type { Tasting } from "@peated/server/types";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import { useEffect, type ComponentPropsWithoutRef } from "react";
import BottleCard from "./bottleCard";
import Button from "./button";
import { ImageModal } from "./imageModal";
import { StaticRating } from "./rating";
import ShareButton from "./shareButton";
import Tags from "./tags";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

function ImageWithSkeleton({
  src,
  ...props
}: Omit<ComponentPropsWithoutRef<"img">, "src"> & { src: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const img = new Image();
    img.onload = () => {
      setLoaded(true);
    };
    img.src = src;
  }, [setLoaded, loaded, src]);

  if (!loaded) return <ImageSkeleton />;

  return <img src={src} {...props} />;
}

function ImageSkeleton() {
  return (
    <div className="mb-4 flex h-[250px] w-full animate-pulse items-center justify-center rounded">
      <svg
        className="h-10 w-10 text-slate-800"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 20 18"
      >
        <path d="M18 0H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm-5.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm4.376 10.481A1 1 0 0 1 16 15H4a1 1 0 0 1-.895-1.447l3.5-7A1 1 0 0 1 7.468 6a.965.965 0 0 1 .9.5l2.775 4.757 1.546-1.887a1 1 0 0 1 1.618.1l2.541 4a1 1 0 0 1 .028 1.011Z" />
      </svg>
    </div>
  );
}

export default function TastingListItem({
  tasting,
  noBottle,
  onDelete,
  onToast,
  hideNotes = false,
  noCommentAction = false,
}: {
  tasting: Tasting;
  noBottle?: boolean;
  onDelete?: (tasting: Tasting) => void;
  onToast?: (tasting: Tasting) => void;
  hideNotes?: boolean;
  noCommentAction?: boolean;
}) {
  const { bottle } = tasting;
  const { user } = useAuth();

  const tastingDeleteMutation = trpc.tastingDelete.useMutation();
  const toastCreateMutation = trpc.toastCreate.useMutation();

  const [imageOpen, setImageOpen] = useState(false);

  const [hasToasted, setHasToasted] = useState(tasting.hasToasted);
  const isTaster = user?.id === tasting.createdBy.id;
  const totalToasts =
    tasting.toasts + (hasToasted && !tasting.hasToasted ? 1 : 0);

  return (
    <li className="card p-2 ring-1 ring-inset ring-slate-800">
      <div className="card-header p-3 sm:px-5 sm:py-4">
        <UserAvatar size={48} user={tasting.createdBy} />
        <div className="flex-auto space-y-1 font-semibold">
          <Link
            to={`/users/${tasting.createdBy.username}`}
            className="truncate hover:underline"
          >
            {tasting.createdBy.username}
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
      {!noBottle && <BottleCard bottle={bottle} />}
      <div>
        {!!tasting.imageUrl && (
          <div className="flex max-h-[250px] min-w-full items-center justify-center overflow-hidden bg-slate-950 sm:mb-0 sm:mr-4">
            <ImageWithSkeleton
              src={tasting.imageUrl}
              className="h-full cursor-pointer"
              alt=""
              onClick={() => setImageOpen(true)}
            />
            <ImageModal
              image={tasting.imageUrl}
              open={imageOpen}
              setOpen={setImageOpen}
            />
          </div>
        )}
        {!hideNotes && !!tasting.notes && (
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
                await toastCreateMutation.mutateAsync(tasting.id);
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
          {user && !noCommentAction && (
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

          <ShareButton
            title={`${tasting.bottle.fullName} - Tasting Notes by ${tasting.createdBy.username}`}
            url={`/tastings/${tasting.id}`}
          />

          {(user?.admin || isTaster) && (
            <Menu as="div" className="menu">
              <Menu.Button as={Button}>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Menu.Items className="absolute inset-x-0 bottom-10 right-0 z-10 w-44 origin-bottom-right">
                {(user?.admin || isTaster) && (
                  <>
                    {isTaster && (
                      <Menu.Item as={Link} to={`/tastings/${tasting.id}/edit`}>
                        Edit Tasting
                      </Menu.Item>
                    )}
                    <Menu.Item
                      as={Link}
                      to={`/tastings/${tasting.id}/editImage`}
                    >
                      Change Photo
                    </Menu.Item>
                    <Menu.Item
                      as="button"
                      onClick={async () => {
                        await tastingDeleteMutation.mutateAsync(tasting.id);
                        if (onDelete) onDelete(tasting);
                        else location.reload();
                      }}
                    >
                      Delete Tasting
                    </Menu.Item>
                  </>
                )}
              </Menu.Items>
            </Menu>
          )}
        </aside>
      </div>
    </li>
  );
}
