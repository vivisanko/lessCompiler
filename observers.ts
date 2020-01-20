import { spawn } from "child_process";
import { LessWatcher } from "./lessWatcher";
import * as path from "path";
import * as JSONConfig from "./config.json";

const {lessCompiler, tscCompiler} = JSONConfig;

const config = {
    pathToLessc: path.join(__dirname, lessCompiler.pathToLessc),
    filePathMain: path.join(__dirname, lessCompiler.filePathToMainLess),
    fileDirMain: path.join(__dirname, lessCompiler.fileDirMain),
    nameForCss: lessCompiler.nameForCss,
    pathToVariables: path.join(__dirname, lessCompiler.pathToVariables),
    additionalDirForCss: path.join(__dirname, lessCompiler.additionalDirForCss)
};

const lessMonitoringSystem = new LessWatcher(config);
   lessMonitoringSystem.getStartedLessMonitoring()
   .catch(err => {throw err; });

const pathToTsc = path.join(__dirname, tscCompiler.pathToTsc);
const pathToTSConfig =  path.join(__dirname, tscCompiler.pathToTSConfig);

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
