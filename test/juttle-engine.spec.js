'use strict';
var expect = require('chai').expect;
var engine = require('../lib/juttle-engine');
var WebSocket = require('ws');
var Promise = require('bluebird');
var findFreePort = Promise.promisify(require('find-free-port'));

describe('Juttle Engine Tests', function() {
    var juttleHostPort;

    before(function() {
        findFreePort(10000, 20000)
            .then((freePort) => {
                juttleHostPort = 'http://localhost:' + freePort;

                engine.run({
                    port: freePort,
                    root: __dirname
                });
            });
    });

    after(function() {
        engine.stop();
    });

    describe('Rendezvous tests', function() {
        it('Listen to a topic, can receive messages sent by other clients ', function(done) {
            var listener = new WebSocket(juttleHostPort + '/rendezvous/my-topic');

            listener.on('message', function(data) {
                data = JSON.parse(data);
                if (data.type === 'message') {
                    expect(data.message).to.equal('my-message');
                    listener.close();
                    done();
                }
            });

            listener.on('open', function() {
                var sender = new WebSocket(juttleHostPort + '/rendezvous/my-topic');

                sender.on('open', function() {
                    sender.send(JSON.stringify({type: 'message', message: 'my-message'}));
                    sender.close();
                });
            });
        });
    });
});
