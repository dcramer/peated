import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  BellIcon,
  XMarkIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import PeatedLogo from "../assets/logo.svg";

import useAuth from "../hooks/useAuth";
import { Link } from "react-router-dom";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const AppHeader = ({ excludeMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Disclosure
      as="nav"
      className={classNames(
        "bg-peated",
        excludeMobile ? "hidden sm:block" : ""
      )}
    >
      {({ open }) => (
        <>
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex">
                <Link to="/">
                  <PeatedLogo style={{ height: 28, color: "#ffffff" }} />
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="ml-4 flex items-center md:ml-6">
                  <Menu as="div" className="relative ml-3">
                    <div>
                      <Menu.Button className="flex max-w-xs items-center rounded-full bg-peated text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-peated">
                        <span className="sr-only">Open user menu</span>
                        <span className="inline-block h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                          <svg
                            className="h-full w-full text-gray-300"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </span>{" "}
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
            </div>
          </div>

          {user && (
            <Disclosure.Panel className="md:hidden">
              <div className="border-peated pb-3 pt-4">
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    <span className="inline-block h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                      <svg
                        className="h-full w-full text-gray-300"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
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
                    className="w-full text-left block rounded-md px-3 py-2 text-base font-medium text-white hover:bg-peated hover:bg-opacity-75"
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
};

export default function Layout({
  children,
  header,
  splash,
  noHeader,
  noMobileHeader,
}: {
  children: any;
  header?: any;
  noHeader?: boolean;
  splash?: boolean;
  noMobileHeader?: boolean;
  onSave?: any;
}) {
  return (
    <>
      <div
        className={`min-h-full ${
          splash ? "bg-peated text-white" : " bg-white"
        }`}
      >
        {!noHeader && (header || <AppHeader excludeMobile={noMobileHeader} />)}
        <main className="mx-auto max-w-4xl py-6 sm:px-6 lg:px-8 relative">
          {children}
        </main>
      </div>
    </>
  );
}
