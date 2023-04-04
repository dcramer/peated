import { prisma } from "../lib/db";

import "../lib/test/expects";

global.DefaultFixtures = {};

const clearDatabase = async () => {
  const schemaName = "public";

  // TODO: good idea, but too slow
  const tnQuery = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname=${schemaName};`;
  const tableNames = tnQuery
    .filter(({ tablename }) => tablename !== "_prisma_migrations")
    .map(({ tablename }) => `"${schemaName}"."${tablename}"`)
    .join(", ");

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE;`);
  } catch (error) {
    console.log({ error });
  }

  // reset sequences
  const snQuery = await prisma.$queryRaw<
    Array<{ relname: string }>
  >`SELECT c.relname FROM pg_class AS c JOIN pg_namespace AS n ON c.relnamespace = n.oid WHERE c.relkind='S' AND n.nspname=${schemaName};`;
  for (const { relname } of snQuery) {
    await prisma.$executeRawUnsafe(
      `ALTER SEQUENCE \"${schemaName}\".\"${relname}\" RESTART WITH 1;`
    );
  }
};

const createDefaultUser = async () => {
  return await prisma.user.create({
    data: {
      // id: "1",
      email: "fizz.buzz@example.com",
      displayName: "Fizzy Buzz",
    },
  });
};

beforeEach(async () => {
  await clearDatabase();

  global.DefaultFixtures = {};

  global.DefaultFixtures.DEFAULT_USER = await createDefaultUser();
});

afterEach(async () => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});
