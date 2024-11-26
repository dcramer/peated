// app/services/session.server.ts
import type { User } from "@prisma/client";
import { useSession } from "vinxi/http";

type SessionUser = {
  userEmail: User["email"];
};

export function useAppSession() {
  return useSession<SessionUser>({
    password: "ChangeThisBeforeShippingToProdOrYouWillBeFired",
  });
}
