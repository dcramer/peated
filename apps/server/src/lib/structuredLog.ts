import { logInfo as writeInfoLog } from "./log";

type StructuredLogAttributes = Record<
  string,
  string | number | boolean | string[] | number[]
>;

export function logInfo(message: string, attributes: StructuredLogAttributes) {
  writeInfoLog(message, {
    extra: attributes,
  });
}
