'use strict';

let _ = require('underscore');
let Promise = require('bluebird');
let chakram = require('chakram');
var expect = chakram.expect;
let execAsync = Promise.promisify(require('child_process').exec);
let fs = require('fs');
let http = require('http');
let logger = require('mocha-logger');
let path = require('path');
let retry = require('bluebird-retry');
let spawn = require('child_process').spawn;
let WebSocket = require('ws');

function spawnify(command, args, options) {
    return new Promise((resolve, reject) => {
        args = args || [];
        logger.log('spawning "' + command + ' ' + args.join(' '));
        options = _.extend( {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
        }, options);

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

describe('examples', () => {
    let hostAddress = 'localhost';
    let juttleEnginePort = 8080;
    let baseUrl = `http://${hostAddress}:${juttleEnginePort}`
    let baseAPIUrl = `${baseUrl}/api/v0`

    let retryHTTPOptions = {
        interval: 500,
        timeout: 10000
    }

    before(() => {
        return execAsync('docker run ubuntu route | grep default | awk \'{print $2}\'')
        .then((stdout) => {
            hostAddress = stdout.trim();
            return spawnify('docker', ['build', '-q', '-t', 'juttle/juttle-engine:latest', '.']);
        })
        .then(() => {
            return spawnify('test/examples/start-example-containers.sh');
        })
        .then(() => {
            return retry(() => {
                return new Promise((resolve, reject) => {
                    http.get(baseUrl, (resp) => {
                        if (resp.statusCode !== 200) {
                            reject(Error(`juttle-engine not responding on ${baseUrl}`));
                        } else {
                            resolve();
                        }
                    })
                    .on('error', (err) => {
                        reject(err);
                    });
                });
            }, retryHTTPOptions);
        });
    });

    after(() => {
        // shutdown and remove containers
        return spawnify('test/examples/stop-example-containers.sh');
    });

    _.each({
        'core-juttle': 'examples/core-juttle',
        'cadvisor-influx': 'examples/cadvisor-influx/',
        'postgres-diskstats': 'examples/postgres-diskstats/'
    }, (directory, name) => {
        let juttles = fs.readdirSync(directory);
        juttles = juttles.filter((file) => {
            return file.endsWith('.juttle');
        });

        _.each(juttles, (filename) => {
            it(`can run the juttle "${directory}/${filename}" without errors or warnings`, () => {
                var jobId;
                var errors = [];
                var warnings = [];
                var views = {};
                var waitForData;

                return chakram.post(baseAPIUrl + '/jobs/', {
                    path: path.join(directory, filename)
                })
                .then((response) => {
                    expect(response).to.have.status(200);

                    jobId = response.body.job_id;
                    var wsClient = new WebSocket(baseAPIUrl + '/jobs/' + jobId);
                    waitForData = new Promise(function(resolve, reject) {
                        wsClient.on('message', function(data) {
                            data = data || '{}';
                            data = JSON.parse(data);

                            switch(data.type) {
                                case 'error':
                                    errors.push(data);
                                    break;

                                case 'warning':
                                    warnings.push(data);
                                    break;

                                case 'job_end':
                                    resolve();
                                    break;

                                case 'points':
                                    if (!views[data.view_id]) {
                                        views[data.view_id] = [];
                                    }
                                    views[data.view_id] = views[data.view_id].concat(data.points);
                                    break;
                            }
                        });
                    });
                })
                // after 500ms lets delete the job therefore stopping any long running program
                .delay(500)
                .then(() => {
                    return chakram.delete(baseAPIUrl + '/jobs/' + jobId);
                })
                .then((response) => {
                    expect(response).to.have.status(200);
                    return waitForData;
                })
                .then(() => {
                    // no errors or warnings
                    expect(errors).to.deep.equal([]);
                    expect(warnings).to.deep.equal([]);

                    // every view created should have at least 1 point
                    _.each(views, (points) => {
                        expect(points.length).to.be.above(0);
                    });
                });
            });
        });
    });
});
