'use strict';

let Promise = require('bluebird');
let expect = require('chai').expect;
let http = require('http');
let logger = require('mocha-logger');
let retry = require('bluebird-retry');
let spawn = require('child_process').spawn;

function spawnify(command, args) {
    return new Promise((resolve, reject) => {
        logger.log('spawning "' + command + ' ' + args.join(' '));
        var options = {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
        }
        var spawned = spawn(command, args, options);
        var stdout = '';
        var stderr = '';

        spawned.stdout.on('data', (data) => {
            logger.log('STDOUT:', data);
            stdout += data;
        });

        spawned.stderr.on('data', (data) => {
            logger.log('STDERR:', data);
            stderr += data;
        });

        spawned.on('close', (code) => {
            if (code === 0) {
                resolve(stdout, stderr);
            } else {
                reject(Error('command: "' + command + ' ' + args.join(' ') +
                             '", failed with ' + code));
            }
        });
    });
}

function dockerBash(command) {
    return spawnify('docker',
                    ['exec',
                     '-i',
                     'npm-test-container',
                     'bash',
                     '-l',
                     '-c',
                     command]);
}


describe('npm tests', () => {

    let retryHTTPOptions = {
        interval: 500,
        timeout: 10000
    };

    beforeEach(() => {
        return spawnify('docker',
                        ['ps',
                         '--filter=name=npm-test-container,status=running'])
        .then(() => {
            // lets stop the running container
            return spawnify('docker',
                            ['stop',
                             'npm-test-container']);
        })
        .catch(() => {
            // not running
        })
        .then(() => {
            return spawnify('docker',
                            ['ps',
                             '--filter=name=npm-test-container,status=exited'])
            .then(() => {
                // lets remove the lingering container
                return spawnify('docker',
                        ['rm',
                         'npm-test-container']);
            })
        })
        .catch(() => {
            // container already removed
        })
        .then(() => {
            return spawnify('docker',
                            ['run',
                             '-d',
                             '-p', '8080:8080',
                             '-v', process.cwd() + ':/opt/juttle-engine',
                             '--name', 'npm-test-container',
                             'node:4',
                             '/bin/sh', '-c', 'while true; do sleep 5; done']);
        });
    });

    afterEach(() => {
        return spawnify('docker', ['stop', 'npm-test-container'])
        .then(() => {
            return spawnify('docker', ['rm', 'npm-test-container']);
        });
    });

    it('can `npm install` locally', () => {
        return dockerBash('npm install --silent /opt/juttle-engine')
        .then(() => {
            // can access the locally installed juttle bin
            return dockerBash('./node_modules/.bin/juttle --version');
        })
        .then(() => {
            // can access the locally installed juttle-engine bin and daemonize the juttle-engine
            return dockerBash('./node_modules/.bin/juttle-engine --daemonize');
        })
        .then(() => {
            // check we can access port 8080 from the previously daemonized juttle-engine
            return retry(() => {
                return new Promise((resolve, reject) => {
                    http.get('http://localhost:8080', (resp) => {
                        if (resp.statusCode !== 200) {
                            reject(Error('juttle-engine not responding on localhost:8080'));
                        } else {
                            resolve();
                        }
                    })
                    .on('error', (err) => {
                        reject(err);
                    });
                });
            }, retryHTTPOptions);
        })
        .then(() => {
            // check we can use the juttle-engine-client to interact with the running
            // juttle-engine
            return dockerBash('./node_modules/.bin/juttle-engine-client list_jobs');
        })
        .then((stdout) => {
            expect(stdout.trim()).to.equal('[]');
        });
    });

    it('can `npm install` globally', () => {
        return dockerBash('npm install -g --silent /opt/juttle-engine')
        .then(() => {
            // can access the globally installed juttle bin
            return dockerBash('juttle --version');
        })
        .then(() => {
            // can access the globally installed juttle-engine bin and daemonize the juttle-engine
            return dockerBash('juttle-engine --daemonize');
        })
        .then(() => {
            // check we can access port 8080 from the previously daemonized juttle-engine
            return retry(() => {
                return new Promise((resolve, reject) => {
                    http.get('http://localhost:8080', (resp) => {
                        if (resp.statusCode !== 200) {
                            reject(Error('juttle-engine not responding on localhost:8080'));
                        } else {
                            resolve();
                        }
                    })
                    .on('error', (err) => {
                        reject(err);
                    });
                });
            }, retryHTTPOptions);
        })
        .then(() => {
            // check we can use the juttle-engine-client to interact with the running
            // juttle-engine
            return dockerBash('juttle-engine-client list_jobs');
        })
        .then((stdout) => {
            expect(stdout.trim()).to.equal('[]');
        });
    });
});
