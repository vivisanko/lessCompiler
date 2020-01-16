import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";

const readFile = promisify(fs.readFile);

interface ILessWatcher {
    getStartedLessMonitoring(filePathMatch?: string, filePathDir?: string): Promise<void>;
}

interface IMatchChecking {
    findMatches(content: string): string [] | null;
}

interface ILessWatcherOptions {
    readonly pathToLessc: string;
    readonly filePathMain: string;
    readonly fileDirMain: string;
    readonly nameForCss: string;
    readonly additionalDirForCss: string;
}

class MatchChecking implements IMatchChecking {
    private readonly regexp = /^@import ["'](.+[.less|.css]?)["'];$/gm;

    findMatches(content: string) {
       return content.match(this.regexp);
    }
}

export class LessWatcher extends MatchChecking implements ILessWatcher {
    private readonly pathToLessc: string;
    private readonly filePathMain: string;
    private readonly fileDirMain: string;
    private readonly nameForCss: string;
    private readonly additionalDirForCss: string;

    private readonly checkObservables = async (filePath: string, fileDir: string) => {
        this.allObservables.set(filePath, fileDir);
        let observables = new Map<string, string>();
        const content: string = await readFile(filePath, "utf-8");
        const matches: string [] | null = this.findMatches(content);

        if (matches) {
            observables = await this.processArray(matches, observables, fileDir);
        }
        return Promise.resolve(new Map([...observables, ...this.allObservables]));
    }

    private rebuildLess (filePathMain, pathForCss) {
        console.log("pathForCss", pathForCss);

        const cp = childProcess.spawn("node", [`${this.pathToLessc}`, `${filePathMain}`, `${pathForCss}`]);
        cp.stdout.on("data", data => {
            data && console.log(`Status less: ${ data.toString().trim() }`);
        });
        cp.stderr.on("data", data => {
            console.log(`Error less: ${ data }`);
        });
        cp.on("close", code => {
            console.log(`Closed less with code: ${ code }`);
        });
    }

    private readonly handleError = (err) => {
        throw err;
    }

    private async processArray(arrayMatches: string [], observables: Map<string, string>, fileDir: string) {

        let localObservables = observables;

        for (const match of arrayMatches) {
            console.log("this.allObservables", this.allObservables);

            const newPath = path.join(fileDir, match.substring(9, match.length - 2));
            await this.checkObservables(newPath, path.parse(newPath).dir)
                .then(otherObservables => {
                    localObservables = new Map([...otherObservables, ...localObservables]);
                    return Promise.resolve(otherObservables);
                });
        }
        return localObservables;
    }

    private additionalLessMonitoring() {
        console.log("this.additionalDirForCss", this.additionalDirForCss);
        this.additionalLess = fs.readdirSync(this.additionalDirForCss).flatMap(dirName => {
            return fs.readdirSync(path.join(this.additionalDirForCss, dirName)).map(
                    fileName => path.join(this.additionalDirForCss, dirName, fileName)
                    ).filter(filePath => path.extname(filePath) === ".less");
            });
        console.log("this.additionalLess", this.additionalLess);
        this.createAdditionalStyles();
    }

    private createAdditionalStyles() {
        // here must be logic copy, paste, compile and insert in brand dir
        // fs.copyFile(this.filePathMain, path.join(__dirname, "tmp/style.less"), (err) => {
        //     if (err) { throw err; }
        //     console.log("source.txt was copied to destination.txt");
        // });
        console.log("createAdditionalStyles");

    }

    private readonly mainLessMonitoring = async (filePathMatch: string = this.filePathMain, filePathDir: string = this.fileDirMain) => {

        await this.checkObservables(filePathMatch, filePathDir)
            .catch(err => this.handleError(err))
            .then((observables) => {
                if (observables) {
                    Array.from(observables.keys()).forEach(key => {
                        console.log("path to observable", key);

                        const watcher =  fs.watch(key, (_curr, _prev) => {
                            console.log(`${String(key)} file Changed`);
                            watcher.close();
                            this.allObservables.clear();
                            this.rebuildLess(this.filePathMain, path.join(this.fileDirMain, this.nameForCss));
                            this.mainLessMonitoring()
                                .catch(err => this.handleError(err));
                        });
                    });
                }
            })
            .catch(err => this.handleError(err));
    }

    constructor (
        config: ILessWatcherOptions
    ) {
        super();
        this.pathToLessc = config.pathToLessc;
        this.filePathMain = config.filePathMain;
        this.fileDirMain = config.fileDirMain;
        this.nameForCss = config.nameForCss;
        this.additionalDirForCss = config.additionalDirForCss;
        {}
    }

   allObservables:  Map<string, string> = new Map();
   additionalLess: string [] = [];

   getStartedLessMonitoring = async () => {
    this.additionalLessMonitoring();
    await this.mainLessMonitoring();
   }

}
