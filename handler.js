"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chunk_1 = require("./chunk");
const lock_1 = require("./lock");
class TrackingRef {
    constructor(delegate) {
        this.delegate = delegate;
        this.value = true;
    }
    getValue() {
        return this.value;
    }
    ref() {
        this.value = true;
        this.delegate.ref();
    }
    unref() {
        this.value = false;
        this.delegate.unref();
    }
}
class Handler {
    constructor(commandFactory, ref) {
        this.commandFactory = commandFactory;
        this.lock = new lock_1.NamedLock();
        this.ref = new TrackingRef(ref);
    }
    handle(reader, writer) {
        const args = [];
        const env = new Map();
        let workingDirectory;
        let me = this;
        reader.on('data', function listener(chunk) {
            switch (chunk.type) {
                case chunk_1.ChunkType.Argument:
                    args.push(chunk.data.toString());
                    break;
                case chunk_1.ChunkType.Command:
                    if (workingDirectory == null) {
                        throw new MissingWorkingDirectory();
                    }
                    const commandString = chunk.data.toString();
                    let command;
                    try {
                        command = me.commandFactory.create(workingDirectory, commandString);
                    }
                    catch (e) {
                        writer.write(new chunk_1.Chunk(chunk_1.ChunkType.Stderr, Buffer.from(`${e.stack}\n`)));
                        writer.write(new chunk_1.Chunk(chunk_1.ChunkType.Exit, Buffer.from((2).toString())));
                        writer.end();
                        return;
                    }
                    this.removeListener('data', listener);
                    const params = { args, env, workingDirectory };
                    me.lock.acquire([commandString].concat(args).join(' '), () => command.invoke(params, reader, writer, me.ref).then(code => {
                        writer.write(new chunk_1.Chunk(chunk_1.ChunkType.Exit, Buffer.from(code.toString())));
                        writer.end();
                    }));
                    break;
                case chunk_1.ChunkType.Environment:
                    const [name, value] = chunk.data.toString().split('=', 2);
                    if (value != null) {
                        env.set(name, value);
                    }
                    break;
                case chunk_1.ChunkType.WorkingDirectory:
                    workingDirectory = chunk.data.toString();
                    break;
                default:
                    throw new Error('Unexpected chunk type');
            }
        });
    }
    status() {
        return {
            lock: this.lock.status(),
            waitingOnInput: this.ref.getValue(),
        };
    }
}
exports.Handler = Handler;
class MissingWorkingDirectory extends Error {
    constructor() {
        super('Missing working directory');
    }
}
//# sourceMappingURL=handler.js.map