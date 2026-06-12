import { setupFormatter } from "vexnor/format";
import { sqlBuildDefaults } from "vexnor";

setupFormatter({ active: true });
sqlBuildDefaults.boundaryComments = true;
