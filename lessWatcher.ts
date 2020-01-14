import * as fs from "fs";
import * as path from "path";
// import * as childProcess from "child_process";
import { promisify } from "util";

const readFile = promisify(fs.readFile);

const DEFAULT_SEPARATE = "/";

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
        console.log("matches", matches);


        if (matches) {
            observables = await this.processArray(matches, observables, fileDir);
        }
        return Promise.resolve(new Map([...observables, ...this.allObservables]));
    }

    // private readonly rebuildLess = () => {
    //     const cp = childProcess.spawn("node", [`${this.pathToLessc}`, `${this.filePathMain}`, `${this.pathForCss}`]);
    //     cp.stdout.on("data", data => {
    //         data && console.log(`Status: ${ data.toString().trim() }`);
    //     });
    //     cp.stderr.on("data", data => {
    //         console.log(`Error: ${ data }`);
    //     });
    //     cp.on("close", code => {
    //         console.log(`Closed with code: ${ code }`);
    //     });
    // }

    private readonly handleError = (err) => {
    console.log("err", err);
    }

    private readonly createPath = (matchPath: string, dir: string) => {
    console.log("matchPath", matchPath);
    console.log("dir", dir);
    console.log("dir.split(path.sep)", dir.split(path.sep));
    console.log("match.split(/)", matchPath.split("/"));
    const dirSeparate = dir.split(path.sep);
    console.log("dirSeparate", dirSeparate);
    const matchPathSeparate = matchPath.split(DEFAULT_SEPARATE);
    console.log("matchPathSeparate", matchPathSeparate);
    if (matchPathSeparate[0] === ".") {
    console.log("think through logic");
        return dirSeparate.concat(matchPathSeparate.slice(1, matchPathSeparate.length)).join(path.sep);
    }

    return "";
    }

    private async processArray(arrayMatches: string [], observables: Map<string, string>, fileDir: string) {

        const moreObservables = await Promise.resolve(this.checkObservables);
        let localObservables = observables;

        for (const match of arrayMatches) {

            const newPath = this.createPath(match.substring(9, match.length - 2), fileDir);
            console.log("newPath", newPath);

        await moreObservables(match, match.substring(9, match.length - 2))
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
            console.log("otherObservable after checking", observables);
            if (observables) {
                Array.from(observables.keys()).forEach(key => {
                    // const pathObservable = `./${observables.get(key)}`;
                    console.log("key", key);

                    // const watcher =  fs.watch(pathObservable, (_curr, _prev) => {
                    // console.log(`${pathObservable} file Changed`);
                    // this.rebuildLess();
                    // watcher.close();
                    // this.allObservables.clear();
                    // this.getStartedLessMonitoring()
                    // .catch(err => this.handleError(err));
                    // });
                });
            }
        })
        .catch(err => this.handleError(err));
    }
}
