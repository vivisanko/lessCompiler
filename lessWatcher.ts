import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";
import * as EventEmitter from "events";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const copyFile = promisify(fs.copyFile);

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
    readonly pathToVariables: string;
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
    private readonly pathToVariables: string;

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

    private fillObservable () {
        this.additionalLess.forEach(additional => {
            this.allObservables.set(additional, path.parse(additional).dir);
        });
    }

    private async processArray(arrayMatches: string [], observables: Map<string, string>, fileDir: string) {
        let localObservables = observables;

        for (const match of arrayMatches) {
            const newPath = path.join(fileDir, match.substring(9, match.length - 2));
            await this.checkObservables(newPath, path.parse(newPath).dir)
                .then(otherObservables => {
                    localObservables = new Map([...otherObservables, ...localObservables]);
                    return Promise.resolve(otherObservables);
                });
        }
        return localObservables;
    }

    private deleteTemporaryDir () {
        if (fs.existsSync(this.tempPath)) {
            fs.unlink(path.join(this.tempPath), (err) => {
                if (err) { throw err; }
            });
        }
    }

    private async transformVariablesAndCompile (additionalVariablePath: string) {
        const addingContent = `\n@import '${path.relative(path.parse(this.pathToVariables).dir, additionalVariablePath).split(path.sep).join("/")}';`;

        await appendFile(this.pathToVariables, addingContent, {flag: "a"});
        this.rebuildLess(this.filePathMain, path.join(path.parse(additionalVariablePath).dir, this.nameForCss));
    }

    private async compileAdditionalStyles() {
        await copyFile(this.pathToVariables, this.tempPath);
        const content = await readFile(this.tempPath, {encoding: "utf8"});

        // tslint:disable-next-line: await-promise
        for await (const additionalVariablePath of this.additionalLess) {
            await this.transformVariablesAndCompile(additionalVariablePath);
            await writeFile(this.pathToVariables, content);
        }
        this.deleteTemporaryDir();
    }

    private createChangeListener (observables: Map <string, string>) {
        const changesEmitter = new EventEmitter();
        let countChanges = 0;

        let watchers = Array.from(observables.keys()).map(key => {
            return fs.watch(key, (_eType, _fileName) => {
                if (_eType === "change" && _fileName === path.parse(key).base) {
                    changesEmitter.emit("changes");
                }
            });
        });

        changesEmitter.on("changes", () => {
            countChanges++;
            if (countChanges > 1) {
                watchers.forEach(watcher => watcher.close());
                watchers = [];
                this.allObservables.clear();
                this.getStartedLessMonitoring()
                .catch(err => {throw err; });
            }
        });
    }

    private readonly mainLessMonitoring = async (filePathMatch: string = this.filePathMain, filePathDir: string = this.fileDirMain) => {
        const observables = await this.checkObservables(filePathMatch, filePathDir);
        if (observables) {
            this.createChangeListener(observables);
        }
    }

    private rebuildLess (filePathMain = this.filePathMain, pathForCss = path.join(this.fileDirMain, this.nameForCss)) {
        childProcess.spawnSync("node", [`${this.pathToLessc}`, `${filePathMain}`, `${pathForCss}`]);
    }

    private async createAdditionalStyles() {
        this.additionalLess = fs.readdirSync(this.additionalDirForCss).flatMap(dirName => {
            return fs.readdirSync(path.join(this.additionalDirForCss, dirName)).map(
                    fileName => path.join(this.additionalDirForCss, dirName, fileName)
                    ).filter(filePath => path.extname(filePath) === ".less");
            });
        await this.compileAdditionalStyles();
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
        this.pathToVariables = config.pathToVariables;
        {}
    }

    allObservables:  Map<string, string> = new Map();
    additionalLess: string [] = [];
    tempPath = path.join(__dirname, "tmp/variables.less");

    async getStartedLessMonitoring () {
    this.rebuildLess();
    if (this.additionalDirForCss) {
        await this.createAdditionalStyles();
        this.fillObservable();
    }

    await this.mainLessMonitoring();
    }

}
