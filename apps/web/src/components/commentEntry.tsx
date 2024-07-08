"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { User } from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { PolymorphicProps } from "@peated/web/types";
import type { ElementType } from "react";
import button from "./button";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

type Props = {
  createdAt: string | Date;
  createdBy: User;
  text: string;
  canDelete?: boolean;
  onDelete?: () => void;
};

const defaultElement = "li";

export default function CommentEntry<
  E extends ElementType = typeof defaultElement,
>({
  as,
  createdAt,
  createdBy,
  text,
  canDelete,
  onDelete,
  ...props
}: PolymorphicProps<E, Props>) {
  const Component = as ?? defaultElement;

  const showMenu = canDelete;

  return (
    <Component {...props}>
      <div className="h-10 w-10 py-2 sm:h-12 sm:w-12 ">
        <UserAvatar size={32} user={createdBy} />
      </div>
      <div className="min-w-0 flex-auto rounded bg-slate-900 px-3 py-2">
        <div className="flex flex-row">
          <div className="flex-auto">
            <div className="text-sm">
              <Link
                href={`/users/${createdBy.username}`}
                className="font-medium hover:underline"
              >
                {createdBy.username}
              </Link>
            </div>
            <div className="text-light text-sm">
              <TimeSince date={createdAt} />
            </div>
          </div>
          <div>
            {showMenu && (
              <Menu as="div" className="menu">
                <MenuButton as={button} size="small" color="primary">
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </MenuButton>
                <MenuItems className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded">
                  {canDelete && (
                    <MenuItem as="button" onClick={onDelete}>
                      Delete Comment
                    </MenuItem>
                  )}
                </MenuItems>
              </Menu>
            )}
          </div>
        </div>
        <div className="mt-4 text-sm">
          <p>{text}</p>
        </div>
      </div>
    </Component>
  );
}
