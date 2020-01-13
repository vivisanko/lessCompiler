"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const util_1 = require("util");
const path = require('path');
const childProcess = require("child_process");
// interface ILessWatcherData {
//   pathToLessc: string;
//   filePathMain: string;
//   mainObservable: string;
//   allObservables:  Map<string, string>;
// }
class LessWatcher {
    constructor() {
        this.checkObservables = (filePath, observable) => __awaiter(this, void 0, void 0, function* () {
            this.allObservables.set(filePath, observable);
            let observables = new Map();
            const contentPath = path.join(__dirname, observable);
            const content = yield this.readFile(contentPath, 'utf-8');
            const matches = content.match(this.regexp);
            if (matches) {
                observables = yield this.processArray(matches, observables);
            }
            ;
            return Promise.resolve(new Map([...observables, ...this.allObservables]));
        });
        this.getStartedLessMonitoring = (filePathMatch = this.filePathMain, filePath = this.mainObservable) => __awaiter(this, void 0, void 0, function* () {
            const checkAllObservables = yield this.checkObservables;
            checkAllObservables(filePathMatch, filePath)
                .then((observables) => {
                console.log('otherObservable after checking', observables);
                Array.from(observables.keys()).forEach(key => {
                    const pathObservable = `./${observables.get(key)}`;
                    fs.watch(pathObservable, (_curr, _prev) => {
                        console.log(`${pathObservable} file Changed`);
                        this.execProcess(`node ${this.pathToLessc} ${this.filePathMain} > ./public/style.css`);
                        this.getStartedLessMonitoring(key, observables.get(key));
                    });
                });
            });
        });
        this.pathToLessc = path.join(__dirname, 'node_modules', 'less', 'bin', 'lessc');
        this.filePathMain = path.join(__dirname, 'public', 'style.less');
        this.mainObservable = 'public/style.less';
        this.allObservables = new Map();
        this.readFile = util_1.promisify(fs.readFile);
        this.regexp = /^@import ["'](.+).less["'];$/gm;
    }
    processArray(arrayMatches, observables) {
        return __awaiter(this, void 0, void 0, function* () {
            const moreObservables = yield this.checkObservables;
            let localObservables = observables;
            for (const match of arrayMatches) {
                yield moreObservables(match, match.substring(9, match.length - 2))
                    .then(otherObservables => {
                    localObservables = new Map([...otherObservables, ...localObservables]);
                    return Promise.resolve(otherObservables);
                });
            }
            return localObservables;
        });
    }
    execProcess(command) {
        childProcess.exec(command, function (error, stdout, stderr) {
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            if (error !== null) {
                console.log(`error: ${error}`);
            }
        });
    }
}
module.exports = { LessWatcher };
