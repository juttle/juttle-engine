var _ = require('underscore');
var Base = require('extendable-base');
var JSDP = require('juttle-jsdp');
var JSDPValueConverter = require('./jsdp-value-converter');
var child_process = require('child_process');
var Promise = require('bluebird');
var JuttledErrors = require('./errors');
var logger = require('log4js').getLogger('juttle-job');
var events = require('backbone').Events;

// This class handles the details of running a program from a
// bundle, handling an explicit stop from a job manager, emitting the
// proper events when the job has completed, etc.
//
// Actually passing the results of programs back to websocket and/or
// http clients is handled by subclasses. Based on the method, the Job
// Manager will create a WebsocketJuttleJob or HTTPJuttleJob object.

var JuttleJob = Base.extend({
    initialize: function(options) {
        var self = this;

        self._job_id = options.job_id;
        self.events = _.extend({}, events);

        self._bundle = options.bundle;
        self._inputs = options.inputs;
        self._config_path = options.config_path;

        // A handle to the spawned child process where the juttle
        // program is actually run.
        self._child = undefined;

        self._log_prefix = '(job=' + self._job_id + ') ';

        self._received_program_started = false;
        self._job_stopped = false;

        logger.debug(self._log_prefix + 'Created job');
    },

    describe: function() {
        var self = this;

        return {
            job_id: self._job_id,
            bundle: self._bundle
        };
    },

    start: function() {
        var self = this;

        logger.debug(self._log_prefix + 'Starting job');

        // We run the juttle program in a subprocess. Note that the
        // only argument to the subprocess is the value of the
        // --config file (if defined).
        var args = [];
        if (self._config_path) {
            args.push(self._config_path);
        }

        self._child = child_process.fork(__dirname + '/juttle-subprocess.js', args, {silent: true});

        self._child.on('message', function(msg) {
            //logger.debug("Got message from child", msg);
            switch (msg.type) {
                case 'data':
                    var send_data = _.extend(msg.data, {job_id: self._job_id});
                    self.send_to_clients(send_data);
                    break;
                case 'log':
                    var processLogger = require('log4js').getLogger(msg.name);
                    processLogger[msg.level].apply(processLogger, msg.arguments);
                    break;
                case 'done':
                    logger.info('subprocess done');
                    self._child.send({cmd: 'stop'});
                    break;
                case 'warning':
                case 'error':
                    self.send_to_clients(msg);
                    break;
            }
        });

        self._child.on('close', function(code, signal) {
            logger.debug('subprocess exit', code, signal);
            if (code !== 0) {
                logger.error('Subprocess exited unexpectedly with code=' + code);
            } else {
                logger.debug('Subprocess exited with code=' + code);
            }

            // Set _child to undefined now, so nothing can send it a
            // message any longer.
            self._child = undefined;

            self.send_to_clients({
                type: 'job_end',
                job_id: self._job_id
            });

            self._job_stopped = true;

            // This is a signal that the job has ended, including a
            // signal to subclasses.
            self.events.trigger('end');
        });

        self._child.on('error', function(err) {
            logger.error('Received error ' + err + ' from subprocess');
        });

        self._child.stderr.setEncoding('utf8');
        self._child.stderr.on('data', function(err) {
            logger.error('child-process-error', err);
        });

        // Return a promise that resolves when we've received a
        // program_started message from the child, and rejects when we
        // receive a compile_error message from the child.

        var child_started = new Promise(function(resolve, reject) {
            self._child.on('message', function(msg) {
                //logger.debug("Got message from child", msg);

                switch (msg.type) {
                    case 'program_started':
                        self._received_program_started = true;
                        self.send_to_clients({type: 'job_start',
                                              job_id: self._job_id,
                                              sinks: msg.sinks});
                        resolve({job_id: self._job_id, pid: self._child.pid});
                        break;
                    case 'compile_error':
                        reject(new JuttledErrors.juttleError(msg.err, self._bundle));
                        break;
                }
            });
        });

        // Send the program to the child
        self._child.send({cmd: 'run', bundle: self._bundle, inputs: JSDP.serialize(JSDPValueConverter.convertToJSDPValue(self._inputs), { toObject: true })});

        return child_started;
    },

    stop: function() {
        var self = this;

        logger.debug(self._log_prefix + 'Stopping job');

        // Stop the subprocess by sending it a stop message. That will
        // cause the child to emit a 'close' event. The handler for
        // close will clean everything up.
        if (self._child) {
            self._child.send({cmd: 'stop'});
        }
    },

    // Send a message to whoever is listening to the output of this
    // job. This method should be overridden by subclasses.
    send_to_clients: function(msg) {
    }

});

module.exports = JuttleJob;
