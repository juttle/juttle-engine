'use strict';

let _ = require('underscore');
let cmd = require('./cmd');
let logger = require('mocha-logger');
let retry = require('bluebird-retry');
let uuid = require('uuid');

module.exports = {
    getHostAddress: function() {
        var name = uuid.v1();
        return cmd.spawnAsync('docker', ['run', '--name', name, 'ubuntu', 'route'], { quiet: true })
        .then((stdout) => {
            var address;
            _.each(stdout.split('\n'), (line) => {
                if (line.indexOf('default') !== -1) {
                    address = line.split(/[\r\n\t ]+/)[1];
                }
            });
            return address;
        })
        .finally(() => {
            return this.destroy(name);
        });
    },

    getContainerIPAddress: function(name) {
        return cmd.spawnAsync('docker', ['inspect', name], { quiet: true })
        .then((stdout) => {
            var data = JSON.parse(stdout);
            return data[0].NetworkSettings.IPAddress;
        });
    },

    buildLocalJuttleEngine: function(options) {
        // this obviously only works when running tests from the root of the
        // repository
        var tag = options.tag ? options.tag : 'juttle/juttle-engine:latest';
        return cmd.spawnAsync('docker', ['build', '-q', '-t', tag, '.']);
    },

    run: function(options) {
        var args = ['run', '--name', options.name];

        if (options.links) {
            _.each(options.links, (link) => {
                args.push('--link');
                args.push(link);
            });
        }

        if (options.ports) {
            _.each(options.ports, (port) => {
                args.push('-p');
                args.push(port);
            });
        }

        if (options.volumes) {
            _.each(options.volumes, (volume) => {
                args.push('--volume');
                args.push(volume);
            });
        }

        if (options.workdir) {
            args.push('--workdir');
            args.push(options.workdir);
        }
        
        _.each(options.env, (env) => {
            args.push('-e');
            args.push(env);
        });

        if (options.detach) {
            args.push('-d');
        }

        args.push(options.image);

        return cmd.spawnAsync('docker', args);
    },

    stop: function(name, options) {
        return cmd.spawnAsync('docker', ['stop', name], options);
    },

    rm: function(name, options) {
        return cmd.spawnAsync('docker', ['rm', name], options);
    },

    containerExists: function(name) {
        return cmd.spawnAsync('docker', ['inspect', name], { quiet: true })
        .then(() => {
            return true;
        })
        .catch(() => {
            return false;
        });
    },

    destroy: function(name, options) {
        return this.containerExists(name)
        .then((exists) => {
            if (exists) {
                return this.stop(name, { quiet: true })
                .then(() => {
                    return this.rm(name, { quiet: true });
                });
            }
        });
    },

    exec: function(name, args, options) {
        var dockerArgs = ['exec', name].concat(args);
        return cmd.spawnAsync('docker', dockerArgs, options);
    },

    imageExists: function(image, tag, message) {
        return cmd.spawnAsync('docker', ['images', image], { quiet: true })
        .then((output) => {
            if (output.indexOf(tag) === -1) {
                throw Error(message);
            }
        });
    },

    checkJuttleEngineLocalExists: function() {
        var message = 'You need to build the local juttle-engine container: ' +
                      '`docker build -t juttle/juttle-engine:latest .`  before you ' +
                      'can run these tests';
        return this.imageExists('juttle/juttle-engine', 'latest', message);
    },

    waitForSuccess: function(containerName, args, options) {
        /*
         * runs the command supplied as a list of arguments in the container
         * specified until it exits with a zero return code
         */
        options = options || {};
        options = _.defaults(options, { quiet: true });
        logger.log(`${containerName}: "${args.join(' ')}" waiting for success`);
        return retry(() => {
            return this.exec(containerName, args, options);
        }, { interval: 1000, max_tries: 20 })
        .then(() => {
            logger.log(`${containerName}: "${args.join(' ')}" succeeded`);
        })
        .catch((err) => {
            logger.log(`${containerName}: "${args.join(' ')}" failed`);
            throw err;
        });
    }
};
