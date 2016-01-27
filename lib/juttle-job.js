var _ = require('underscore');
var Base = require('extendable-base');
var JSDP = require('juttle-jsdp');
var JSDPValueConverter = require('./jsdp-value-converter');
var child_process = require('child_process');
var Promise = require('bluebird');
var CBuffer = require('CBuffer');
var JuttledErrors = require('./errors');
var logger = require('log4js').getLogger('juttle-job');
var events = require('backbone').Events;

var JuttleJob = Base.extend({
    initialize: function(options) {
        var self = this;

        self._job_id = options.job_id;
        self.events = _.extend({}, events);

        self._bundle = options.bundle;
        self._inputs = options.inputs;
        self._config_path = options.config_path;

        // An array of WebsocketEndpoint objects.
        self._endpoints = options.endpoints;

        // A handle to the spawned child process where the juttle
        // program is actually run.
        self._child = undefined;

        // If true, this job will stop running if all endpoints are
        // removed.
        self._run_without_endpoints = options.run_without_endpoints || false;

        // A buffer of messages received from the juttle child
        // process. These messages will be sent to new websocket
        // connections.
        self._saved_messages = new CBuffer(options.max_saved_messages);

        self._log_prefix = '(job=' + self._job_id + ') ';

        self._received_program_started = false;
        self._job_stopped = false;
        self._sink_descs = undefined;

        // This is used in multiple places and only depends on the job
        // id, so create it now.
        self._job_end_msg = {
            type: 'job_end',
            job_id: self._job_id
        };


        logger.debug(self._log_prefix + 'Created job');
    },

    save: function(msg) {
        var self = this;

        self._saved_messages.push(msg);
    },

    replay: function(endpoint) {
        var self = this;

        // This works because CBuffer implements forEach.
        endpoint.send_many(self._saved_messages);
    },

    describe: function() {
        var self = this;

        var ep_desc = _.map(self._endpoints, function(endpoint) {
            return endpoint.describe();
        });

        return {
            job_id: self._job_id,
            bundle: self._bundle,
            endpoints: ep_desc
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
                    self.send(send_data);
                    self.save(send_data);
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
                    self.send(msg);
                    self.save(msg);
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

            self.job_stopped();

            self._endpoints.forEach(function(endpoint) {
                endpoint.close();
            });
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
                        self._sink_descs = msg.sinks;
                        self.job_started();
                        resolve(self._child.pid);
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

    add_endpoint: function(endpoint) {
        var self = this;

        logger.debug(self._log_prefix + 'Adding endpoint');

        // If the associated program is running and the subprocess has
        // sent a program_started message, send this endpoint a job
        // started message.
        if (self._received_program_started) {
            logger.debug(self._log_prefix + 'Received program started, replaying messages');
            self.job_started([endpoint]);
            self.replay(endpoint);

            // If the job has also stopped, this means that the endpoint
            // is connecting after the program has finished. Just send the
            // endpoint a job_stop message and close the endpoint.
            if (self._job_stopped) {
                logger.debug(self._log_prefix + 'Received job stopped, sending this endpoint a job_stopped message and closing');
                endpoint.send(self._job_end_msg);
                endpoint.close();
                return;
            }
        }

        self._endpoints.push(endpoint);

        logger.debug(self._log_prefix + self._endpoints.length + ' endpoints remain');

        // Subscribe to close events on the endpoint, removing the
        // endpoint when closed.
        endpoint.events.on('close', function() {
            self.remove_endpoint(endpoint);
        });
    },

    remove_endpoint: function(endpoint) {
        var self = this;

        logger.debug(self._log_prefix + 'Removing endpoint');

        self._endpoints = _.without(self._endpoints, endpoint);

        logger.debug(self._log_prefix + self._endpoints.length + ' endpoints remain');

        if (self._endpoints.length === 0 &&
            ! self._run_without_endpoints) {
            // Stop the job.
            self.stop();
        }
    },

    // Send a job started message to the provided set of
    // endpoints. endpoints is optional--if not provided the message
    // is sent to all endpoints.
    job_started: function(endpoints) {
        var self = this;

        endpoints = endpoints || self._endpoints;

        logger.debug(self._log_prefix + 'Sending job_started message to ' + endpoints.length + ' endpoints');

        self.send({
            type: 'job_start',
            job_id: self._job_id,
            sinks: self._sink_descs
        }, endpoints);
    },

    // Send a job stopped message to all endpoints.
    job_stopped: function() {
        var self = this;

        logger.debug(self._log_prefix + 'Job stopped');

        self.send(self._job_end_msg);

        self._job_stopped = true;

        self.events.trigger('end');
    },

    // Send a message to the specified set of endpoints. endpoints is
    // optional--if not provided the message is sent to all endpoints.
    send: function(msg, endpoints) {
        var self = this;

        endpoints = endpoints || self._endpoints;

        endpoints.forEach(function(endpoint) {
            endpoint.send(msg);
        });
    }
});

module.exports = JuttleJob;
