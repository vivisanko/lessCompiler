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
let filePath = path.join(__dirname, 'public', 'style.less');
const mainObservable = './public/style.less';
const checkObservables = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('in check Observable');
    const observables = [];
    const content = yield readFile(filePath, 'utf-8');
    const regexp = /^@import "(.+).less";$/gm;
    const matches = content.match(regexp);
    console.log('matches', matches);
    if (matches) {
        matches.forEach(match => observables.push(match.substring(9, match.length - 2)));
    }
    ;
    console.log('observables in checkObservables', observables);
    return Promise.resolve(observables);
});
const getStartedLessMonitoring = () => __awaiter(void 0, void 0, void 0, function* () {
    const otherObservables = yield checkObservables;
    fs.watchFile(mainObservable, (_curr, _prev) => {
        console.log(`${mainObservable} file Changed`);
        execProcess(`node ${pathToLessc} ${filePath} > ./public/style.css`);
        otherObservables()
            .then((observables) => {
            observables.forEach(path => {
                const pathObservable = `./${path}`;
                fs.watchFile(pathObservable, (_curr, _prev) => {
                    console.log(`${pathObservable} file Changed`);
                    execProcess(`node ${pathToLessc} ${filePath} > ./public/style.css`);
                });
            });
        });
    });
    otherObservables()
        .then((observables) => {
        console.log('otherObservable after checking', observables);
        observables.forEach(path => {
            const pathObservable = `./${path}`;
            fs.watchFile(pathObservable, (_curr, _prev) => {
                console.log(`${pathObservable} file Changed`);
                execProcess(`node ${pathToLessc} ${filePath} > ./public/style.css`);
            });
        });
    });
});
module.exports = getStartedLessMonitoring;
