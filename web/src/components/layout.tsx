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
        "bg-red-600",
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
                      <Menu.Button className="flex max-w-xs items-center rounded-full bg-red-600 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-600">
                        <span className="sr-only">Open user menu</span>
                        <UserCircleIcon className="h-8 w-8 rounded-full" />
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
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-red-600 p-2 text-red-200 hover:bg-red-500 hover:bg-opacity-75 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-600">
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
              <div className="border-red-700 pb-3 pt-4">
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    <UserCircleIcon className="h-10 w-10 rounded-full" />
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-white">
                      {user.displayName}
                    </div>
                    <div className="text-sm font-medium text-red-300">
                      {user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-auto flex-shrink-0 rounded-full border-2 border-transparent bg-red-600 p-1 text-red-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-600"
                  >
                    <span className="sr-only">View notifications</span>
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-3 space-y-1 px-2">
                  <Disclosure.Button
                    as="a"
                    className="block rounded-md px-3 py-2 text-base font-medium text-white hover:bg-red-500 hover:bg-opacity-75"
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
          splash ? "bg-red-600 text-white" : " bg-white"
        }`}
      >
        {(!noHeader || header) && <AppHeader excludeMobile={noMobileHeader} />}
        <main className="mx-auto max-w-4xl py-6 sm:px-6 lg:px-8 relative">
          {children}
        </main>
      </div>
    </>
  );
}
