var _ = require('underscore');
var Base = require('extendable-base');
var uuid = require('uuid');
var logger = require('log4js').getLogger('demo-job-manager');
var events = require('backbone').Events;
var child_process = require('child_process');
var Promise = require('bluebird');
var CBuffer = require('CBuffer');
var JuttledErrors = require('./errors');

// This class handles management of jobs (running juttle programs). It
// also brings together websocket endpoints and the outputs (sinks) of
// running juttle programs.

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
            type: "job_end",
            job_id: self._job_id
        };


        logger.debug(self._log_prefix + "Created job");
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

        logger.debug(self._log_prefix + "Starting job");

        // We run the juttle program in a subprocess. Note that the
        // only argument to the subprocess is the value of the
        // --config file (if defined).
        var args = [];
        if (self._config_path) {
            args.push(self._config_path);
        }

        self._child = child_process.fork(__dirname + "/juttle-subprocess.js", args, {silent: true});

        self._child.on('message', function(msg) {
            //logger.debug("Got message from child", msg);
            switch (msg.type) {
                case "data":
                    var send_data = _.extend(msg.data, {job_id: self._job_id});
                    self.send(send_data);
                    self.save(send_data);
                    break;
                case "log":
                    var processLogger = require('log4js').getLogger(msg.name);
                    processLogger[msg.level].apply(processLogger, msg.arguments);
                    break;
                case "done":
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
                logger.error("Subprocess exited unexpectedly with code=" + code);
            } else {
                logger.debug("Subprocess exited with code=" + code);
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
            logger.error("Received error " + err + " from subprocess");
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
                    case "program_started":
                        self._received_program_started = true;
                        self._sink_descs = msg.sinks;
                        self.job_started();
                        resolve(self._child.pid);
                        break;
                    case "compile_error":
                        reject(new JuttledErrors.juttleError(msg.err, self._bundle));
                        break;
                }
            });
        });

        // Send the program to the child
        self._child.send({cmd: 'run', bundle: self._bundle, inputs: self._inputs});

        return child_started;
    },

    stop: function() {
        var self = this;

        logger.debug(self._log_prefix + "Stopping job");

        // Stop the subprocess by sending it a stop message. That will
        // cause the child to emit a 'close' event. The handler for
        // close will clean everything up.
        if (self._child) {
            self._child.send({cmd: 'stop'});
        }
    },

    add_endpoint: function(endpoint) {
        var self = this;

        logger.debug(self._log_prefix + "Adding endpoint");

        // If the associated program is running and the subprocess has
        // sent a program_started message, send this endpoint a job
        // started message.
        if (self._received_program_started) {
            logger.debug(self._log_prefix + "Received program started, replaying messages");
            self.job_started([endpoint]);
            self.replay(endpoint);

            // If the job has also stopped, this means that the endpoint
            // is connecting after the program has finished. Just send the
            // endpoint a job_stop message and close the endpoint.
            if (self._job_stopped) {
                logger.debug(self._log_prefix + "Received job stopped, sending this endpoint a job_stopped message and closing");
                endpoint.send(self._job_end_msg);
                endpoint.close();
                return;
            }
        }

        self._endpoints.push(endpoint);

        logger.debug(self._log_prefix + self._endpoints.length + " endpoints remain");

        // Subscribe to close events on the endpoint, removing the
        // endpoint when closed.
        endpoint.events.on('close', function() {
            self.remove_endpoint(endpoint);
        });
    },

    remove_endpoint: function(endpoint) {
        var self = this;

        logger.debug(self._log_prefix + "Removing endpoint");

        self._endpoints = _.without(self._endpoints, endpoint);

        logger.debug(self._log_prefix + self._endpoints.length + " endpoints remain");

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

        logger.debug(self._log_prefix + "Sending job_started message to " + endpoints.length + " endpoints");

        self.send({
            type: "job_start",
            job_id: self._job_id,
            sinks: self._sink_descs,
        }, endpoints);
    },

    // Send a job stopped message to all endpoints.
    job_stopped: function() {
        var self = this;

        logger.debug(self._log_prefix + "Job stopped");

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

var JobManager = Base.extend({

    initialize: function(options) {
        var self = this;

        self._config_path = options.config_path;

        // job_id -> JuttleJob
        self._jobs = {};

        self._max_saved_messages = options.max_saved_messages;
        self._delayed_job_cleanup = options.delayed_job_cleanup;

        // This object emits job_start/job_end events when jobs are
        // started and deleted.
        self.events = _.extend({}, events);
    },

    // Returns an array of job descriptions. If job_id is undefined,
    // returns job descriptions for all jobs. Otherwise, returns a
    // single-element array with a description for the single
    // job. Returns undefined if job_id was specified and no such job
    // with that id exists.

    list_all_jobs: function() {
        var self = this;

        return _.map(self._jobs, function(job) {
            return job.describe();
        });
    },

    list_job: function(job_id) {
        var self = this;

        if (! _.has(self._jobs, job_id)) {
            return undefined;
        } else {
            return self._jobs[job_id].describe();
        }
    },

    delete_job: function(job_id) {
        var self = this;

        if (_.has(self._jobs, job_id)) {
            logger.debug("Removing job " + job_id + " from jobs hash");

            self._jobs[job_id].stop();

            // Remove the job from the jobs hash now, so list_jobs
            // will not find the job.
            self._jobs = _.omit(self._jobs, job_id);

            return job_id;
        } else {
            return undefined;
        }
    },

    run_program: function(options) {
        var self = this;

        options.inputs = options.inputs || {};

        logger.debug("Running program \"" + options.bundle.program.slice(0, 20) + "...\" with observer " + options.observer_id);

        var job_id = uuid.v4();
        var job = new JuttleJob({
            job_id: job_id,
            bundle: options.bundle,
            inputs: options.inputs,
            endpoints: [],
            max_saved_messages: self._max_saved_messages,
            config_path: self._config_path
        });

        self._jobs[job_id] = job;

        job.events.on('end', function() {

            self.events.trigger("job_end", job_id, options.observer_id);

            // The job is complete. Remove it from the jobs hash. In
            // order to give time for very late job subscribers to
            // connect and receive the output of very short programs,
            // we actually remove the job from the hash after a short
            // timeout.
            // If the timeout is 0, we remove the job immediately.
            if (self._delayed_job_cleanup === 0) {
                self.delete_job(job_id);
            } else {
                setTimeout(function() {
                    self.delete_job(job_id);
                }, self._delayed_job_cleanup);
            }
        });

        self.events.trigger("job_start", job_id, options.observer_id);

        // Return a promise that resolves once the program has
        // started, with the pid and job id.
        return job.start()
        .then(function(child_pid) {
            return {job_id: job_id, pid: child_pid};
        });
    },

    add_endpoint_to_job: function(endpoint, job_id) {
        var self = this;

        logger.debug("Adding endpoint " + endpoint.describe() + " to job_id " + job_id);

        if (_.has(self._jobs, job_id)) {
            self._jobs[job_id].add_endpoint(endpoint);
            return true;
        } else {
            return false;
        }
    }
});

module.exports = JobManager;
