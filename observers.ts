import { spawn } from "child_process";
import { LessWatcher } from "./lessWatcher";
import * as path from "path";

const config = {
    pathToLessc: path.join(__dirname, "node_modules", "less", "bin", "lessc"),
    filePathMain: path.join(__dirname, "public", "style.less"),
    fileDirMain: path.join(__dirname, "public"),
    pathForCss: path.join("public", "style.css")
};

const lessMonitoringSystem = new LessWatcher(config);
    lessMonitoringSystem.getStartedLessMonitoring()
      .catch(err => console.log("err", err));

const pathToTsc = path.join(__dirname, "node_modules", "typescript", "bin", "tsc");
const pathToTSConfig =  path.join(__dirname, "tsconfig.json");

const ls = spawn("node", [`${pathToTsc}`, "-p", `${pathToTSConfig}`, "-w"]);

ls.stdout.on("data", data => {
    data && console.log(`Status: ${ data.toString().trim() }`);
});

ls.stderr.on("data", data => {
    console.log(`Error: ${ data }`);
});

ls.on("close", code => {
    console.log(`Closed with code: ${ code }`);
});
