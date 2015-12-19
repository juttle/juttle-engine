var _ = require('underscore');
var Base = require('extendable-base');
var logger = require('log4js').getLogger('demo-observer-manager');

var ObserverManager = Base.extend({

    initialize: function(options) {
        var self = this;

        self._job_mgr = options.job_mgr;

        self._job_mgr.events.on("job_start", function(job_id, observer_id) {
            self.notify_observers("job_start", job_id, observer_id);
        });

        self._job_mgr.events.on("job_end", function(job_id, observer_id) {
            self.notify_observers("job_end", job_id, observer_id);
        });

        // Maps from observer id to a list of endpoints subscribed to
        // that observer id. Any time a new job is started that
        // mentions that observer id, all the endpoints related to
        // that observer id are notified.
        self._observers = {};
    },

    // notify any observers on observer_id of the event related to job_id
    notify_observers: function(job_event, job_id, observer_id) {
        var self = this;

        // If this run request includes an observer id, notify all
        // related endpoints that the new job has been started.
        if (_.has(self._observers, observer_id)) {
            logger.debug("Sending " + job_event + " for observer " + observer_id);
            self._observers[observer_id].forEach(function(endpoint) {
                endpoint.send({type: job_event, job_id: job_id});
            });
        }
    },

    // Return a description of all observers. This is currently just a list of observer ids
    list_observers: function() {
        var self = this;

        return _.map(_.keys(self._observers), function(observer_id) {
            return {observer_id: observer_id};
        });
    },

    add_endpoint_to_observer: function(endpoint, observer_id) {
        var self = this;

        logger.debug("Adding endpoint " + endpoint.describe() + " to observer " + observer_id);

        if (!_.has(self._observers, observer_id)) {
            self._observers[observer_id] = [endpoint];
        } else {
            self._observers[observer_id].push(endpoint);
        }

        // Subscribe to close events on the endpoint, removing the
        // endpoint when closed.
        endpoint.events.on('close', function() {
            self.remove_endpoint_from_observer_id(endpoint, observer_id);
        });
    },

    remove_endpoint_from_observer_id: function(endpoint, observer_id) {
        var self = this;

        logger.debug("Removing endpoint " + endpoint.describe() + " from observer " + observer_id);

        // Also remove the observer entry itself if the list is empty
        self._observers[observer_id] = _.without(self._observers[observer_id], endpoint);
        if (self._observers[observer_id].length === 0) {
            delete self._observers[observer_id];
        }
    }
});

module.exports = ObserverManager;


