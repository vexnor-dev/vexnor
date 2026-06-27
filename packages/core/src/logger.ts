import { pino, stdTimeFunctions } from "pino";
import { LOG_LEVEL } from "#src/config.js";

const opts: pino.LoggerOptions = {
   formatters: {
      level: (label) => ({ level: label }),
   },
   level: LOG_LEVEL,
   timestamp: stdTimeFunctions.isoTime,
};

export const logger = pino(opts);
