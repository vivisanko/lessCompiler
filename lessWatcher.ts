import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";

const readFile = promisify(fs.readFile);

interface ILessWatcherData {
    pathToLessc: string;
    filePathMain: string;
    mainObservable: string;
    allObservables:  Map<string, string>;
    regexp: RegExp;
}

export class LessWatcher implements ILessWatcherData {

    constructor() {
    this.pathToLessc =  path.join(__dirname, "node_modules", "less", "bin", "lessc");
    this.filePathMain =  path.join(__dirname, "public", "style.less");
    this.mainObservable = "public/style.less";
    this.allObservables = new Map();
    this.regexp =  /^@import ["'](.+).less["'];$/gm;
    }

    pathToLessc: string = path.join(__dirname, "node_modules", "less", "bin", "lessc");
    filePathMain: string;
    mainObservable: string;
    allObservables:  Map<string, string>;
    regexp: RegExp;

    async processArray(arrayMatches: string [], observables: Map<string, string>) {
    const moreObservables = await Promise.resolve(this.checkObservables);
    let localObservables = observables;
    for (const match of arrayMatches) {
        await moreObservables(match, match.substring(9, match.length - 2))
        .then(otherObservables => {
        localObservables = new Map([...otherObservables, ...localObservables]);
        return Promise.resolve(otherObservables);
        });
    }
    return localObservables;
    }

    execProcess(command: string) {
        childProcess.exec(command, function(_error, stdout, stderr) {

            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);

                if (_error !== null) {
                    console.log(`error: ${String(_error)}`);
                }
        });
    }

    checkObservables = async (filePath: string, observable: string) => {
        this.allObservables.set(filePath, observable);
        let observables = new Map<string, string>();
        const contentPath = path.join(__dirname, observable);
        const content: string = await readFile(contentPath, "utf-8");
        const matches: string [] | null = content.match(this.regexp);
        if (matches) {
            observables = await this.processArray(matches, observables);
        }
        return Promise.resolve(new Map([...observables, ...this.allObservables]));
    }

    getStartedLessMonitoring = async (filePathMatch: string = this.filePathMain, filePath: string = this.mainObservable) => {
        const checkAllObservables = await Promise.resolve(this.checkObservables);
        checkAllObservables(filePathMatch, filePath)
        .catch(err => this.handleError(err))
        .then((observables) => {
            console.log("otherObservable after checking", observables);
            if (observables) {
                Array.from(observables.keys()).forEach(key => {
                    const pathObservable = `./${observables.get(key)}`;

                    const watcher =  fs.watch(pathObservable, (_curr, _prev) => {
                    console.log(`${pathObservable} file Changed`);
                    this.execProcess(`node ${this.pathToLessc} ${this.filePathMain} > ./public/style.css`);
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

    handleError = (err) => {
    console.log("err", err);
    }
}
