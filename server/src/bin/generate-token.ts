import { createAccessToken } from "../lib/auth";
import { prisma } from "../lib/db";

const main = async (email: string) => {
  if (!email) {
    throw new Error("No email specified");
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
  });

  const token = await createAccessToken({
    id: user.id,
    admin: user.admin,
  });

  console.log(`ACCESS_TOKEN=${token}`);
};

main(process.argv[2]);
