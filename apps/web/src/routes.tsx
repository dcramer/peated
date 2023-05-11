import type { RouteObject } from "react-router-dom";

import Root from "./routes/root";
import ErrorPage from "./error-page";
import AddTasting, { loader as addTastingLoader } from "./routes/addTasting";
import Activity, { loader as activityLoader } from "./routes/activity";
import Search from "./routes/search";
import Login from "./routes/login";
import AddBottle from "./routes/addBottle";
import BottleDetails, {
  loader as bottleDetailsLoader,
} from "./routes/bottleDetails";
import BrandDetails, {
  loader as brandDetailsLoader,
} from "./routes/brandDetails";
import DistillerDetails, {
  loader as distillerDetailsLoader,
} from "./routes/distillerDetails";
import UserDetails, { loader as userDetailsLoader } from "./routes/userDetails";
import Settings, { loader as settingsLoader } from "./routes/settings";
import EditBottle, { loader as editBottleLoader } from "./routes/editBottle";
import BottleList, { loader as bottleListLoader } from "./routes/bottles";
import DistillerList, {
  loader as distillerListLoader,
} from "./routes/distillers";
import BrandList, { loader as brandListLoader } from "./routes/brands";

export default function createRoutes() {
  return [
    {
      path: "/",
      element: <Root />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <Activity />, loader: activityLoader },
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
          loader: bottleListLoader,
        },
        {
          path: "bottles/:bottleId/edit",
          element: <EditBottle />,
          loader: editBottleLoader,
        },
        {
          path: "brands",
          element: <BrandList />,
          loader: brandListLoader,
        },

        {
          path: "brands/:brandId",
          element: <BrandDetails />,
          loader: brandDetailsLoader,
        },
        {
          path: "distillers",
          element: <DistillerList />,
          loader: distillerListLoader,
        },
        {
          path: "distillers/:distillerId",
          element: <DistillerDetails />,
          loader: distillerDetailsLoader,
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
          element: <UserDetails />,
          loader: userDetailsLoader,
        },
      ],
    },
    {
      path: "/login",
      element: <Login />,
    },
  ] as RouteObject[];
}
