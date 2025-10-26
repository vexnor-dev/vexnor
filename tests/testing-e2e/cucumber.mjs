import { GetEnvVars } from "env-cmd";

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
      paths: ["./src/e2e/features/*.feature"],
      loader: ["ts-node/esm"],
      import: ["./src/e2e/step_definitions/**", "./src/e2e/hooks/*.ts", "./src/e2e/test-world.ts"],
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
