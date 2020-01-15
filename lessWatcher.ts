import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";

const readFile = promisify(fs.readFile);

const DEFAULT_SEPARATE = "/";
const CURRENT_DIR = ".";
const PARENT_DIR = "..";

interface ILessWatcherData {
    pathToLessc: string;
    filePathMain: string;
    fileDirMain: string;
    pathForCss: string;
    allObservables:  Map<string, string>;
    regexp: RegExp;
}

export class LessWatcher implements ILessWatcherData {

    private readonly checkObservables = async (filePath: string, fileDir: string) => {
        this.allObservables.set(filePath, fileDir);
        let observables = new Map<string, string>();
        const content: string = await readFile(filePath, "utf-8");
        const matches: string [] | null = content.match(this.regexp);

        if (matches) {
            observables = await this.processArray(matches, observables, fileDir);
        }
        return Promise.resolve(new Map([...observables, ...this.allObservables]));
    }

    private readonly rebuildLess = () => {
        const cp = childProcess.spawn("node", [`${this.pathToLessc}`, `${this.filePathMain}`, `${this.pathForCss}`]);
        cp.stdout.on("data", data => {
            data && console.log(`Status: ${ data.toString().trim() }`);
        });
        cp.stderr.on("data", data => {
            console.log(`Error: ${ data }`);
        });
        cp.on("close", code => {
            console.log(`Closed with code: ${ code }`);
        });
    }

    private readonly handleError = (err) => {
    console.log("err", err);
    }

    private readonly createPath = (matchPath: string, dir: string) => {
    let dirSeparate: string [] = dir.split(path.sep);
    const matchPathSeparate: string [] = matchPath.split(DEFAULT_SEPARATE);
    const indexEndParentDir: number = matchPathSeparate.lastIndexOf(PARENT_DIR);
    let index: number = indexEndParentDir;

    let newPath: string [];
    if (indexEndParentDir === -1 && matchPath[0] === CURRENT_DIR) {
        newPath = dirSeparate.concat(matchPathSeparate.slice(1, matchPathSeparate.length));
        return newPath;
    }
    if (indexEndParentDir !== -1) {
        while (matchPathSeparate[index] === PARENT_DIR) {
            dirSeparate.pop();
            index--;
        }
        newPath = dirSeparate.concat(matchPathSeparate.slice(indexEndParentDir + 1, matchPathSeparate.length));
        return newPath;
        }
        index = dirSeparate.lastIndexOf(matchPathSeparate[0]);
        if (index === -1) {
            return  dirSeparate.concat(matchPathSeparate);
        }
        const dirnameSeparate = __dirname.split(path.sep);
        return dirnameSeparate.concat(matchPathSeparate);
    }


    private async processArray(arrayMatches: string [], observables: Map<string, string>, fileDir: string) {

        const moreObservables = await Promise.resolve(this.checkObservables);
        let localObservables = observables;

        for (const match of arrayMatches) {

            const newPath = this.createPath(match.substring(9, match.length - 2), fileDir);

        await moreObservables(newPath.join(path.sep), newPath.slice(0, newPath.length - 1).join(path.sep))
        .then(otherObservables => {
        localObservables = new Map([...otherObservables, ...localObservables]);
        return Promise.resolve(otherObservables);
        });
    }
    return localObservables;
    }

    pathToLessc: string = path.join(__dirname, "node_modules", "less", "bin", "lessc");
    filePathMain: string =  path.join(__dirname, "public", "style.less");
    fileDirMain: string =  path.join(__dirname, "public");
    pathForCss: string = path.join("public", "style.css");
    allObservables:  Map<string, string> = new Map();
    regexp: RegExp = /^@import ["'](.+[.less|.css]?)["'];$/gm;

    getStartedLessMonitoring = async (filePathMatch: string = this.filePathMain, filePathDir: string = this.fileDirMain) => {
        const checkAllObservables = await Promise.resolve(this.checkObservables);
        checkAllObservables(filePathMatch, filePathDir)
        .catch(err => this.handleError(err))
        .then((observables) => {
            if (observables) {
                Array.from(observables.keys()).forEach(key => {
                    console.log("observables path", key);

                    const watcher =  fs.watch(key, (_curr, _prev) => {
                    console.log(`${key} file Changed`);
                    this.rebuildLess();
                    watcher.close();
                    this.allObservables.clear();
                    this.getStartedLessMonitoring()
                    .catch(err => this.handleError(err));
                    });
                });
            }
        })
        .catch(err => this.handleError(err));
    }
}
