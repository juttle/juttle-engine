var _ = require('underscore');
var Base = require('extendable-base');
var uuid = require('uuid');
var logger = require('log4js').getLogger('demo-job-manager');
var events = require('backbone').Events;
var JuttleJob = require('./juttle-job');

// This class handles management of jobs (running juttle programs). It
// also brings together websocket endpoints and the outputs (sinks) of
// running juttle programs.

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
            logger.debug('Removing job ' + job_id + ' from jobs hash');

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

        logger.debug('Running program "' + options.bundle.program.slice(0, 20) + '..." with observer ' + options.observer_id);

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

            self.events.trigger('job_end', job_id, options.observer_id);

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

        self.events.trigger('job_start', job_id, options.observer_id);

        // Return a promise that resolves once the program has
        // started, with the pid and job id.
        return job.start()
        .then(function(child_pid) {
            return {job_id: job_id, pid: child_pid};
        });
    },

    add_endpoint_to_job: function(endpoint, job_id) {
        var self = this;

        logger.debug('Adding endpoint ' + endpoint.describe() + ' to job_id ' + job_id);

        if (_.has(self._jobs, job_id)) {
            self._jobs[job_id].add_endpoint(endpoint);
            return true;
        } else {
            return false;
        }
    }
});

module.exports = JobManager;
