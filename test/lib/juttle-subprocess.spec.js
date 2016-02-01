var _ = require('underscore');
var expect = require('chai').expect;
var retry = require('bluebird-retry');
var JSDP = require('juttle-jsdp');

describe('juttle-subprocess', function() {

    var oldArgv;
    var oldExit;
    var exitStatus;
    var sentData;

    var findMessage = function(fields) {
        return _.find(sentData, function(item) {
            return _.reduce(fields, function(memo, value, key) {
                return (item[key] === value) && memo;
            }, true);
        });
    };

    var waitForMessage = function(fields, options) {
        options = _.extend({
            timeout: 1000,
            interval: 10
        }, options);

        return retry(function() {
            if (!findMessage(fields)) {
                throw new Error('Message not found with fields ' +
                                JSON.stringify(fields) + ' in ' +
                                JSON.stringify(sentData));
            }
        }, options);
    };

    beforeEach(function() {
        oldArgv = process.argv;
        process.argv = ['node', 'juttle-subprocess.js', ''];
        oldExit = process.exit;
        process.exit = function(status) {
            exitStatus = status;
        };

        sentData = [];
        process.send = function(data) {
            sentData.push(data);
        };

        require('../../lib/juttle-subprocess.js');
    });

    afterEach(function() {
        process.argv = oldArgv;
        process.exit = oldExit;
    });

    it('can be stopped with the "stop" command', function() {
        process.emit('message', { cmd: 'stop' });
        expect(exitStatus).to.equal(0);
    });

    it('can run a short program', function() {
        process.emit('message', {
            cmd: 'run',
            bundle: {
                program: 'emit -limit 1 -from :2014-01-01:'
            }
        });

        return waitForMessage({ type: 'program_started' })
        .then(function() {
            return waitForMessage({ type: 'done' });
        })
        .then(function() {
            return waitForMessage({ type: 'data' });
        })
        .then(function() {
            var message = findMessage({ type: 'data' });
            var points = JSDP.deserialize(message.data.points);
            expect(points).to.deep.equal([
                { time: new Date('2014-01-01T00:00:00.000Z') }
            ]);
        })
        .then(function() {
            process.emit('message', { cmd: 'stop' });
            expect(exitStatus).to.equal(0);
        });
    });

    it('can emit compile erro correctly ', function() {
        process.emit('message', {
            cmd: 'run',
            bundle: {
                program: 'read waffles'
            }
        });

        return waitForMessage({ type: 'compile_error' })
        .then(function() {
            var message = findMessage({ type: 'compile_error' });
            expect(message.err.message).to.contain('Error: adapter waffles not registered');
        });
    });

    it('can emit warnings correctly ', function() {
        process.emit('message', {
            cmd: 'run',
            bundle: {
                program: 'emit -limit 1 -from :2014-01-01: | put value = 0 + time'
            }
        });

        return waitForMessage({ type: 'program_started' })
        .then(function() {
            return waitForMessage({ type: 'done' });
        })
        .then(function() {
            return waitForMessage({ type: 'log', level: 'warn' });
        })
        .then(function() {
            var message = findMessage({ type: 'log', level: 'warn' });
            expect(message.arguments[0]).to.contain('Invalid operand types for "+": number (0) and date (2014-01-01T00:00:00.000Z)');
            // verify location data is provided
            expect(message.arguments[1].info.location).to.not.be.undefined;

            process.emit('message', { cmd: 'stop' });
            expect(exitStatus).to.equal(0);
        });
    });

    it('can emit errors correctly ', function() {
        process.emit('message', {
            cmd: 'run',
            bundle: {
                program: 'read file -file "inexistent"'
            }
        });

        return waitForMessage({ type: 'program_started' })
        .then(function() {
            return waitForMessage({ type: 'done' });
        })
        .then(function() {
            return waitForMessage({ type: 'log', level: 'error' });
        })
        .then(function() {
            var message = findMessage({ type: 'log', level: 'error' });
            expect(message.arguments[0]).to.contain('ENOENT: no such file or directory, open \'inexistent\'');

            // verify location data is provided
            expect(message.arguments[1].info.location).to.not.be.undefined;

            process.emit('message', { cmd: 'stop' });
            expect(exitStatus).to.equal(0);
        });
    });

    it('can emit ticks correctly', function() {
        process.emit('message', {
            cmd: 'run',
            bundle: {
                program: 'emit -limit 2'
            }
        });

        return waitForMessage({ type: 'program_started' })
        .then(function() {
            return waitForMessage({
                type: 'done'
            }, {
                timeout: 3000
            });
        })
        .then(function() {
            var tick = _.find(sentData, function(item) {
                return item.type === 'data' && item.data.type === 'tick';
            });
            expect(tick).to.not.be.undefined;
        });
    });

    it('can emit marks correctly', function() {
        process.emit('message', {
            cmd: 'run',
            bundle: {
                program: 'emit -limit 2 | batch 1'
            }
        });

        return waitForMessage({ type: 'program_started' })
        .then(function() {
            return waitForMessage({
                type: 'done'
            }, {
                timeout: 3000
            });
        })
        .then(function() {
            var tick = _.find(sentData, function(item) {
                return item.type === 'data' && item.data.type === 'mark';
            });
            expect(tick).to.not.be.undefined;
        });
    });

});
