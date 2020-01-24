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
    .then(() => new Promise((res, rej) => {
        if (compilerLess.checkIsWithErrors()) {
            compilerLess.logErrors();
            rej();
        }
        res();
    }))
    .then(() => {
        if (config.pathToVariables) {
            compilerLess.createAdditionalStyles()
            .then(() => new Promise((res, rej) => {
                if (compilerLess.checkIsWithErrors()) {
                    compilerLess.logErrors();
                    rej();
                }
                res();
            }))
            .catch(_err => {});
        }
    })
    .catch(_err => {});
