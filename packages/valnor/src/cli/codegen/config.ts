import pino from "pino";

export const LOG_LEVEL: pino.Level = (() => {
   if (!process.env.LOG_LEVEL) {
      return "info";
   }

   if (!isLogLevel(process.env.LOG_LEVEL)) {
      return "info";
   }

   return process.env.LOG_LEVEL;
})();

function isLogLevel(level: string): level is pino.Level {
   return ["fatal", "error", "warn", "info", "debug", "trace"].includes(level);
}
