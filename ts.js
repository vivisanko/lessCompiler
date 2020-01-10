"use strict";

const { spawn } = require("child_process");
const ls = spawn("node", ["../tsCompiler/tsc", "-p", "../tsconfig.json", "-w"]);

ls.stdout.on("data", data => {
    data && console.log(`Status: ${ data.toString().trim() }`);
});

ls.stderr.on("data", data => {
    console.log(`Error: ${ data }`);
});

ls.on("close", code => {
    console.log(`Closed with code: ${ code }`);
});