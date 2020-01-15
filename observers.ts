import { spawn } from "child_process";
import { LessWatcher } from "./lessWatcher";
import * as path from "path";


const lessMonitoringSystem = new LessWatcher();
lessMonitoringSystem.getStartedLessMonitoring()
.catch(err => console.log("err", err));

const pathToTsc = path.join(__dirname, "node_modules", "typescript", "bin", "tsc");

const ls = spawn("node", [`${pathToTsc}`, "-p", "tsconfig.json", "-w"]);

ls.stdout.on("data", data => {
    data && console.log(`Status: ${ data.toString().trim() }`);
});

ls.stderr.on("data", data => {
    console.log(`Error: ${ data }`);
});

ls.on("close", code => {
    console.log(`Closed with code: ${ code }`);
});
