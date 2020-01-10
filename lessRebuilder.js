"use strict";

const childProcess = require("child_process");

function execProcess(command) {

    childProcess.exec(command, function(error, stdout, stderr) {

        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        if (error !== null) {
            console.log(`error: ${error}`);
        }
    });
}

module.exports = execProcess;