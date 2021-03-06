'use strict';
var expect = require('chai').expect;
var engine = require('../lib/juttle-engine');
var WebSocket = require('ws');
var Promise = require('bluebird');
var findFreePort = Promise.promisify(require('find-free-port'));
var retry = require('bluebird-retry');
var chakram = require('chakram');
var ckexpect = chakram.expect;

describe('Juttle Engine Tests', function() {
    var juttleHostPort;

    beforeEach(function() {
        findFreePort(10000, 20000)
            .then((freePort) => {
                juttleHostPort = 'http://localhost:' + freePort;

                engine.run({
                    port: freePort,
                    root: __dirname,
                    host: 'localhost'
                });
            }).then(() => {
                return retry(function() {
                    var response = chakram.get(juttleHostPort + '/api/v0/version-info');
                    ckexpect(response).to.have.status(200);
                });
            });
    });

    afterEach(function() {
        engine.stop();
    });

    describe('Rendezvous tests', function() {
        let listener, sender;

        afterEach(() => {
            if (listener) {
                listener.close();
            }

            if (sender) {
                sender.close();
            }
        });

        it('Listen to a topic, can receive messages sent by other clients ', function(done) {
            const validMsg = {
                type: 'bundle',
                bundle_id: 'valid-bundle',
                bundle: {
                    program: 'emit',
                    modules: []
                }
            };

            listener = new WebSocket(juttleHostPort + '/rendezvous/my-topic');
            listener.on('message', function(data) {
                data = JSON.parse(data);
                expect(data).to.deep.equal(validMsg);
                listener.close();
                done();
            });

            listener.on('open', function() {
                sender = new WebSocket(juttleHostPort + '/rendezvous/my-topic');

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

            listener = new WebSocket(juttleHostPort + '/rendezvous/my-topic');
            listener.on('open', () => {
                sender = new WebSocket(juttleHostPort + '/rendezvous/my-topic');

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
