'use strict';
var _ = require('underscore');
var getLogger = require('juttle-service').getLogger;
var logger = getLogger('endpoint-notifier');

var errors = require('./errors');

// The EndpointNotifier manages rendezvous between multiple clients
// connecting via websockets. It is a simple echo server, passing any
// message sent from any client to all other clients.
//
// It's used by the push and watch capabilities of
// juttle-engine-client and the corresponding '?rendezvous=<topic>
// urls in the viewer.

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
            try {
                if (!data.bundle || !data.bundle_id || !data.type) {
                    throw errors.topicMsgError(data);
                }

                this._last_message = data;
                this.broadcast(topic, data);
            } catch (err) {
                logger.error('Error send topic message:', err.message);
                endpoint.send({
                    type: 'error',
                    error: {
                        code: err.code,
                        message: err.message
                    }
                });
            }
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
