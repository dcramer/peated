import * as Fixtures from "../lib/test/fixtures";

const main = async () => {
  let bottle;
  for (let i = 0; i < 100; i++) {
    bottle = await Fixtures.Bottle();
    console.log(`${bottle.name} created.`);
  }
};

main();
