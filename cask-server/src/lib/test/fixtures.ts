import { faker } from "@faker-js/faker";
import { prisma } from "../db";
import {
  Bottle as BottleType,
  Brand as BrandType,
  Distiller as DistillerType,
  User as UserType,
} from "@prisma/client";

function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export const User = async ({ ...data }: Partial<UserType> = {}) => {
  return await prisma.user.create({
    data: {
      displayName: faker.name.firstName(),
      email: faker.internet.email(),
      ...data,
    },
  });
};

export const Brand = async ({ ...data }: Partial<BrandType> = {}) => {
  return await prisma.brand.create({
    data: {
      name: faker.company.name(),
      country: faker.address.country(),
      ...data,
    },
  });
};

export const Distiller = async ({ ...data }: Partial<DistillerType> = {}) => {
  return await prisma.distiller.create({
    data: {
      name: faker.company.name(),
      country: faker.address.country(),
      ...data,
    },
  });
};

export const Bottle = async ({ ...data }: Partial<BottleType> = {}) => {
  if (data.brandId === undefined) data.brandId = (await Brand()).id;
  if (data.distillerId === undefined) {
    if (between(0, 1) === 1) {
      data.distillerId = (await Distiller()).id;
    }
  }

  return await prisma.bottle.create({
    data: {
      name: faker.music.songName(),
      series: faker.music.songName(),
      ...data,
    },
  });
};
