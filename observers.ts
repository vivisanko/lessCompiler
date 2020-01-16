import { spawn } from "child_process";
import { LessWatcher } from "./lessWatcher";
import * as path from "path";
import * as JSONConfig from "./config.json";


const config = {
    pathToLessc: path.join(__dirname, JSONConfig.pathToLessc),
    filePathMain: path.join(__dirname, JSONConfig.filePathMain),
    fileDirMain: path.join(__dirname, JSONConfig.fileDirMain),
    nameForCss: JSONConfig.nameForCss,
    additionalDirForCss: path.join(__dirname, JSONConfig.additionalDirForCss)
};

console.log("config", config);


const lessMonitoringSystem = new LessWatcher(config);
    lessMonitoringSystem.getStartedLessMonitoring()
      .catch(err => console.log("err", err));

const pathToTsc = path.join(__dirname, JSONConfig.pathToTsc);
const pathToTSConfig =  path.join(__dirname, JSONConfig.pathToTSConfig);

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
