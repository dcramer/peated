"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { COLOR_SCALE } from "@peated/server/src/constants";
import { formatColor, formatServingStyle } from "@peated/server/src/lib/format";
import type { Tasting } from "@peated/server/types";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { getAuthRedirect } from "../lib/auth";
import BottleCard from "./bottleCard";
import Button from "./button";
import Counter from "./counter";
import DefinitionList from "./definitionList";
import { ImageModal } from "./imageModal";
import { StaticRating } from "./rating";
import ServingStyleIcon from "./servingStyleIcon";
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
  }, [loaded, src]);

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
  noCommentAction = false,
}: {
  tasting: Tasting;
  noBottle?: boolean;
  onDelete?: (tasting: Tasting) => void;
  onToast?: (tasting: Tasting) => void;
  noCommentAction?: boolean;
}) {
  const { bottle } = tasting;
  const { user } = useAuth();

  const pathname = usePathname();

  const router = useRouter();

  const tastingDeleteMutation = trpc.tastingDelete.useMutation();
  const toastCreateMutation = trpc.toastCreate.useMutation();

  const [imageOpen, setImageOpen] = useState(false);

  const [hasToasted, setHasToasted] = useState(tasting.hasToasted);
  const isTaster = user?.id === tasting.createdBy.id;
  const totalToasts =
    tasting.toasts + (hasToasted && !tasting.hasToasted ? 1 : 0);

  const canToast = !hasToasted && !isTaster && user;

  return (
    <li className="overflow-hidden bg-slate-950 ring-1 ring-inset ring-slate-800">
      <div className="border-x border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900">
        <div className="flex items-center space-x-4 p-3 sm:px-5 sm:py-4">
          <UserAvatar size={32} user={tasting.createdBy} />
          <div className="flex-auto space-y-1 font-semibold">
            <Link
              href={`/users/${tasting.createdBy.username}`}
              className="truncate hover:underline"
            >
              {tasting.createdBy.username}
            </Link>
          </div>
          <div className="flex flex-col items-end gap-y-2">
            <Link href={`/tastings/${tasting.id}`} className="hover:underline">
              <TimeSince
                className="block text-sm font-light"
                date={tasting.createdAt}
              />
            </Link>
          </div>
        </div>

        {!noBottle && (
          <div className="p-3 sm:px-5">
            <BottleCard color="inherit" noGutter bottle={bottle} />
          </div>
        )}
      </div>
      <div>
        {!!tasting.imageUrl && (
          <div className="flex max-h-[250px] min-w-full items-center justify-center overflow-hidden bg-slate-950 sm:mr-4">
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
        {!!tasting.notes && (
          <p className="text-peated p-3 text-sm sm:px-5">{tasting.notes}</p>
        )}
        <div className="text-light p-3 text-sm sm:px-5">
          {(tasting.servingStyle ||
            tasting.color ||
            tasting.rating ||
            tasting.tags.length > 0) && (
            <DefinitionList className="grid-cols grid grid-cols-2 gap-y-4 sm:grid-cols-2">
              {tasting.rating && (
                <div>
                  <DefinitionList.Term>Rating</DefinitionList.Term>
                  <DefinitionList.Details>
                    <StaticRating value={tasting.rating} size="small" />
                  </DefinitionList.Details>
                </div>
              )}
              {tasting.tags.length > 0 && (
                <div>
                  <DefinitionList.Term>Notes</DefinitionList.Term>
                  <DefinitionList.Details>
                    <Tags tags={tasting.tags} />
                  </DefinitionList.Details>
                </div>
              )}
              {tasting.servingStyle && (
                <div>
                  <DefinitionList.Term>Style</DefinitionList.Term>
                  <DefinitionList.Details>
                    <ServingStyleIcon
                      servingStyle={tasting.servingStyle}
                      size={4}
                    />
                    {formatServingStyle(tasting.servingStyle)}
                  </DefinitionList.Details>
                </div>
              )}
              {tasting.color && (
                <div>
                  <DefinitionList.Term>Color</DefinitionList.Term>
                  <DefinitionList.Details>
                    <div
                      className="h-4 w-4"
                      style={{ background: COLOR_SCALE[tasting.color][2] }}
                    />
                    {formatColor(tasting.color)}
                  </DefinitionList.Details>
                </div>
              )}
            </DefinitionList>
          )}
        </div>

        <aside className="flex items-center space-x-3 px-3 py-3 sm:px-5 sm:pb-4">
          <Button
            icon={
              <HandThumbUpIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
            }
            active={hasToasted}
            disabled={!canToast}
            onClick={
              canToast
                ? () => {
                    setHasToasted(true);
                    toastCreateMutation.mutate(tasting.id, {
                      onError: () => {
                        setHasToasted(false);
                      },
                      onSuccess: () => {
                        onToast && onToast(tasting);
                      },
                    });
                  }
                : () => {
                    router.push(getAuthRedirect({ pathname }));
                  }
            }
          >
            <Counter value={totalToasts} />
          </Button>

          {user && !noCommentAction && (
            <Button
              icon={
                <ChatBubbleLeftRightIcon
                  className="-ml-0.5 h-5 w-5"
                  aria-hidden="true"
                />
              }
              href={`/tastings/${tasting.id}`}
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
              <MenuButton as={Button}>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </MenuButton>
              <MenuItems className="absolute inset-x-0 bottom-10 right-0 z-40 w-44 origin-bottom-right">
                {(user?.admin || isTaster) && (
                  <>
                    {isTaster && (
                      <MenuItem as={Link} href={`/tastings/${tasting.id}/edit`}>
                        Edit Tasting
                      </MenuItem>
                    )}
                    <MenuItem
                      as="button"
                      onClick={async () => {
                        await tastingDeleteMutation.mutateAsync(tasting.id);
                        if (onDelete) onDelete(tasting);
                        else {
                          location.reload();
                        }
                      }}
                    >
                      Delete Tasting
                    </MenuItem>
                  </>
                )}
              </MenuItems>
            </Menu>
          )}
        </aside>
      </div>
    </li>
  );
}
