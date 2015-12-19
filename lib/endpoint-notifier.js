// Simple echo server using websockets.
var _ = require('underscore');
var Base = require('extendable-base');
var logger = require('log4js').getLogger('file-notifier');

var EndpointNotifier = Base.extend({
    initialize: function(options) {
        var self = this;

        // Maps from topic to a list of endpoints who are interested
        // in changes to that topic.
        self._endpoints = {};

        // The last message sent by anyone. This message is
        // automatically resent to new connections.
        self._last_message = undefined;
    },

    add_endpoint_to_topic: function(endpoint, topic) {
        var self = this;

        if (! self._endpoints[topic]) {
            self._endpoints[topic] = [];
        }

        self._endpoints[topic].push(endpoint);

        logger.debug("Added new endpoint for topic " + topic + ". " + self._endpoints[topic].length + " total");

        endpoint.events.on('close', function() {
            self.remove_endpoint_from_topic(endpoint, topic);
        });

        endpoint.events.on('message', function(data) {
            self._last_message = data;
            self.broadcast(topic, data);
        });

        if (self._last_message) {
            endpoint.send(self._last_message);
        }
    },

    remove_endpoint_from_topic: function(endpoint, topic) {
        var self = this;

        var new_count = 0;

        if (self._endpoints[topic]) {
            self._endpoints[topic] = _.without(self._endpoints[topic], endpoint);
            new_count = self._endpoints[topic].length;
        }

        if (self._endpoints[topic].length === 0) {
            delete self._endpoints[topic];
        }

        logger.debug("Removed connection for topic " + topic + ". " + new_count + " total");
    },

    broadcast: function(topic, data) {
        var self = this;

        logger.debug("Sending " + data + " to all endpoints");
        self._endpoints[topic].forEach(function(endpoint) {
            endpoint.send(data);
        });
    }
});

module.exports = EndpointNotifier;
