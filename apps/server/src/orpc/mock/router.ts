import activityList from "./routes/activity/list";
import login from "./routes/auth/login";
import bottleDetails from "./routes/bottles/details";
import bottleList from "./routes/bottles/list";
import entityList from "./routes/entities/list";
import root from "./routes/root";
import search from "./routes/search";
import userDetails from "./routes/users/details";

// Requests for routes not listed here return 404 from the mock server.
export const mockRouter = {
  root,
  search,
  activity: {
    list: activityList,
  },
  auth: {
    login,
  },
  bottles: {
    details: bottleDetails,
    list: bottleList,
  },
  entities: {
    list: entityList,
  },
  users: {
    details: userDetails,
  },
};
