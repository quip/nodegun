"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const command_1 = require("./command");
const childProcess = require("child_process");
const net = require("net");
class MasterServer {
    constructor(module, workerCount) {
        this.workers = [];
        for (let i = 0; i < workerCount; i++) {
            const child = childProcess.fork(module, []);
            child.on('exit', code => {
                if (code) {
                    command_1.real.stderrWrite(`Worker pid ${child.pid} crashed`);
                    command_1.real.processExit(1);
                }
            });
            const worker = { child, connections: 0 };
            child.on('message', (message) => {
                if (message === 'finished') {
                    --worker.connections;
                }
            });
            this.workers.push(worker);
        }
        // Balance by least connections. Prefer certain workers when breaking ties, in order to capitilize on JIT.
        this.server = net.createServer();
        this.server.once('listening', () => this.server._handle.onconnection = (err, tcp) => {
            // TODO: check err
            const worker = this.workers.reduce((a, b) => a.connections <= b.connections ? a : b);
            ++worker.connections;
            worker.child.send('connection', tcp);
        });
    }
    status() {
        return Promise.all(this.workers.map(({ child, connections }) => {
            return new Promise(resolve => {
                child.send('status', error => error && resolve(error.toString()));
                child.on('message', function listener(message) {
                    if (message && message.type === 'status') {
                        resolve(message.value);
                        this.removeListener('message', listener);
                    }
                });
            }).then(process => ({ process, connections }));
        })).then(workers => ({ workers }));
    }
    shutdown() {
        // TODO: something else(?)
        setTimeout(() => command_1.real.processExit(), 5 * 1000);
    }
}
exports.MasterServer = MasterServer;
class WorkerServer extends server_1.BaseServer {
    constructor(commandFactory) {
        process.on('message', (message, handle) => {
            if (message === 'connection') {
                this.connection(new net.Socket({ allowHalfOpen: true, fd: handle.fd, readable: true, writable: true }));
            }
            else if (message === 'status') {
                this.status().then(value => process.send({ type: 'status', value }));
            }
        });
        super(commandFactory, process.channel || process._channel);
    }
    connection(socket) {
        socket.once('close', () => process.send('finished'));
        super.connection(socket);
    }
}
exports.WorkerServer = WorkerServer;
//# sourceMappingURL=cluster.js.map