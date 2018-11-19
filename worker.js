"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commandfactory_1 = require("./commandfactory");
const cluster_1 = require("./cluster");
const fs = require("fs");
if (fs.existsSync(__filename.replace(/\.js$/, '.ts'))) {
    require('source-map-support').install();
}
new cluster_1.WorkerServer(new commandfactory_1.CommandFactory());
//# sourceMappingURL=worker.js.map