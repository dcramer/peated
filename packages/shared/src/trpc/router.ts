import { router } from ".";
import bottleById from "./routes/bottleById";
import bottleDelete from "./routes/bottleDelete";
import getStats from "./routes/getStats";

export const appRouter = router({
  stats: getStats,
  bottleById,
  bottleDelete,
});

export type AppRouter = typeof appRouter;
