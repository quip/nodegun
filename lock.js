"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NamedLock {
    constructor() {
        this.queue = [];
    }
    acquire(name, action) {
        if (this.queue.push([name, action]) === 1) {
            this.next();
        }
    }
    status() {
        const [running, ...queue] = this.queue.map(([name]) => name);
        return { running: running || null, queue };
    }
    next() {
        const then = () => {
            this.queue.shift();
            if (this.queue.length) {
                this.next();
            }
        };
        this.queue[0][1]().then(then, then);
    }
}
exports.NamedLock = NamedLock;
//# sourceMappingURL=lock.js.map