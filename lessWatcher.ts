import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";
import * as EventEmitter from "events";
import { Console } from "console";
import * as process from "process";

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

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
    private readonly regexp = /^@import ["'][^@{theme}](.+[.less|.css]?)["'];$/gm;

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
        return new Map([...observables, ...this.allObservables]);
    }

    private fillObservable () {
        this.additionalLess.forEach(additional => {
            this.allObservables.set(additional, path.parse(additional).dir);
        });
    }

    private async processArray(arrayMatches: string [], observables: Map<string, string>, fileDir: string) {
        let localObservables = observables;

        for (const match of arrayMatches) {
            const newPath = await this.transformPath(fileDir, match.substring(9, match.length - 2));
            const otherObservables = newPath ? await this.checkObservables(newPath, path.parse(newPath).dir) : new Map();
            localObservables = new Map([...otherObservables, ...localObservables]);
        }
        return localObservables;
    }

    private async compileAdditionalStyles() {
        let controller = new EventEmitter();
        const promisesOfRecompile = this.additionalLess.map(additionalPath => this.rebuildLess(this.filePathMain, path.parse(additionalPath).dir, controller));

        await Promise.all(promisesOfRecompile);
    }

    private async transformPath(fileDir, match) {
        let transformedPath = path.join(fileDir, match);
        if (path.parse(transformedPath).ext === "") {
            transformedPath += ".less";
        }
        try {
            await stat(transformedPath);
            return transformedPath;
        } catch (_err) {}
        try {
            await stat(transformedPath.replace(/.less$/, ".css"));
            return transformedPath.replace(/.less$/, ".css");
        } catch (_err) {
            const err = new Error(_err);
            this.errors.add(`${err.message}`);

        }
        return "";
    }

    private createChangeListener (observables: Map <string, string>) {
        const changesEmitter = new EventEmitter();
        let watchers = Array.from(observables.keys()).map(key => {
            return fs.watch(key, (_eType, _fileName) => {
                if (_eType === "change" && _fileName === path.parse(key).base) {
                    changesEmitter.emit("changes");
                }
            });
        });

        changesEmitter.on("changes", () => {
                watchers.forEach(watcher => watcher.close());
                watchers = [];
                this.allObservables.clear();
                this.getStartedLessMonitoring()
                .catch(_err => {
                    const err = new Error(_err);
                    this.errors.add(`${err.message}`);
                 });
        });
    }

    private readonly mainLessMonitoring = async (filePathMatch: string = this.filePathMain, filePathDir: string = this.fileDirMain) => {
        const observables = await this.checkObservables(filePathMatch, filePathDir);
        if (observables) {
            this.createChangeListener(observables);
        }
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
    }

    allObservables:  Map<string, string> = new Map();
    additionalLess: string [] = [];
    tempPath = path.join(__dirname, "tmp/variables.less");
    logger: Console = new Console({ stdout: process.stdout, stderr: process.stderr });
    errors: Set <string> = new Set();

    checkIsWithErrors() {
      return this.errors.size > 0;
    }

    logErrors() {
        this.errors.forEach((value) => {
            this.logger.log(`${String(value)}`);
        });
    }

    startLogger = () => {
        this.logger.clear();
        this.errors.clear();
        this.logger = new Console({ stdout: process.stdout, stderr: process.stderr });
    }

    rebuildLess (filePathMain = this.filePathMain, dirForCss = this.fileDirMain, controller: EventEmitter | undefined = undefined) {
        let isWithoutError = true;
        const theme = dirForCss === this.fileDirMain ? "./" : path.join(path.relative(path.parse(this.pathToVariables).dir, this.additionalDirForCss), dirForCss.split(path.sep).pop() || "");
        return new Promise((res, rej) => {
           const cp = childProcess.spawn("node",
            [`${this.pathToLessc}`, `--modify-var=@theme="${theme}"`, `${filePathMain}`, `${path.join(dirForCss, this.nameForCss)}` ]);
            // `--plugin=--clean-css=advanced`
           if (controller) {
               controller.on("abort", () => {
                cp.kill("SIGTERM");
                isWithoutError = false;
                res(false);
            });

           }
            cp.stdout.on("data", data => {
                data && this.logger.log(`Status: ${ data.toString().trim() }`);
            });

            cp.stderr.on("data", data => {
                const err = new Error(data);
                this.errors.add(`${err.message}`);
                isWithoutError = false;
                this.logger.log(`${path.join(dirForCss, this.nameForCss)} with error. Сompilation failed`);
                if (controller) {
                    controller.emit("abort");
                }
                res(false);
            });

            cp.on("error", data => {
                this.logger.log(`Error: ${ String(data) }`);
                this.logger.log(`${path.join(dirForCss, this.nameForCss)} not compile`);
                rej();
            });

            cp.on("close", () => {
                isWithoutError && this.logger.log(`${path.join(dirForCss, this.nameForCss)} was successfully compiled`);
                res(true);
            });
        });
    }

    async createAdditionalStyles() {
        await this.findAdditionalObservables();
        this.fillObservable();
        await this.compileAdditionalStyles();
    }

    async findAdditionalObservables() {
        const childDirs = await readdir(this.additionalDirForCss);
        let allLess: string [] = [];
        for (const dirName of childDirs) {
            const grandChildDirs = await readdir(path.join(this.additionalDirForCss, dirName));
            const result = grandChildDirs.map(fileName => path.join(this.additionalDirForCss, dirName, fileName))
                                         .filter(filePath => path.extname(filePath) === ".less");
            allLess = allLess.concat(result);
        }
        this.additionalLess = allLess;
    }

    async getStartedLessMonitoring () {

        this.startLogger();
        if (this.additionalDirForCss) {
            await this.findAdditionalObservables();
            this.fillObservable();
        }
        await this.mainLessMonitoring();
        await this.rebuildLess();
        if (this.checkIsWithErrors()) {
            this.logErrors();
            return;
        }
        await this.compileAdditionalStyles();
        if (this.checkIsWithErrors()) {
            this.logErrors();
            return;
        }
    }

}
