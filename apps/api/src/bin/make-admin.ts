import { hashSync } from "bcrypt";
import { prisma } from "../lib/db";
import { createInterface } from "readline/promises";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const main = async () => {
  const email = await readline.question("Email? ");
  readline.close();

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: email },
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      admin: true,
    },
  });

  console.log(`${user.email} updated to be admin.`);
};

main();
