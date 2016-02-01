# juttle-engine

[![Build Status](https://travis-ci.org/juttle/juttle-engine.svg?branch=master)](https://travis-ci.org/juttle/juttle-engine)

juttle-engine is an API-based execution engine for juttle programs.

It exposes an [API](./docs/jobs-api.md) for executing and managing a set of running juttle jobs. Each job executes in a separate node.js subprocess and either returns the results immediately or creates a websocket over which results are streamed using the [JSDP protocol](./docs/jsdp-api.md).

## Getting Started

### Installation

Make sure you have [node](http://nodejs.org) (with [npm](http://npmjs.org)) installed.

Use npm to install juttle and juttle-engine:
```
$ npm install juttle
$ npm install juttle-engine
```

We've tested with nodejs 4.2.3 and npm 2.14.17. Other combinations of nodejs and npm likely work, but we haven't tested all combinations.

## Options and Configuration

Here are the full command line options supported by the daemon:

### juttle-engine

```
usage: [--port <port>] [--root <path>]
       [--config <juttle-config-path>] [--daemonize]
       [--output <logfile>] [--log-config <log4js-config-path>]
       [--log-level <level] [--help]
       -p, --port <port>:                     Run juttle-engine on the specified port
       -r, --root <path>:                     Use <path> as the root directory for juttle programs
       -c, --config <juttle-config-path>:     Read juttle config from <juttle-config-path>
       -d, --daemonize:                       Daemonize juttle-engine and log to configured log file
       -o, --output <logfile>:                Log to specififed file when daemonized
       -L, --log-config <log4js-config-path>: Configure logging from <log4js-config-path>. Overrides any value of -o
       -l, --log-level <level>:               Use a default log level of <level>. Overridden by any log level specified in -L
       -h, --help:                            Print this help and exit
```

``juttle-engine`` uses log4js for logging and by default logs to ``log/juttle-engine.log``.

### Juttle config file

The Juttle compiler and runtime within juttle-engine are also configured via the juttle configuration file, typically at ``$(HOME)/.juttle/config.json``. For more information on the juttle configuration file, see the [juttle configuration documentation](https://github.com/juttle/juttle/blob/master/docs/reference/cli.md#configuration).

### Module resolution

When juttle-engine resolves module references in juttle programs while creating program bundles, it searches the following locations:
* The configured root directory.
* The same location as the current juttle program. For example, if a program is at ``/home/user/program.juttle`` and refers to a module ``module.juttle``, juttle-engine looks in ``/home/user`` for ``module.juttle``.
* Any locations in the environment variable JUTTLE_MODULE_PATH (colon-separated list of directories).

## Testing

To run unit tests:

``npm test``

Both are run automatically by Travis.
