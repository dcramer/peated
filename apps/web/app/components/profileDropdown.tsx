import { Menu, Transition } from "@headlessui/react";
import { Link, useSubmit } from "@remix-run/react";
import { Fragment, useRef } from "react";
import useAuth from "~/hooks/useAuth";
import UserAvatar from "./userAvatar";

export function ProfileDropdown() {
  const { user } = useAuth();
  const submit = useSubmit();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const timeoutDuration = 200;
  let timeoutId: ReturnType<typeof setTimeout>;

  if (!user) return null;

  const openMenu = () => buttonRef?.current?.click();
  const closeMenu = () =>
    dropdownRef?.current?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

  const onMouseEnter = (closed?: boolean) => {
    if (timeoutId) clearTimeout(timeoutId);
    if (closed) openMenu();
  };
  const onMouseLeave = (open: boolean) => {
    if (open) {
      timeoutId = setTimeout(() => closeMenu(), timeoutDuration);
    }
  };

  return (
    <Menu as="div" className="menu hidden sm:block">
      {({ open }) => (
        <>
          <Menu.Button
            ref={buttonRef}
            className="focus:ring-highlight relative flex max-w-xs items-center rounded p-2 text-sm text-slate-500 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring"
            onClick={openMenu}
            onMouseEnter={() => onMouseEnter(!open)}
            onMouseLeave={() => onMouseLeave(open)}
          >
            <span className="sr-only">Open user menu</span>
            <div className="h-8 w-8 sm:h-8 sm:w-8">
              <UserAvatar user={user} />
            </div>
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items
              ref={dropdownRef}
              onMouseEnter={() => onMouseEnter()}
              onMouseLeave={() => onMouseLeave(open)}
              static
              className="absolute right-0 z-10 mt-2 w-48 origin-top-right divide-y divide-slate-700"
            >
              <div>
                <Menu.Item>
                  <Link to={`/users/${user.username}`}>Profile</Link>
                </Menu.Item>
                <Menu.Item>
                  <button
                    onClick={() => {
                      submit(null, { method: "POST", action: "/logout" });
                    }}
                  >
                    Sign out
                  </button>
                </Menu.Item>
              </div>
              <div>
                <Menu.Item>
                  <Link to={`/friends`}>Friends</Link>
                </Menu.Item>
                <Menu.Item>
                  <Link to={`/bottles`}>Bottles</Link>
                </Menu.Item>
                <Menu.Item>
                  <Link to={`/entities`}>Brands & Distillers</Link>
                </Menu.Item>
                <Menu.Item>
                  <Link to={`/about`}>About</Link>
                </Menu.Item>
              </div>
              {user.admin && (
                <div>
                  <Menu.Item>
                    <Link to={`/admin`}>Admin</Link>
                  </Menu.Item>
                </div>
              )}
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}
