'use strict';
// Simple echo server using websockets.
var _ = require('underscore');
var logger = require('log4js').getLogger('endpoint-notifier');

class EndpointNotifier {

    constructor(options) {
        // Maps from topic to a list of endpoints who are interested
        // in changes to that topic.
        this._endpoints = {};

        // The last message sent by anyone. This message is
        // automatically resent to new connections.
        this._last_message = undefined;
    }

    add_endpoint_to_topic(endpoint, topic) {
        if (! this._endpoints[topic]) {
            this._endpoints[topic] = [];
        }

        this._endpoints[topic].push(endpoint);

        logger.debug('Added new endpoint for topic ' + topic + '. ' + this._endpoints[topic].length + ' total');

        endpoint.events.on('close', () => {
            this.remove_endpoint_from_topic(endpoint, topic);
        });

        endpoint.events.on('message', (data) => {
            this._last_message = data;
            this.broadcast(topic, data);
        });

        if (this._last_message) {
            endpoint.send(this._last_message);
        }
    }

    remove_endpoint_from_topic(endpoint, topic) {
        let new_count = 0;

        if (this._endpoints[topic]) {
            this._endpoints[topic] = _.without(this._endpoints[topic], endpoint);
            new_count = this._endpoints[topic].length;
        }

        if (this._endpoints[topic].length === 0) {
            delete this._endpoints[topic];
        }

        logger.debug('Removed connection for topic ' + topic + '. ' + new_count + ' total');
    }

    broadcast(topic, data) {
        logger.debug('Sending ' + data + ' to all endpoints');
        this._endpoints[topic].forEach((endpoint) => {
            endpoint.send(data);
        });
    }
}

module.exports = EndpointNotifier;
