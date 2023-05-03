import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";

import useAuth from "../hooks/useAuth";
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
          <PeatedGlyph className="h-5 text-white" />
        </Link>
      </div>
    </>
  );
};

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <HeaderLogo />
      <form
        className={`ml-4 md:ml-9 lg:ml-12 flex-1`}
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/search`);
        }}
      >
        <input
          name={"q"}
          placeholder="Search for a bottle"
          className="rounded focus:outline focus:outline-peated-light text-xs sm:text-base min-w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-peated-darker text-white"
        />
      </form>
      {user && (
        <div>
          <div className="ml-4 flex items-center md:ml-9 lg:ml-12">
            <Menu as="div" className="relative ml-3">
              <div>
                <Menu.Button className="flex max-w-xs items-center rounded bg-peated text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-peated">
                  <span className="sr-only">Open user menu</span>
                  <span className="inline-block h-6 w-6 sm:h-10 sm:w-10 overflow-hidden rounded bg-gray-100">
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
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 w-full"
                      to={`/users/${user.id}`}
                    >
                      Profile
                    </Link>
                  </Menu.Item>
                  {user.admin && (
                    <Menu.Item>
                      <Link
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 w-full"
                        to={`/admin`}
                      >
                        Admin
                      </Link>
                    </Menu.Item>
                  )}
                  <Menu.Item>
                    <button
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 w-full text-left"
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
      )}
    </>
  );
}
