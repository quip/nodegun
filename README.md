# Nodegun

Nailgun for Node.js

## Purpose

Nodegun improve start up overhead for Node.js programs.

```js
// helloworld.js
console.log('Hello world');
```

```sh
$ time node helloworld.js
Hello world
real    0m0.102s

$ time ng helloworld.js
Hello world
real    0m0.004s
```

A more intensive example:

```js
// typescript.js
const ts = require('typescript');
const code = 'export const example = 1;';
const result = ts.transpileModule(code, {});
console.log(code.result);
```

```sh
$ time node typescript.js > out.js
real    0m0.470s

$ time ng typescript.js > out.js
real    0m0.012s
```

## Architecture

[Nailgun](http://www.martiansoftware.com/nailgun/) is an established system for reducing startup overhead of Java
programs. Users invoke a small executable (written in C), which connects to a long-running JVM server.

Nodegun is a Node.js server that is compatible with the Nailgun protocol and native client.

Optionally, for parallelized workloads, nodegun can run multiple worker processes.

<div style="text-align:center"><img src="architecture.png"></div>

## Getting started

1. Install the nailgun client, either from [source](https://github.com/martylamb/nailgun) or from your package manager. E.g. for Ubuntu,

```sh
$ apt-get install nailgun
```

2. Install and run nodegun.

```sh
$ npm install -g nodegun
$ nodegun
```

3. Create a Node.JS program to run (aka a "nail").

```js
// example_nail.js
console.log(process.argv.slice(2).join('-'));
```

4. Run the client 

```sh
$ ng /home/bob/example_nail.js The Fast and the Furious
$ # (or ng-nailgun)
The-Fast-and-the-Furious
```

## Server options

```
usage: nodegun [-h] [-v] [--tcp [TCP] | --local [LOCAL]] [--workers [WORKERS]]

Start Node.js server that supports the Nailgun protocol.

Optional arguments:
  -h, --help           Show this help message and exit.
  -v, --version        Show program's version number and exit.
  --tcp [TCP]          TCP address to listen to, given as ip, port, or 
                       ip:port. IP defaults to 0.0.0.0, and port defaults to 
                       2113. If no other transport is specified, TCP is used.
  --local [LOCAL]      Local address to listen to. Defaults to /tmp/nodegun.
                       sock.
  --workers [WORKERS]  If present, number of worker processes to start. A 
                       flag with no argument starts one per CPU.
```

## Writing a nail

Most Node.JS programs should work as nails without modification.

Nodegun is designed to mimick command line arguments, environment variables, stdin, stdout, stderr, and working
directory.

Each worker process (or the main process, if there are no workers) runs only one nail at a time.

## Examples

Nodegun comes with a few [built-in nails](examples/).

* `ng ./examples/hello` - Print `Hello World`
* `ng ./examples/info` - Print arguments and working direcotry
* `ng ./examples/echo` - Copy stdin to stdout


## What is this good for?

We use Nodegun in our build system. A fast CLI to Node.js amenable to in concurrent, polyglot build systems.

In this way, it is similar to Nailgun, which is used in build tools like [Buck](https://buckbuild.com/) and
[Pants](http://www.pantsbuild.org/).
