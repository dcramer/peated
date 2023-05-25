import type { RouteObject } from "react-router-dom";

import ErrorPage from "./error-page";
import About from "./routes/about";
import Activity from "./routes/activity";
import AddBottle from "./routes/addBottle";
import AddTasting from "./routes/addTasting";
import AuthRequired from "./routes/authRequired";
import BottleActivity from "./routes/bottleActivity";
import BottleDetails from "./routes/bottleDetails";
import BottleList from "./routes/bottles";
import EditBottle from "./routes/editBottle";
import EditEntity from "./routes/editEntity";
import EntityList from "./routes/entities";
import EntityDetails from "./routes/entityDetails";
import Followers from "./routes/followers";
import Following from "./routes/following";
import { default as Friends } from "./routes/friends";
import Login from "./routes/login";
import Notifications from "./routes/notifications";
import Profile from "./routes/profile";
import ProfileActivity from "./routes/profileActivity";
import ProfileCollections from "./routes/profileCollections";
import Root from "./routes/root";
import Search from "./routes/search";
import Settings from "./routes/settings";
import TastingDetails from "./routes/tastingDetails";
import Updates from "./routes/updates";

export default function createRoutes() {
  return [
    {
      path: "/",
      element: <Root />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <Activity /> },
        {
          path: "about",
          element: <About />,
        },
        {
          path: "bottles/",
          element: <BottleList />,
        },
        {
          path: "bottles/:bottleId",
          element: <BottleDetails />,
          children: [
            {
              index: true,
              element: <BottleActivity />,
            },
          ],
        },
        {
          path: "updates",
          element: <Updates />,
        },
        {
          path: "search",
          element: <Search />,
        },
        {
          path: "entities",
          element: <EntityList />,
        },
        {
          path: "entities/:entityId",
          element: <EntityDetails />,
        },
        {
          path: "/login",
          element: <Login />,
        },
        {
          path: "users/:username",
          element: <Profile />,
          children: [
            {
              index: true,
              element: <ProfileActivity />,
            },
            {
              path: "collections",
              element: <ProfileCollections />,
            },
          ],
        },
        {
          path: "tastings/:tastingId",
          element: <TastingDetails />,
        },
        {
          path: "/",
          element: <AuthRequired />,
          children: [
            {
              path: "addBottle",
              element: <AddBottle />,
            },
            {
              path: "bottles/:bottleId/addTasting",
              element: <AddTasting />,
            },
            {
              path: "bottles/:bottleId/edit",
              element: <EditBottle />,
            },
            {
              path: "entities/:entityId/edit",
              element: <EditEntity />,
            },
            {
              path: "friends",
              element: <Friends />,
              children: [
                {
                  index: true,
                  element: <Following />,
                },
                {
                  index: "following",
                  element: <Following />,
                },
                {
                  path: "followers",
                  element: <Followers />,
                },
              ],
            },
            {
              path: "notifications",
              element: <Notifications />,
            },
            {
              path: "settings",
              element: <Settings />,
            },
          ],
        },
      ],
    },
  ] as RouteObject[];
}
