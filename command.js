"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chunk_1 = require("./chunk");
const stream_1 = require("stream");
// get-stdin maintains reference to process.stdin, so it must be replaced with a permemant value
class FakeStream extends stream_1.PassThrough {
    constructor(options) {
        super(options);
        this.options = options;
    }
    reset() {
        this.removeAllListeners();
        stream_1.PassThrough.call(this, this.options);
    }
}
var real;
(function (real) {
    real.stderrWrite = process.stderr.write.bind(process.stderr);
    real.stdoutWrite = process.stdout.write.bind(process.stdout);
    real.processExit = process.exit.bind(process);
})(real = exports.real || (exports.real = {}));
// console.log, console.error maintain references to write(), so it must be replaced with a permenant hook
let stderrWrite = real.stderrWrite;
let stdoutWrite = real.stdoutWrite;
let installed = false;
function install() {
    if (installed) {
        return;
    }
    installed = true;
    process.stderr.write = function () {
        return stderrWrite.apply(this, arguments);
    };
    process.stdout.write = function () {
        return stdoutWrite.apply(this, arguments);
    };
    Object.defineProperty(process, 'stderr', {
        configurable: true,
        enumerable: true,
        get: (stderr => () => stderr)(new FakeStream),
    });
    Object.defineProperty(process, 'stdout', {
        configurable: true,
        enumerable: true,
        get: (stdout => () => stdout)(new FakeStream),
    });
    process.stderr.write = function () {
        return stderrWrite.apply(this, arguments);
    };
    process.stdout.write = function () {
        return stdoutWrite.apply(this, arguments);
    };
    if (typeof process.stdin.end === 'function') {
        process.stdin.end();
    }
    Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: (stdin => () => stdin)(new FakeStream),
    });
}
class Command {
    constructor(main) {
        this.main = main;
        install();
    }
    invoke(context, reader, writer, ref) {
        const finalizers = [];
        ref.unref();
        // main module
        finalizers.push((mainModule => () => process.mainModule = mainModule)(process.mainModule));
        // arguments
        finalizers.push((argv => () => process.argv = argv)(process.argv));
        process.argv = process.argv.slice(0, 2).concat(context.args);
        // environment variables
        finalizers.push((env => () => process.env = env)(process.env));
        process.env = {};
        for (const [key, value] of context.env) {
            process.env[key] = value;
        }
        // working directory
        finalizers.push((workingDirectory => () => process.chdir(workingDirectory))(process.cwd()));
        process.chdir(context.workingDirectory);
        // stdin
        const stdin = new CommandStdin(writer, ref);
        finalizers.push(() => {
            stdin.unpipe(process.stdin);
            process.stdin.reset();
        });
        reader.pipe(stdin).pipe(process.stdin);
        function stdinNewListener(type) {
            switch (type) {
                case 'data':
                case 'end':
                    if (!this.isPaused) {
                        ref.ref();
                    }
            }
        }
        function stdinRemoveListener(type) {
            switch (type) {
                case 'data':
                case 'end':
                    if (!this.listenerCount('data') && !this.listenerCount('end')) {
                        ref.unref();
                    }
            }
        }
        function stdinPause() {
            ref.unref();
        }
        function stdinResume() {
            if (this.listenerCount('data') || this.listenerCount('end')) {
                ref.ref();
            }
        }
        process.stdin
            .on('pause', stdinPause)
            .on('resume', stdinResume)
            .on('removeListener', stdinRemoveListener)
            .on('newListener', stdinNewListener);
        process.stdin.once('end', function () {
            this.removeListener('removeListener', stdinRemoveListener);
            this.removeListener('newListener', stdinNewListener);
            this.removeListener('pause', stdinPause);
            this.removeListener('resume', stdinResume);
            ref.unref();
        });
        process.stdin.on('newListener', function listener(type) {
            switch (type) {
                case 'data':
                case 'end':
                    this.removeListener('newListener', listener);
                    stdin.request();
            }
        });
        // stdout
        const stdout = new CommandStdout();
        stdout.pipe(writer, { end: false });
        finalizers.push((write => () => stdoutWrite = write)(stdoutWrite));
        finalizers.push(() => process.stdout.reset());
        stdoutWrite = stdout.write.bind(stdout);
        // stderr
        const stderr = new CommandStderr();
        stderr.pipe(writer, { end: false });
        finalizers.push((write => () => stderrWrite = write)(stderrWrite));
        finalizers.push(() => process.stderr.reset());
        stderrWrite = stderr.write.bind(stderr);
        // errors
        function uncaughtExceptionListener(err) {
            console.error(err.stack);
            process.exit(1);
        }
        process.on('uncaughtException', uncaughtExceptionListener);
        finalizers.push(() => process.removeListener('uncaughtException', uncaughtExceptionListener));
        process.nextTick(this.main);
        return new Promise(resolve => {
            function finalize(code) {
                for (const finalizer of finalizers) {
                    finalizer();
                }
                ref.ref();
                resolve(code || 0);
            }
            finalizers.push((exit => () => process.exit = exit)(process.exit));
            process.exit = finalize;
            process.on('beforeExit', finalize);
            finalizers.push(() => process.removeListener('beforeExit', finalize));
        });
    }
}
exports.Command = Command;
class CommandStdin extends stream_1.Transform {
    constructor(writer, ref) {
        super({ writableObjectMode: true });
        this.writer = writer;
        this.ref = ref;
    }
    request() {
        // NodeJS will not flush this buffer
        // a workaround is to send a newline (!) but that clutters the output
        // this.writer.write(new Chunk(ChunkType.Stderr, Buffer.from('\n')));
        try {
            this.writer.write(new chunk_1.Chunk(chunk_1.ChunkType.StdinStart));
        }
        catch (e) {
        }
    }
    _transform(chunk, encoding, callback) {
        switch (chunk.type) {
            case chunk_1.ChunkType.Stdin:
                callback(null, chunk.data);
                this.request();
                break;
            case chunk_1.ChunkType.StdinEnd:
                callback();
                this.end();
                break;
            default:
                callback(new CommandStdin.UnexpectedChunk(chunk.type));
        }
    }
}
(function (CommandStdin) {
    class UnexpectedChunk extends Error {
        constructor(type) {
            super(`Unexpected ${String.fromCharCode(type)} chunk in stdin stream`);
        }
    }
    CommandStdin.UnexpectedChunk = UnexpectedChunk;
})(CommandStdin || (CommandStdin = {}));
class CommandOutput extends stream_1.Transform {
    constructor(type) {
        super({ readableObjectMode: true });
        this.type = type;
    }
    _transform(data, encoding, callback) {
        callback(null, new chunk_1.Chunk(this.type, data));
    }
}
class CommandStdout extends CommandOutput {
    constructor() {
        super(chunk_1.ChunkType.Stdout);
    }
}
class CommandStderr extends CommandOutput {
    constructor() {
        super(chunk_1.ChunkType.Stderr);
    }
}
//# sourceMappingURL=command.js.map