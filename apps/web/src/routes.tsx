import type { RouteObject } from "react-router-dom";

import ErrorPage from "./error-page";
import About from "./routes/about";
import Activity from "./routes/activity";
import AddBottle from "./routes/addBottle";
import AddTasting, { loader as addTastingLoader } from "./routes/addTasting";
import BottleDetails, {
  loader as bottleDetailsLoader,
} from "./routes/bottleDetails";
import BottleList from "./routes/bottles";
import EditBottle, { loader as editBottleLoader } from "./routes/editBottle";
import EditEntity, { loader as editEntityLoader } from "./routes/editEntity";
import EntityList, { loader as entityListLoader } from "./routes/entities";
import EntityDetails, {
  loader as entityDetailsLoader,
} from "./routes/entityDetails";
import FriendList, { loader as friendListLoader } from "./routes/friendList";
import FriendRequests, {
  loader as friendRequestsLoader,
} from "./routes/friendRequests";
import { default as Friends } from "./routes/friends";
import Login from "./routes/login";
import Notifications from "./routes/notifications";
import Profile from "./routes/profile";
import ProfileActivity from "./routes/profileActivity";
import ProfileCollections from "./routes/profileCollections";
import Root from "./routes/root";
import Search from "./routes/search";
import Settings, { loader as settingsLoader } from "./routes/settings";
import TastingDetails from "./routes/tastingDetails";

export default function createRoutes() {
  return [
    {
      path: "/",
      element: <Root />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <Activity /> },
        {
          path: "addBottle",
          element: <AddBottle />,
        },
        {
          path: "bottles/:bottleId",
          element: <BottleDetails />,
          loader: bottleDetailsLoader,
        },
        {
          path: "bottles/:bottleId/addTasting",
          element: <AddTasting />,
          loader: addTastingLoader,
        },
        {
          path: "bottles/",
          element: <BottleList />,
        },
        {
          path: "bottles/:bottleId/edit",
          element: <EditBottle />,
          loader: editBottleLoader,
        },
        {
          path: "entities",
          element: <EntityList />,
          loader: entityListLoader,
        },
        {
          path: "entities/:entityId",
          element: <EntityDetails />,
          loader: entityDetailsLoader,
        },
        {
          path: "entities/:entityId/edit",
          element: <EditEntity />,
          loader: editEntityLoader,
        },
        {
          path: "friends",
          element: <Friends />,
          children: [
            {
              index: true,
              element: <FriendList />,
              loader: friendListLoader,
            },
            {
              path: "requests",
              element: <FriendRequests />,
              loader: friendRequestsLoader,
            },
          ],
        },
        {
          path: "notifications",
          element: <Notifications />,
        },
        {
          path: "search",
          element: <Search />,
        },
        {
          path: "settings",
          element: <Settings />,
          loader: settingsLoader,
        },
        {
          path: "users/:userId",
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
      ],
    },
    {
      path: "about",
      element: <About />,
    },
    {
      path: "/login",
      element: <Login />,
    },
  ] as RouteObject[];
}
