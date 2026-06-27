import { Storage } from "@google-cloud/storage";
import config from "../config";

let storage: Storage | null = null;

export function getStorage() {
  storage ??= new Storage({
    credentials: config.GCP_CREDENTIALS,
  });

  return storage;
}
