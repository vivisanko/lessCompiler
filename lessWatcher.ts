import * as fs from 'fs';
import {promisify} from 'util';

const readFile = promisify(fs.readFile);
const path = require('path');
// import * as less from 'less';

const execProcess = require('./lessRebuilder');

const pathToLessc = path.join(__dirname,'node_modules','less','bin','lessc');
const filePathMain = path.join(__dirname,'public','style.less')
const mainObservable = 'public/style.less';

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
     await Promise.all(
                matches.map(async match=>{
                  const moreObservables = await checkObservables;
                  moreObservables(match, match.substring(9, match.length - 2))
                  .then(otherObservables =>{      
                    console.log('otherObservables', otherObservables);
                    // for (const [key, value] of otherObservables) {
                    //   observables.set(key, value);
                    // }
                  observables = new Map([...otherObservables, ...observables]);
                  return Promise.resolve(otherObservables);
                  })
                })
              );
    };
    console.log('observables in checkObservables', observables);
    
    return Promise.resolve(new Map([...observables, ...allObservables]));
};



const  getStartedLessMonitoring = async () => {
   const checkAllObservables = await checkObservables;

   checkAllObservables(filePathMain, mainObservable)
   .then((observables)=>{
    console.log('otherObservable after checking', observables);
    console.log('observables.values', Array.from(observables.values()));

    Array.from(observables.values()).forEach(path=>{
      console.log('path', path);
      
      const pathObservable = `./${path}`;
      fs.watchFile(pathObservable, (_curr, _prev) => {
                console.log(`${pathObservable} file Changed`);
                execProcess(`node ${pathToLessc} ${filePathMain} > ./public/style.css`);
        })
});

});
}

  module.exports = getStartedLessMonitoring;