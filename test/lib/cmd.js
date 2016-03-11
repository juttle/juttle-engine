'use strict';

let _ = require('underscore');
let Promise = require('bluebird');
let logger = require('mocha-logger');
let spawn = require('child_process').spawn;

module.exports = {
    spawnAsync: function(command, args, options) {
        return new Promise((resolve, reject) => {
            options = options || {};
            args = args || [];

            if (!options.quiet) {
                logger.log('spawning "' + command + ' ' + args.join(' ') + '"');
            }

            options = _.extend( {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            }, options);

            var spawned = spawn(command, args, options);
            var stdout = '';
            var stderr = '';

            spawned.stdout.on('data', (data) => {
                if (!options.quiet) {
                    logger.log('STDOUT:', data);
                }
                stdout += data;
            });

            spawned.stderr.on('data', (data) => {
                if (!options.quiet) {
                    logger.log('STDERR:', data);
                }
                stderr += data;
            });

            spawned.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(Error('command: "' + command + ' ' + args.join(' ') +
                                '", failed with ' + code));
                }
            });
        });
    }
};
