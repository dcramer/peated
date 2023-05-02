import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

import useAuth from "../hooks/useAuth";
import classNames from "../lib/classNames";
import PeatedLogo from "../assets/logo.svg";
import PeatedGlyph from "../assets/glyph.svg";
import UserAvatar from "./userAvatar";

const HeaderLogo = () => {
  return (
    <>
      <div className="hidden sm:flex">
        <Link to="/">
          <PeatedLogo className="h-8 text-white" />
        </Link>
      </div>
      <div className="flex sm:hidden">
        <Link to="/">
          <PeatedGlyph className="h-4 text-white" />
        </Link>
      </div>
    </>
  );
};

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Disclosure>
      {({ open }) => (
        <>
          <HeaderLogo />
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <Menu as="div" className="relative ml-3">
                <div>
                  <Menu.Button className="flex max-w-xs items-center rounded-full bg-peated text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-peated">
                    <span className="sr-only">Open user menu</span>
                    <span className="inline-block h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                      <UserAvatar user={user} />
                    </span>
                  </Menu.Button>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                      <button
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 w-full"
                        onClick={() => {
                          logout();
                          navigate("/");
                        }}
                      >
                        Sign out
                      </button>
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-peated p-2 text-peated-light hover:bg-peated hover:bg-opacity-75 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-peated">
              <span className="sr-only">Open main menu</span>
              {open ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </Disclosure.Button>
          </div>

          {user && (
            <Disclosure.Panel className="md:hidden">
              <div className="border-peated pb-3 pt-4">
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    <span className="inline-block h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                      <UserAvatar user={user} />
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-white">
                      {user.displayName}
                    </div>
                    <div className="text-sm font-medium text-peated-light">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 px-2">
                  <Disclosure.Button
                    as="button"
                    className="min-w-full text-left block rounded-md px-3 py-2 text-base font-medium text-white hover:bg-peated hover:bg-opacity-75"
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                  >
                    Sign out
                  </Disclosure.Button>
                </div>
              </div>
            </Disclosure.Panel>
          )}
        </>
      )}
    </Disclosure>
  );
}
