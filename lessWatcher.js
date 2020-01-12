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
const readFile = util_1.promisify(fs.readFile);
const path = require('path');
// import * as less from 'less';
const execProcess = require('./lessRebuilder');
const pathToLessc = path.join(__dirname, 'node_modules', 'less', 'bin', 'lessc');
const filePathMain = path.join(__dirname, 'public', 'style.less');
const mainObservable = 'public/style.less';
let allObservables = new Map();
const checkObservables = (filePath, observable) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('in check Observable');
    allObservables.set(filePath, observable);
    let observables = new Map();
    const contentPath = path.join(__dirname, observable);
    const content = yield readFile(contentPath, 'utf-8');
    console.log('contentPath in checkObservables', contentPath);
    const regexp = /^@import ["'](.+).less["'];$/gm;
    const matches = content.match(regexp);
    if (matches) {
        yield Promise.all(matches.map((match) => __awaiter(void 0, void 0, void 0, function* () {
            const moreObservables = yield checkObservables;
            moreObservables(match, match.substring(9, match.length - 2))
                .then(otherObservables => {
                console.log('otherObservables', otherObservables);
                // for (const [key, value] of otherObservables) {
                //   observables.set(key, value);
                // }
                observables = new Map([...otherObservables, ...observables]);
                return Promise.resolve(otherObservables);
            });
        })));
    }
    ;
    console.log('observables in checkObservables', observables);
    return Promise.resolve(new Map([...observables, ...allObservables]));
});
const getStartedLessMonitoring = () => __awaiter(void 0, void 0, void 0, function* () {
    const checkAllObservables = yield checkObservables;
    checkAllObservables(filePathMain, mainObservable)
        .then((observables) => {
        console.log('otherObservable after checking', observables);
        console.log('observables.values', Array.from(observables.values()));
        Array.from(observables.values()).forEach(path => {
            console.log('path', path);
            const pathObservable = `./${path}`;
            fs.watchFile(pathObservable, (_curr, _prev) => {
                console.log(`${pathObservable} file Changed`);
                execProcess(`node ${pathToLessc} ${filePathMain} > ./public/style.css`);
            });
        });
    });
});
module.exports = getStartedLessMonitoring;
