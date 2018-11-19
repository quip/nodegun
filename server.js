"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net = require("net");
const chunk_1 = require("./chunk");
const handler_1 = require("./handler");
class BaseServer {
    constructor(commandFactory, ref) {
        this.handler = new handler_1.Handler(commandFactory, ref);
    }
    connection(socket) {
        socket.setNoDelay(true);
        socket.unref();
        const parser = new chunk_1.ChunkParser();
        const serializer = new chunk_1.ChunkSerializer();
        socket.pipe(parser);
        serializer.pipe(socket);
        this.handler.handle(parser, serializer);
        socket.on('error', socket.destroy);
        socket.on('timeout', () => socket.destroy(new Error('timeout')));
    }
    status() {
        return Promise.resolve(this.handler.status());
    }
}
exports.BaseServer = BaseServer;
class Server extends BaseServer {
    constructor(commandFactory) {
        const server = net.createServer({ allowHalfOpen: true }, socket => this.connection(socket));
        super(commandFactory, server);
        this.server = server;
    }
    shutdown() {
        this.server.close();
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map