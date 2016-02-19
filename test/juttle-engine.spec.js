'use strict';
var expect = require('chai').expect;
var engine = require('../lib/juttle-engine');
var WebSocket = require('ws');
var Promise = require('bluebird');
var findFreePort = Promise.promisify(require('find-free-port'));

describe('Juttle Engine Tests', function() {
    var juttleHostPort;

    beforeEach(function() {
        findFreePort(10000, 20000)
            .then((freePort) => {
                juttleHostPort = 'http://localhost:' + freePort;

                engine.run({
                    port: freePort,
                    root: __dirname
                });
            });
    });

    afterEach(function() {
        engine.stop();
    });

    describe('Rendezvous tests', function() {
        it('Listen to a topic, can receive messages sent by other clients ', function(done) {
            const validMsg = {
                type: 'bundle',
                bundle_id: 'valid-bundle',
                bundle: {
                    program: 'emit',
                    modules: []
                }
            };

            let listener = new WebSocket(juttleHostPort + '/rendezvous/my-topic');
            listener.on('message', function(data) {
                data = JSON.parse(data);
                expect(data).to.deep.equal(validMsg);
                listener.close();
                done();
            });

            listener.on('open', function() {
                let sender = new WebSocket(juttleHostPort + '/rendezvous/my-topic');

                sender.on('open', function() {
                    sender.send(JSON.stringify(validMsg));
                    sender.close();
                });
            });
        });

        it('Recieves error on invalid message', (done) => {
            const invalidMsg = {
                bundle: {
                    program: 'emit',
                    modules: []
                }
            };

            let listener = new WebSocket(juttleHostPort + '/rendezvous/my-topic');
            listener.on('open', () => {
                let sender = new WebSocket(juttleHostPort + '/rendezvous/my-topic');

                sender.on('open', () => {
                    sender.send(JSON.stringify(invalidMsg));
                });

                sender.on('message', (data) => {
                    data = JSON.parse(data);
                    expect(data).to.deep.equal({
                        'type': 'error',
                        'error': {
                            code: 'JE-INVALID-TOPIC-MSG',
                            message: 'Topic request body is missing the following params: bundle_id, type'
                        }
                    });
                    done();
                });
            });
        });
    });
});
