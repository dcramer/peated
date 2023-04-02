import app from "./app";
import config from "./config";

app.listen(
  {
    port: config.PORT as number,
  },
  () => {
    app.log.info(`app running on ${config.HOST}:${config.PORT}/`);
  }
);
