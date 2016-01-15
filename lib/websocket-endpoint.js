var _ = require('underscore');
var Base = require('extendable-base');
var Promise = require('bluebird');
var logger = require('log4js').getLogger('demo-websocket-endpoint');
var WebSocket = require('ws');
var events = require('backbone').Events;
var Deque = require("double-ended-queue");

// This class handles management of the server end of a single
// websocket connection. It handles keep-alives and (someday)
// authentication. Once authenticated, it passes the socket off to the
// JobManager object to connect the job and the websocket connection.

var WebsocketEndpoint = Base.extend({
    initialize: function(options) {
        var self = this;

        this._ws = options.ws;
        Promise.promisifyAll(this._ws);

        this._ping_interval = 10 * 1000; // interval on which to send pings
        this._ping_counter = 0;
        this._missed_pong_limit = 6; // close after this many non-responses to ping
        this.events = _.extend({}, events);

        // Each endpoint has a queue of messages to send. In the
        // common case, this is empty or 1 message. It might be longer
        // if an endpoint connects to a running job and is replaying a
        // bunch of saved messages or is slower than the juttle
        // program itself.
        this._message_queue = new Deque();

        this._ws.on('message', this.message.bind(this));
        this._ws.on('close', this.close.bind(this, true));
        this._ws.on('error', function(err) {
            logger.error('websocket err occurred, closing', err);
            self.close(true);
        });

        self._closing = false;

        this._ping_interval_id = setInterval(function() {
            self.ping();
        }, this._ping_interval);
        logger.info('Successfully created Websocket Endpoint');
    },

    describe: function() {
        return this._ws.upgradeReq.socket.remoteAddress +
            ":" + this._ws.upgradeReq.socket.remotePort;
    },

    message: function(message) {
        var self = this;

        try {
            message = JSON.parse(message);
        } catch(error) {
            logger.info("Received invalid client authentication message, closing connection.");
            this._ws.close();
            return;
        }

        if (_.isObject(message) && message.type === "pong") {
            logger.debug('received pong from client');
            this.pong();
            return;
        }

        // Emit a message event with the message.
        self.events.trigger('message', message);
    },

    close: function(force) {
        var self = this;

        force = force || false;

        logger.debug("close() called, force=" + force);

        // If there are any queued messages, wait for them to all be
        // sent first. Just set _closed to true. The end of drain()
        // will call close() again once the queue is empty.
        if (! self._message_queue.isEmpty() &&
            force !== true) {
            self._closing = true;
            return;
        }

        // Stop pinging
        if (self._ping_interval_id) {
            clearInterval(self._ping_interval_id);
            self._ping_interval_id = null;
        }

        // Close the underlying websocket
        if (self._ws.readyState === WebSocket.OPEN) {
            self._ws.close();
        }

        // Emit a close event. This is used by classes like
        // job-manager.js to remove the endpoint from the appropriate
        // aliases.
        self.events.trigger('close');
    },

    ping: function() {
        var self = this;
        self._ping_counter += 1;

        if (this._ws.readyState === WebSocket.OPEN) {
            if (self._ping_counter > self._missed_pong_limit) {
                logger.warn("client hasn't send pong message, closing connection");
                self.close();
                return;
            }
            this.send({type: "ping"});
        }
        else {
            clearInterval(this._ping_interval);
            this._ping_interval = null;
        }
    },

    pong: function() {
        this._ping_counter = 0;
    },

    send: function(data) {
        var self = this;

        self._message_queue.enqueue(data);
        self.drain();
    },

    send_many: function(datas) {
        var self = this;

        datas.forEach(function(data) {
            self._message_queue.enqueue(data);
        });

        self.drain();
    },

    drain: function() {
        var self = this;

        if (self._ws.readyState !== WebSocket.OPEN) {
            return;
        }

        var data = self._message_queue.dequeue();

        self._ws.sendAsync(JSON.stringify(data))
            .catch(function(e) {
                logger.info("error sending data", {
                    message: e.message
                });
            })
            .finally(function() {
                // If the queue is non-empty, call drain again.
                if (! self._message_queue.isEmpty()) {
                    self.drain();
                } else if (self._closing) {
                    self.close();
                }
            });
    }

});

module.exports = WebsocketEndpoint;
