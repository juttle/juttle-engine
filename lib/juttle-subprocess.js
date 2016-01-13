// This script is intended for use as a spawned subprocess by
// JuttleJob. It waits for a message from the parent containing the
// job id and program to run, compiles the program, writes the set of
// sink descriptors as a message, and then streams the data for the
// sinks as messages.

// Before any other modules are loaded, override the juttle logging subsystem to
// create a wrapper that sends logs to be emitted by the parent process.
var JuttleLogger = require('juttle/lib/logger');
JuttleLogger.getLogger = function(name) {
    function log(level, args) {
        process.send({
            type: 'log',
            name: name,
            level: level,
            arguments: args
        });
    }

    return {
        debug: function() {
            return log('debug', Array.prototype.slice.call(arguments, 0));
        },
        info: function() {
            return log('info', Array.prototype.slice.call(arguments, 0));
        },
        warn: function() {
            return log('warn', Array.prototype.slice.call(arguments, 0));
        },
        error: function() {
            return log('error', Array.prototype.slice.call(arguments, 0));
        }
    };
};

var _ = require('underscore');
/* jshint node: true */

var logger = JuttleLogger.getLogger('juttle-subprocess');

var read_config = require('juttle/lib/config/read-config');
var Juttle = require('juttle/lib/runtime').Juttle;

// The only argument to this process is the path to the config
// file. May not be provided, in which case a default set of search
// paths will be used.
var config = read_config({config_path: process.argv[2]});
var compiler = require('juttle/lib/compiler');
var optimize = require('juttle/lib/compiler/optimize');
var views_sourceinfo = require('juttle/lib/compiler/flowgraph/views_sourceinfo');
var implicit_views = require('juttle/lib/compiler/flowgraph/implicit_views');

Juttle.adapters.load(config.adapters);

var running_program;

process.on('message', function(msg) {

    if (msg.cmd === 'stop') {
        logger.debug('stop: program is ', running_program ? 'active' : 'not active');
        if (running_program) {
            running_program.deactivate();
        }
        process.exit(0);
    } else if (msg.cmd === 'run') {
        var bundle = msg.bundle;

        // Run the juttle program. The two things written to standard out are:
        //  - A description of the sinks
        //  - A stream of all the data for the sinks

        logger.info("starting-juttle-program", bundle.program);

        var compile_options = {
            stage: "eval",
            fg_processors: [implicit_views(config.implicit_sink || 'table'), optimize, views_sourceinfo],
            inputs: msg.inputs,
            modules: msg.bundle.modules
        };

        compiler.compile(msg.bundle.program, compile_options)
        .then(function(program) {
            // Maps from channel to sink id
            var sink_descs = _.map(program.get_views(program), function(sink) {
                return {
                    type: sink.name,
                    sink_id: sink.channel,
                    options: sink.options
                };
            });

            process.send({
                type: "program_started",
                sinks: sink_descs
            });

            // Start listening for callbacks from the interpreter for
            // errors/warnings/sink data.
            program.events.on('error', function(msg, err) {
                logger.error(msg, err);
            });

            program.events.on('warning', function(msg, warn) {
                logger.warn(msg, warn);
            });

            program.events.on('view:mark', function(data) {
                process.send({
                    type: "data", data: {
                        type: "mark",
                        time: data.time,
                        sink_id: data.channel
                    }
                });
            });

            program.events.on('view:tick', function(data) {
                process.send({
                    type: "data", data: {
                        type: "tick",
                        time: data.time,
                        sink_id: data.channel
                    }
                });
            });

            program.events.on('view:eof', function(data) {
                process.send({
                    type: "data", data: {
                        type: "sink_end",
                        sink_id: data.channel
                    }
                });
            });

            program.events.on('view:points', function(data) {
                process.send({
                    type: "data", data: {
                        type: "points",
                        points: data.points,
                        sink_id: data.channel
                    }
                });
            });

            logger.debug('activating program', bundle.program);

            // Start the program.
            running_program = program;
            program.activate();

            return program.done();
        })
        .then(function() {
            logger.debug('program done');
            running_program = null;
            process.send({
                type: "done"
            });
        })
        .catch(function(err) {
            process.send({
                type: "compile_error",
                err: err
            });

            // Also send a done message so the job manager stops the
            // job
            process.send({
                type: "done"
            });
        });
    }
});
