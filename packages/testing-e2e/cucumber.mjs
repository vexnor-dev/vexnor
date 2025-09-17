import { GetEnvVars } from "env-cmd";
import { processRules } from "eslint-config-prettier/bin/cli.js";

export default function () {
   const common = {
      format: [
         "progress-bar",
         "summary",
         "html:test-results/cucumber-report.html",
         "json:test-results/cucumber-report.json",
         "message:test-results/cucumber-messages.json",
         "junit:test-results/cucumber-junit.xml",
      ],
      formatOptions: {
         junit: {
            suiteName: "Cucumber Tests",
            uniqueTestNames: true,
         },
         html: {
            theme: "bootstrap",
            reportTitle: "E2E Test Report",
         },
      },
      paths: ["./features/postgres.feature", "./features/sqlite.feature"],
      loader: ["ts-node/esm"],
      import: ["./src/steps/postgres/*.ts", "./src/steps/sqlite/*.ts", "./src/hooks/*.ts", "./src/test-world.ts"],
   };

   return {
      devops: {
         parallel: 10,
         ...common,
         worldParameters: {
            config: {},
         },
      },
      default: {
         ...common,
         worldParameters: {
            config: {},
         },
      },
   };
}

const envDevVars = await GetEnvVars({
   rc: {
      environments: ["db"],
      filePath: "../../env-dev.json",
   },
   verbose: true,
});

Object.assign(process.env, envDevVars);
