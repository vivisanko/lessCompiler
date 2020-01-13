import * as fs from 'fs';
import {promisify} from 'util';
const path = require('path');

const readFile = promisify(fs.readFile);

const execProcess = require('./lessRebuilder');

const pathToLessc: string = path.join(__dirname,'node_modules','less','bin','lessc');
const filePathMain: string  = path.join(__dirname,'public','style.less')
const mainObservable: string = 'public/style.less';

let allObservables = new Map();

const checkObservables = async (filePath: string, observable: string) => {
    console.log('in check Observable'); 
    allObservables.set(filePath, observable);
    let observables = new Map();
    const contentPath = path.join(__dirname, observable);
    const content = await readFile(contentPath, 'utf-8');
    console.log('contentPath in checkObservables', contentPath);
    
    const regexp = /^@import ["'](.+).less["'];$/gm;
    const matches = content.match(regexp);
    if(matches) {
      async function processArray(arrayMatches) {
        const moreObservables = await checkObservables;

        for(const match of arrayMatches) {
         await moreObservables(match, match.substring(9, match.length - 2))
          .then(otherObservables =>{      
            console.log('otherObservables', otherObservables);
          observables = new Map([...otherObservables, ...observables]);
          return Promise.resolve(otherObservables);
          })
        }
      }
      await processArray(matches);
    };
    console.log('observables in checkObservables', observables);
    
    return Promise.resolve(new Map([...observables, ...allObservables]));
};



const  getStartedLessMonitoring = async (filePathMatch: string = filePathMain, filePath: string = mainObservable) => {
   const checkAllObservables = await checkObservables;

   checkAllObservables(filePathMatch, filePath)
   .then((observables)=>{
    console.log('otherObservable after checking', observables);
    console.log('observables.values', Array.from(observables.values()));

    Array.from(observables.keys()).forEach(key=>{
      console.log('key', key);
      
      const pathObservable = `./${observables.get(key)}`;
      fs.watch(pathObservable, (_curr, _prev) => {
        console.log(`${pathObservable} file Changed`);
        execProcess(`node ${pathToLessc} ${filePathMain} > ./public/style.css`);
        getStartedLessMonitoring(key,observables.get(key));
        })
    });

  });
}

  module.exports = getStartedLessMonitoring;