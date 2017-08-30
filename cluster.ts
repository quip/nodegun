import {BaseServer} from './server';
import {CommandFactory} from './commandfactory';
import * as childProcess from 'child_process';
import * as net from 'net';

export class MasterServer {
    private readonly workers: {child: childProcess.ChildProcess, connections: number}[] = [];
    public readonly server: net.Server;
    
    constructor(module: string, workerCount: number) {
        for (let i = 0; i < workerCount; i++) {
            const child = childProcess.fork(module, []);
            const worker = {child, connections:0};
            child.on('message', (message) => {
                if (message === 'finished') {
                    --worker.connections;
                }
            });
            this.workers.push(worker);
        }
        // Balance by least connections. Prefer certain workers when breaking ties, in order to capitilize on JIT.
        this.server = net.createServer();
        this.server.once('listening', () => (this.server as any)._handle.onconnection = (err: any, tcp: any) => {
            // TODO: check err
            const worker = this.workers.reduce((a, b) => a.connections <= b.connections ? a : b);
            ++worker.connections;
            worker.child.send('connection', tcp);
        });
    }
}

export class WorkerServer extends BaseServer {
    constructor(commandFactory: CommandFactory) {
        process.on('message', (message, handle) => {
            if (message === 'connection') {
                const socket = new net.Socket({fd:handle.fd, allowHalfOpen:true, readable:true, writable:true});
                if (message.data) {
                    handle.push(message.data);
                }
                this.connection(socket);
            }
        });
        super(commandFactory, (process as any).channel || (process as any)._channel);
    }

    protected connection(socket: net.Socket) {
        socket.once('close', () => process.send!('finished'));
        super.connection(socket);
    }
}
