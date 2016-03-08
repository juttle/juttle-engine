'use strict';

let _ = require('underscore');
let Promise = require('bluebird');
let chakram = require('chakram');
let docker = require('../lib/docker');
var expect = chakram.expect;
let fs = require('fs');
let http = require('http');
let path = require('path');
let cmd = require('../lib/cmd');
let retry = require('bluebird-retry');
let WebSocket = require('ws');

const YMLS = [
    'dc-juttle-engine.yml',
    'cadvisor-influx/dc-cadvisor-influx.yml',
    'postgres-diskstats/dc-postgres.yml'
]

function dockerCompose(ymls, command, commandArgs) {
    commandArgs = commandArgs || [];
    var args = [];

    _.each(ymls, (yml) => {
        args.push('-f');
        args.push(yml);
    });

    args.push(command);
    args = args.concat(commandArgs);

    var env = Object.create(process.env);
    // we need to set the PWD used by those yml files to . otherwise we inherit
    // from the current process running at the root of the  source code
    env.PWD = '.';
    return cmd.spawnAsync('docker-compose', args, {
        cwd: 'examples',
        env: env
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
    };

    before(() => {
        return docker.getHostAddress()
        .then((address) => {
            hostAddress = address;
            return docker.checkJuttleEngineLocalExists();
        })
        .then(() => {
            return dockerCompose(YMLS, 'stop');
        })
        .then(() => {
            return dockerCompose(YMLS, 'rm', ['--force']);
        })
        .then(() => {
            return dockerCompose(YMLS, 'up', ['-d']);
        })
        .then(() => {
            // wait for various underlying storages to be up and running
            return Promise.all([
                docker.waitForSuccess('examples_postgres_1',
                                      ['pgrep', 'postgres']),
                docker.waitForSuccess('examples_influxdb_1',
                                      ['influx', '-execute', 'show databases']),
                retry(() => {
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
                }, retryHTTPOptions)
            ]);
        });
    });

    after(() => {
        // shutdown and remove containers
        return dockerCompose(YMLS, 'stop')
        .then(() => {
            return dockerCompose(YMLS, 'rm', ['--force']);
        });
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
