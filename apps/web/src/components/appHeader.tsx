import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";

import useAuth from "../hooks/useAuth";
import { ReactComponent as PeatedLogo } from "../assets/logo.svg";
import { ReactComponent as PeatedGlyph } from "../assets/glyph.svg";
import UserAvatar from "./userAvatar";

const HeaderLogo = () => {
  return (
    <>
      <div className="hidden sm:flex">
        <Link to="/">
          <PeatedLogo className="h-10 text-white" />
        </Link>
      </div>
      <div className="flex sm:hidden">
        <Link to="/">
          <PeatedGlyph className="h-8 text-white" />
        </Link>
      </div>
    </>
  );
};

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");

  return (
    <>
      <HeaderLogo />
      <form
        className={`ml-4 sm:ml-12 flex flex-1 justify-end`}
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <input
          name="q"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a bottle"
          autoComplete="off"
          className="rounded focus:outline focus:outline-peated-light transition-all duration-500 transform w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-peated-darker text-white"
        />
      </form>
      {user && (
        <div className="ml-4 sm:ml-12 flex items-center">
          <Menu as="div" className="relative">
            <div>
              <Menu.Button className="flex max-w-xs items-center rounded bg-peated text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-peated">
                <span className="sr-only">Open user menu</span>
                <span className="inline-block h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded bg-gray-100">
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  <Link
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-200 w-full"
                    to={`/users/${user.id}`}
                  >
                    Profile
                  </Link>
                </Menu.Item>
                <Menu.Item>
                  <button
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-200 w-full text-left"
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
      )}
    </>
  );
}
