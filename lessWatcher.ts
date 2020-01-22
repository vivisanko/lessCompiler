import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";
import * as EventEmitter from "events";
import { Console } from "console";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const copyFile = promisify(fs.copyFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
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

   private async processingTemporaryDir (isProcessCreate: boolean) {
        try {
                if (isProcessCreate) {
                    await mkdir(path.parse(this.tempPath).dir);
                } else {
                    await unlink(this.tempPath);
                }
            } catch (_err) {}
    }

    private async transformVariablesAndCompile (additionalVariablePath: string) {
        const addingContent = `\n@import '${path.relative(path.parse(this.pathToVariables).dir, additionalVariablePath).split(path.sep).join("/")}';`;

        await appendFile(this.pathToVariables, addingContent, {flag: "a"});
        await this.rebuildLess(this.filePathMain, path.join(path.parse(additionalVariablePath).dir, this.nameForCss));
    }

    private async compileAdditionalStyles() {
        await this.processingTemporaryDir(true);
        await copyFile(this.pathToVariables, this.tempPath);
        const content = await readFile(this.tempPath, {encoding: "utf8"});

        for (const additionalVariablePath of this.additionalLess) {
            await this.transformVariablesAndCompile(additionalVariablePath);
            await writeFile(this.pathToVariables, content);
        }
        await this.processingTemporaryDir(false);
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
            this.errors.set(`${err.message}`, err);

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
                .catch(err => {throw err; });
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
    errors = new Map();

    checkErrors() {
        this.errors.forEach((_value, key) => {
            this.logger.log(`${String(key)}`);
        });
    }

    startLogger = () => {
        this.logger.clear();
        this.errors.clear();
        this.logger = new Console({ stdout: process.stdout, stderr: process.stderr });

    }

    rebuildLess (filePathMain = this.filePathMain, pathForCss = path.join(this.fileDirMain, this.nameForCss)) {
        let isWithoutError = true;
        return new Promise((res, rej) => {
            const cp = childProcess.spawn("node", [`${this.pathToLessc}`, `${filePathMain}`, `${pathForCss}`]);
            cp.stdout.on("data", data => {
                data && this.logger.log(`Status: ${ data.toString().trim() }`);
            });

            cp.stderr.on("data", data => {
                const err = new Error(data);
                this.errors.set(`${err.message}`, err);
                isWithoutError = false;
                this.logger.log(`${pathForCss} with error. Сompilation failed`);
            });

            cp.on("error", data => {
                this.logger.log(`Error: ${ String(data) }`);
                this.logger.log(`${pathForCss} not compile`);
                rej();
            });

            cp.on("close", () => {
                isWithoutError && this.logger.log(`${pathForCss} was successfully compiled`);
                res();
            });
        });
    }

    async createAdditionalStyles() {
        const childDirs = await readdir(this.additionalDirForCss);
        let allLess: string [] = [];
        for (const dirName of childDirs) {
            const grandChildDirs = await readdir(path.join(this.additionalDirForCss, dirName));
            const result = grandChildDirs.map(fileName => path.join(this.additionalDirForCss, dirName, fileName))
                                         .filter(filePath => path.extname(filePath) === ".less");
            allLess = allLess.concat(result);
        }
        this.additionalLess = allLess;
        await this.compileAdditionalStyles();
    }

    async getStartedLessMonitoring () {

        this.startLogger();
        await this.rebuildLess();

        if (this.errors.size > 0) {
            this.checkErrors();
            return;
        }

        if (this.additionalDirForCss) {
            await this.createAdditionalStyles();
                this.fillObservable();
            }

        if (this.errors.size > 0) {
            this.checkErrors();
            return;
        }
        await this.mainLessMonitoring();

    }

}
