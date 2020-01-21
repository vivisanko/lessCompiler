import { LessWatcher } from "./lessWatcher";
import * as path from "path";
import * as JSONConfig from "./config.json";

const {lessCompiler} = JSONConfig;

const config = {
    pathToLessc: path.join(__dirname, lessCompiler.pathToLessc),
    filePathMain: path.join(__dirname, lessCompiler.filePathToMainLess),
    fileDirMain: path.join(__dirname, lessCompiler.fileDirMain),
    nameForCss: lessCompiler.nameForCss,
    pathToVariables: path.join(__dirname, lessCompiler.pathToVariables),
    additionalDirForCss: path.join(__dirname, lessCompiler.additionalDirForCss)
};

const compilerLess = new LessWatcher(config);
    compilerLess.startLogger();
    compilerLess.rebuildLess()
    .catch(err => {console.log("err", err);
     });
    compilerLess.checkErrors();
if (config.pathToVariables) {
    compilerLess.createAdditionalStyles()
    .catch(err => {throw err; });
}
