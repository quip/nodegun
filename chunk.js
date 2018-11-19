"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
class Chunk {
    constructor(type, data = Buffer.allocUnsafe(0)) {
        this.type = type;
        this.data = data;
    }
}
exports.Chunk = Chunk;
var ChunkType;
(function (ChunkType) {
    ChunkType[ChunkType["Argument"] = 'A'.charCodeAt(0)] = "Argument";
    ChunkType[ChunkType["Environment"] = 'E'.charCodeAt(0)] = "Environment";
    ChunkType[ChunkType["Heartbeat"] = 'H'.charCodeAt(0)] = "Heartbeat";
    ChunkType[ChunkType["WorkingDirectory"] = 'D'.charCodeAt(0)] = "WorkingDirectory";
    ChunkType[ChunkType["Command"] = 'C'.charCodeAt(0)] = "Command";
    ChunkType[ChunkType["Stdin"] = '0'.charCodeAt(0)] = "Stdin";
    ChunkType[ChunkType["Stdout"] = '1'.charCodeAt(0)] = "Stdout";
    ChunkType[ChunkType["Stderr"] = '2'.charCodeAt(0)] = "Stderr";
    ChunkType[ChunkType["StdinStart"] = 'S'.charCodeAt(0)] = "StdinStart";
    ChunkType[ChunkType["StdinEnd"] = '.'.charCodeAt(0)] = "StdinEnd";
    ChunkType[ChunkType["Exit"] = 'X'.charCodeAt(0)] = "Exit";
})(ChunkType = exports.ChunkType || (exports.ChunkType = {}));
class ChunkParser extends stream_1.Transform {
    constructor() {
        super({ readableObjectMode: true });
        this.buffers = [];
        this.bufferSize = 0;
    }
    _transform(data, encoding, callback) {
        this.buffers.push(data);
        this.bufferSize += data.length;
        if (this.bufferSize >= 4 + 1) {
            const buffer = Buffer.concat(this.buffers);
            let offset;
            for (offset = 0; offset + 4 + 1 <= buffer.length;) {
                const size = buffer.readUInt32BE(offset);
                const type = buffer.readUInt8(offset + 4);
                if (buffer.length < offset + size + 4 + 1) {
                    break;
                }
                offset += 4 + 1;
                // note: if we ever do pass along the heartbeats, we'd have to handle closed streams
                if (type !== ChunkType.Heartbeat) {
                    this.push(new Chunk(type, buffer.slice(offset, offset + size)));
                }
                offset += size;
            }
            if (offset) {
                this.buffers.length = 0;
                this.buffers.push(buffer.slice(offset));
                this.bufferSize = buffer.length - offset;
            }
        }
        callback();
    }
    _flush(callback) {
        const buffer = Buffer.concat(this.buffers);
        if (4 + 1 < buffer.length) {
            callback(new ChunkParser.IncompleteChunkError(buffer.readUInt32BE(0), this.bufferSize - 5));
        }
        else if (buffer.length) {
            callback(new ChunkParser.IncompleteHeaderError(buffer));
        }
        else {
            callback();
        }
    }
}
exports.ChunkParser = ChunkParser;
(function (ChunkParser) {
    class IncompleteHeaderError extends Error {
        constructor(data) {
            super(`Incomplete header: ${data.toString('hex')}`);
        }
    }
    ChunkParser.IncompleteHeaderError = IncompleteHeaderError;
    class IncompleteChunkError extends Error {
        constructor(expected, actual) {
            super(`Incomplete chunk of length ${actual}, expected ${expected}`);
        }
    }
    ChunkParser.IncompleteChunkError = IncompleteChunkError;
})(ChunkParser = exports.ChunkParser || (exports.ChunkParser = {}));
class ChunkSerializer extends stream_1.Transform {
    constructor() {
        super({ writableObjectMode: true });
    }
    _transform(chunk, encoding, callback) {
        const header = Buffer.allocUnsafe(4 + 1);
        header.writeUInt32BE(chunk.data.length, 0);
        header.writeInt8(chunk.type, 4);
        callback(null, Buffer.concat([header, chunk.data]));
    }
}
exports.ChunkSerializer = ChunkSerializer;
//# sourceMappingURL=chunk.js.map