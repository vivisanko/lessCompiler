import * as fs from 'fs';
import {promisify} from 'util';

const readFile = promisify(fs.readFile);
const path = require('path');
// import * as less from 'less';

const execProcess = require('./lessRebuilder');

const pathToLessc = path.join(__dirname,'node_modules','less','bin','lessc');
let filePath = path.join(__dirname,'public','style.less')

const mainObservable = './public/style.less';

const checkObservables = async () => {
    console.log('in check Observable'); 
    const observables: String [] = [];
    const content = await readFile(filePath, 'utf-8');
    const regexp = /^@import "(.+)";$/gm;
    const matches = content.match(regexp);
    console.log('matches', matches);
    if(matches) {
    matches.forEach(match=>observables.push(match.substring(8, match.length - 10)));
    };
    return observables;
};



const  getStartedLessMonitoring = async () => {
   const otherObservables = await checkObservables();
    console.log('otherObservable after checking', otherObservables);

   fs.watchFile(mainObservable, (_curr, _prev) => {
    console.log(`${mainObservable} file Changed`);
    execProcess(`node ${pathToLessc} ${filePath} > ./public/style.css`);
    checkObservables();
  });
//   otherObservable.forEach(path=>{
//       const pathObservable = `./${path}`;
//       fs.watchFile(pathObservable, (curr, prev) => {
//                 console.log(`${pathObservable} file Changed`);
//                 execProcess(`node ${pathToLessc} ${filePath} > ./public/style.css`);
//         })

//   });

}

  module.exports = getStartedLessMonitoring;