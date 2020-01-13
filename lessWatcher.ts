import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import {promisify} from 'util';

interface ILessWatcherData {
  pathToLessc: string;
  filePathMain: string;
  mainObservable: string;
  allObservables:  Map<string, string>;
  readFile: any;
  regexp: RegExp;
}

class LessWatcher implements ILessWatcherData {
  pathToLessc: string;
  filePathMain: string;
  mainObservable: string;
  allObservables:  Map<string, string>;
  readFile: any;
  regexp: RegExp;

   constructor() {
    this.pathToLessc =  path.join(__dirname,'node_modules','less','bin','lessc');
    this.filePathMain =  path.join(__dirname,'public','style.less');
    this.mainObservable = 'public/style.less';
    this.allObservables = new Map();
    this.readFile = promisify(fs.readFile);
    this.regexp =  /^@import ["'](.+).less["'];$/gm;
  }

  async processArray(arrayMatches, observables) {
    const moreObservables = await this.checkObservables;
    let localObservables = observables;
    for(const match of arrayMatches) {
     await moreObservables(match, match.substring(9, match.length - 2))
      .then(otherObservables =>{      
        localObservables = new Map([...otherObservables, ...localObservables]);
      return Promise.resolve(otherObservables);
      })
    }
    return localObservables;
  }

  execProcess(command: string) {
    childProcess.exec(command, function(error, stdout, stderr) {

        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        if (error !== null) {
            console.log(`error: ${error}`);
        }
    });
  }

  checkObservables = async (filePath: string, observable: string) => {
    this.allObservables.set(filePath, observable);
    let observables = new Map<string, string>();
    const contentPath = path.join(__dirname, observable);
    const content = await this.readFile(contentPath, 'utf-8');
    const matches = content.match(this.regexp);

    if(matches) {
     observables = await this.processArray(matches, observables);
    };    
    return Promise.resolve(new Map([...observables, ...this.allObservables]));
  };

  getStartedLessMonitoring = async (filePathMatch: string = this.filePathMain, filePath: string = this.mainObservable) => {
      const checkAllObservables = await this.checkObservables;
    
    checkAllObservables(filePathMatch, filePath)
    .then((observables)=>{
      console.log('otherObservable after checking', observables);
  
    Array.from(observables.keys()).forEach(key=>{          
        const pathObservable = `./${observables.get(key)}`;
        
        const watcher =  fs.watch(pathObservable, (_curr, _prev) => {
          console.log(`${pathObservable} file Changed`);
          this.execProcess(`node ${this.pathToLessc} ${this.filePathMain} > ./public/style.css`);
          watcher.close();
          this.getStartedLessMonitoring();
          })
      });
    });
  }
}

  module.exports = {LessWatcher};