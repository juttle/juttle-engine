var _ = require('underscore');
var logger = require('log4js').getLogger('juttle-job');
var JuttleJob = require('./juttle-job');

var ImmediateJuttleJob = JuttleJob.extend({
    initialize: function(options) {
        var self = this;

        self._timeout = options.timeout || 60000;

        // The output of this program, as a hash sink_id -> sink
        // description + array of points.
        self._program_output = {};

        // Any errors for this program.
        self._errors = [];

        // Any warnings for this program.
        self._warnings = [];
    },

    _on_job_msg: function(msg) {
        var self = this;

        // Remove the job_id from the message, it isn't necessary.
        msg = _.omit(msg, 'job_id');

        // If this is a job_start or job_end message, save it
        // separately.
        if (msg.type === 'job_start') {
            // Initialize _program_output from the sink descriptions.
            msg.sinks.forEach(function(desc) {
                self._program_output[desc.sink_id] = {
                    options: desc.options,
                    type: desc.type,
                    data: []
                };
            });
        } else if (msg.type === 'job_end') {
            // We actually wait until close() to return the data.
        } else if (msg.type === 'error') {
            self._errors.push(msg.error);
        } else if (msg.type === 'warning') {
            self._warnings.push(msg.warning);
        } else if (msg.type === 'mark') {
            var data = _.omit(msg, 'sink_id');
            // Append the data to the appropriate sink's array of data.
            self._program_output[msg.sink_id].data.push(data);
        } else if (msg.type === 'points') {
            var new_points = _.map(msg.points, function(point) {
                return {
                    type: 'point',
                    point: point
                };
            });

            self._program_output[msg.sink_id].data =
                self._program_output[msg.sink_id].data.concat(new_points);
        }
    },

    start: function() {
        var self = this;

        // Call JuttleJob's start() method, which starts the
        // program. Then wait for the program to finish and return the
        // program's output.

        return JuttleJob.prototype.start.call(this)
        .then(function() {
            return self.waitfor();
        }).then(function() {
            return {
                output: self._program_output,
                errors: self._errors,
                warnings: self._warnings
            };
        });
    },

    waitfor: function() {
        var self = this;

        // Create a promise that resolves when we receive an 'end'. It
        // has a timeout that rejects if we don't receive the 'end'
        // within timeout ms.
        return new Promise(function(resolve, reject) {
            self.events.on('end', function() {
                logger.debug('Program exited, finishing waitfor()');
                resolve();
            });
        }).timeout(self._timeout, self._job_id + ' timed out');
    }
});

module.exports = ImmediateJuttleJob;
