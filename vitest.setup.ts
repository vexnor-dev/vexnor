import { setupFormatter } from "@vexnor/core/format";
import { sqlBuildDefaults } from "@vexnor/core";

setupFormatter({ active: true });
sqlBuildDefaults.boundaryComments = true;
