"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { User } from "@peated/server/types";
import { Link } from "@tanstack/react-router";
import button from "./button";
import { Slot } from "./slot";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

type Props = {
  createdAt: string | Date;
  createdBy: User;
  text: string;
  canDelete?: boolean;
  onDelete?: () => void;
  asChild?: boolean;
} & React.ComponentPropsWithoutRef<"li">;

export default function CommentEntry({
  asChild = false,
  createdAt,
  createdBy,
  text,
  canDelete,
  onDelete,
  ...props
}: Props) {
  const Component = asChild ? Slot : "li";

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
                to="/users/$username"
                params={{ username: createdBy.username }}
                className="font-semibold hover:underline"
              >
                {createdBy.username}
              </Link>
            </div>
            <div className="text-muted text-sm">
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
