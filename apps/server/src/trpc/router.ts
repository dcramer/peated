import { router } from ".";
import bottleById from "./routes/bottleById";
import bottleDelete from "./routes/bottleDelete";
import getStats from "./routes/getStats";
import userById from "./routes/userById";

export const appRouter = router({
  stats: getStats,
  bottleById,
  bottleDelete,
  userById,
});

export type AppRouter = typeof appRouter;
