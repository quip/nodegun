import {Chunk, ChunkType} from './chunk';
import {Command, Ref} from './command';
import {CommandFactory} from './commandfactory';
import {NamedLock} from './lock';
import {Readable, Writable} from 'stream';

class TrackingRef {
    private value = true;

    constructor(private readonly delegate: Ref) {
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

export class Handler {
    private readonly lock = new NamedLock();
    private readonly ref: TrackingRef

    constructor(private readonly commandFactory: CommandFactory, ref: Ref) {
        this.ref = new TrackingRef(ref);
    }

    handle(reader: Readable, writer: Writable) {
        const args: string[] = [];
        const env = new Map<string, string>();
        let workingDirectory: string | undefined;

        let me = this;
        reader.on('data', function listener(chunk: Chunk) {
            switch (chunk.type) {
                case ChunkType.Argument:
                    args.push(chunk.data.toString());
                    break;
                case ChunkType.Command:
                    if (workingDirectory == null) {
                        throw new MissingWorkingDirectory();
                    }
                    const commandString = chunk.data.toString();
                    let command: Command;
                    try {
                        command = me.commandFactory.create(workingDirectory, commandString);
                    } catch (e) {
                        writer.write(new Chunk(ChunkType.Stderr, Buffer.from(`${e.stack}\n`)));
                        writer.write(new Chunk(ChunkType.Exit, Buffer.from((2).toString())));
                        writer.end();
                        return;
                    }
                    this.removeListener('data', listener);
                    const params = {args, env, workingDirectory};
                    me.lock.acquire([commandString].concat(args).join(' '), () => command.invoke(params, reader, writer, me.ref).then(code => {
                        writer.write(new Chunk(ChunkType.Exit, Buffer.from(code.toString())));
                        writer.end();
                    }));
                    break;
                case ChunkType.Environment:
                    const [name, value] = chunk.data.toString().split('=', 2) as [string, string|undefined];
                    if (value != null) {
                        env.set(name, value);
                    }
                    break;
                case ChunkType.WorkingDirectory:
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
        }
    }
}

class MissingWorkingDirectory extends Error {
    constructor() {
        super('Missing working directory');
    }
}
