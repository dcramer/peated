import { gracefulShutdown, scheduleJob } from "node-schedule";
import { main as totalwines } from "./price-scraper/totalwines";
import { main as woodencork } from "./price-scraper/woodencork";

scheduleJob("0 0 * * *", async () => {
  console.log("Scraping Wooden Cork");
  await woodencork();
});

scheduleJob("0 1 * * *", async () => {
  console.log("Scraping Total Wines");
  await totalwines();
});

process.on("SIGINT", function () {
  gracefulShutdown().then(() => process.exit(0));
});
