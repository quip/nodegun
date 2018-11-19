"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const command_1 = require("./command");
class Resolver {
    constructor() {
        this.cache = new Map();
    }
    resolve(directory, path) {
        const pathCache = this.cache.get(directory) || this.cache.set(directory, new Map()).get(directory);
        module.paths.unshift(directory);
        let result = pathCache.get(path);
        if (!result) {
            try {
                result = require.resolve(path);
            }
            finally {
                module.paths.shift();
            }
            pathCache.set(path, result);
        }
        return result;
    }
}
/**
 * Copied from internal/module
 */
function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}
/**
 * Copied from internal/module
 */
function stripShebang(content) {
    // Remove shebang
    var contLen = content.length;
    if (contLen >= 2) {
        if (content.charCodeAt(0) === 35 /*#*/ &&
            content.charCodeAt(1) === 33 /*!*/) {
            if (contLen === 2) {
                // Exact match
                content = '';
            }
            else {
                // Find end of shebang line and slice it off
                var i = 2;
                for (; i < contLen; ++i) {
                    var code = content.charCodeAt(i);
                    if (code === 10 /*\n*/ || code === 13 /*\r*/)
                        break;
                }
                if (i === contLen)
                    content = '';
                else {
                    // Note that this actually includes the newline character(s) in the
                    // new output. This duplicates the behavior of the regular expression
                    // that was previously used to replace the shebang line
                    content = content.slice(i);
                }
            }
        }
    }
    return content;
}
class CommandFactory {
    constructor() {
        this.cache = new Map();
        this.resolver = new Resolver();
    }
    create(workingDirectory, path) {
        const resolved = this.resolver.resolve(workingDirectory, path);
        let result = this.cache.get(resolved);
        if (!result) {
            const oldJs = require.extensions['.js'];
            require.extensions['.js'] = (module, filename) => {
                module.id = '.';
                let content = fs.readFileSync(resolved, 'utf-8');
                content = stripBOM(content);
                content = stripShebang(content);
                module._compile(`require.main = process.mainModule = module; module.exports = () => {${content}\n};`, filename);
                require.extensions['.js'] = oldJs;
            };
            try {
                result = new command_1.Command(require(resolved));
            }
            finally {
                require.extensions['.js'] = oldJs;
            }
            this.cache.set(resolved, result);
        }
        return result;
    }
}
exports.CommandFactory = CommandFactory;
//# sourceMappingURL=commandfactory.js.map