'use strict';

let JuttleEngineTester = require('./lib/juttle-engine-tester');
let path = require('path');

describe('app tests', function() {
    let juttleEngineTester;

    before(() => {
        juttleEngineTester = new JuttleEngineTester();
        return juttleEngineTester.start();
    });

    after(() => {
        return juttleEngineTester.stop();
    });

    it('shows errors for a program that produces an error', () => {
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'no-such-sub.juttle')
        })
        .then(() => {
            return juttleEngineTester.waitForJuttleErrorToEqual('At line 1, column 1: no such sub: kaboom');
        });
    });

    it('shows warnings for program that produces a warning', () => {
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'warning.juttle')
        })
        .then(() => {
            return juttleEngineTester.waitForJuttleErrorToContain('Invalid operand types for "+": number (0) and date (2014-01-01T00:00:00.000Z)');
        });
    });

    it('can open juttle program with no inputs', () => {
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'no-inputs.juttle')
        })
        .then(() => {
            return juttleEngineTester.waitForTextOutputToContain('output',[
                { time: '1970-01-01T00:00:00.000Z', value: 10 },
                { time: '1970-01-01T00:00:00.100Z', value: 10 },
                { time: '1970-01-01T00:00:00.200Z', value: 10 }
            ]);
        });
    });

    it('can open juttle program with an input, fill it out, and run', () => {
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'one-input.juttle')
        })
        .then(() => {
            return juttleEngineTester.writeIntoInputControl('a', 'AAA');
        })
        .then(() => {
            juttleEngineTester.clickPlay();
        })
        .then(() => {
            return juttleEngineTester.waitForTextOutputToContain('output',[
                { time: '1970-01-01T00:00:00.000Z', value: 'AAA' },
                { time: '1970-01-01T00:00:00.100Z', value: 'AAA' },
                { time: '1970-01-01T00:00:00.200Z', value: 'AAA' }
            ]);
        });
    });

});
