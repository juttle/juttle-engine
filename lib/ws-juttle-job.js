var _ = require('underscore');
var CBuffer = require('CBuffer');
var logger = require('log4js').getLogger('juttle-job');
var JuttleJob = require('./juttle-job');

var WebsocketJuttleJob = JuttleJob.extend({
    initialize: function(options) {
        var self = this;

        // An array of WebsocketEndpoint objects.
        self._endpoints = options.endpoints;

        // If true, this job will stop running if all endpoints are
        // removed.
        self._run_without_endpoints = options.run_without_endpoints || false;

        // A buffer of messages received from the juttle child
        // process. These messages will be sent to new websocket
        // connections.
        self._saved_messages = new CBuffer(options.max_saved_messages);

        // We save the job start and job end messages so we can send
        // them to websocket clients who may connect late.
        self._job_start_msg = undefined;
        self._job_end_msg = undefined;
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

    add_endpoint: function(endpoint) {
        var self = this;

        logger.debug(self._log_prefix + 'Adding endpoint');

        // If the associated program is running and the subprocess has
        // sent a program_started message, send this endpoint a job
        // started message.
        if (self._received_program_started) {
            logger.debug(self._log_prefix + 'Received program started, replaying messages');
            endpoint.send(self._job_start_msg);
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

    send_to_clients: function(msg) {
        var self = this;

        // If this is a job_start or job_end message, save it
        // separately.
        if (msg.type === 'job_start') {
            self._job_start_msg = msg;
        } else if (msg.type === 'job_end') {
            self._job_end_msg = msg;
        } else {
            // Otherwise, save the message in the circular buffer.
            self.save(msg);
        }

        self._endpoints.forEach(function(endpoint) {
            endpoint.send(msg);
        });
    },

    close: function() {
        var self = this;

        self._endpoints.forEach(function(endpoint) {
            endpoint.close();
        });
    }
});

module.exports = WebsocketJuttleJob;
