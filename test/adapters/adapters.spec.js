'use strict';

let _ = require('underscore');
let Promise = require('bluebird');
let docker = require('../lib/docker');
let expect = require('chai').expect;
let fs = Promise.promisifyAll(require('fs'));
let logger = require('mocha-logger');
let path = require('path');
let retry = require('bluebird-retry');
let tmp = require('tmp');
let uuid = require('uuid');

function juttleBin(juttle, options) {
    options = _.defaults(options, {
        quiet: true
    });
    logger.log(`juttle -e "${juttle}"`);
    return docker.exec('juttle-engine-local',
                       ['/opt/juttle-engine/bin/juttle',
                        '-e',
                        juttle], options);
}

describe('adapters', () => {

    let tmpdir;

    before(() => {
        tmpdir = tmp.dirSync().name;

        return Promise.all([
            docker.destroy('elasticsearch-adapter-test'),
            docker.destroy('influxdb-adapter-test'),
            docker.destroy('graphite-adapter-test'),
            docker.destroy('mysql-adapter-test'),
            docker.destroy('postgres-adapter-test'),
            docker.destroy('juttle-engine-local')
        ])
        .then(() => {
            return docker.checkJuttleEngineLocalExists();
        })
        .then(() => {
            return Promise.all([
                docker.run({
                    name: 'elasticsearch-adapter-test',
                    image: 'elasticsearch:1.5.2',
                    detach: true
                }),
                docker.run({
                    name: 'influxdb-adapter-test',
                    image: 'tutum/influxdb:0.10',
                    detach: true
                }),
                docker.run({
                    name: 'graphite-adapter-test',
                    image: 'sitespeedio/graphite:0.9.14',
                    detach: true
                }),
                docker.run({
                    name: 'mysql-adapter-test',
                    image: 'mysql:5.7',
                    env: [
                        'MYSQL_ROOT_PASSWORD=password',
                        'MYSQL_DATABASE=testdb',
                        'MYSQL_USER=user',
                        'MYSQL_PASSWORD=password'
                    ],
                    detach: true
                }),
                docker.run({
                    name: 'postgres-adapter-test',
                    image: 'postgres:9.5',
                    env: [
                        'POSTGRES_PASSWORD=',
                        'POSTGRES_USER=postgres',
                        'POSTGRES_DB=testdb'
                    ],
                    detach: true
                })
            ]);
        })
        .then(() => {
            var config = JSON.stringify({
                adapters: {
                    elastic: {
                        address: 'elasticsearch',
                        port: 9200
                    },
                    influx: {
                        url: 'http://influxdb:8086'
                    },
                    graphite: {
                        carbon: {
                            host: 'graphite',
                            port: 2003
                        },
                        webapp: {
                            host: 'graphite',
                            port: 80,
                            username: 'guest',
                            password: 'guest'
                        }
                    },
                    mysql: {
                        user: 'user',
                        password: 'password',
                        host: 'mysqldb',
                        db: 'testdb'
                    },
                    postgres: [{
                        hostname: 'postgresdb',
                        port: 5432,
                        user: 'postgres',
                        pw: '',
                        db: 'testdb',
                        id: 'default'
                    }],
                    sqlite: {
                        // sqlite db within the juttle-engine-local container
                        filename: '/tmp/sqlite.db'
                    }
                }
            });

            var filename = path.join(tmpdir, '.juttle-config.json')
            return fs.writeFileAsync(filename, config)
        })
        .then(() => {
            return docker.run({
                name: 'juttle-engine-local',
                image: 'juttle/juttle-engine:latest',
                ports: ['8080:8080'],
                links: [
                    'elasticsearch-adapter-test:elasticsearch',
                    'influxdb-adapter-test:influxdb',
                    'graphite-adapter-test:graphite',
                    'mysql-adapter-test:mysqldb',
                    'postgres-adapter-test:postgresdb'
                ],
                volumes: [`${tmpdir}:/tmp`],
                workdir: '/tmp',
                detach: true
            });
        })
        .then(() => {
            return Promise.all([
                docker.waitForSuccess('elasticsearch-adapter-test',
                                      ['curl', 'http://localhost:9200']),
                docker.waitForSuccess('influxdb-adapter-test',
                                      ['influx', '-execute', 'show databases']),
                docker.waitForSuccess('graphite-adapter-test',
                                      ['curl', '-u', 'guest:guest', 'http://localhost:80']),
                docker.waitForSuccess('mysql-adapter-test',
                                      ['mysql', '-ppassword', '-uroot']),
                docker.waitForSuccess('postgres-adapter-test',
                                      ['psql', '-Upostgres', '-w', '-d', 'testdb'])
            ]);
        });
    });

    after(() => {
        return Promise.all([
            docker.destroy('elasticsearch-adapter-test'),
            docker.destroy('influxdb-adapter-test'),
            docker.destroy('graphite-adapter-test'),
            docker.destroy('mysql-adapter-test'),
            docker.destroy('postgres-adapter-test'),
            docker.destroy('juttle-engine-local')
        ]);
    });

    describe('juttle-elastic-adapter', () => {
        it('can write data and read back data using the juttle CLI', () => {
            var id = uuid.v1().slice(0, 8);

            return juttleBin(`emit -limit 5 -from :2014-01-01: | put name="test-${id}",value=count() | write elastic`)
            .then(() => {
                return retry(() => {
                    return juttleBin(`read elastic -from :2014-01-01: name="test-${id}" | view text`)
                    .then((output) => {
                        var data = JSON.parse(output);
                        expect(data).to.deep.equal([
                            { time: '2014-01-01T00:00:00.000Z', name: `test-${id}`, value: 1 },
                            { time: '2014-01-01T00:00:01.000Z', name: `test-${id}`, value: 2 },
                            { time: '2014-01-01T00:00:02.000Z', name: `test-${id}`, value: 3 },
                            { time: '2014-01-01T00:00:03.000Z', name: `test-${id}`, value: 4 },
                            { time: '2014-01-01T00:00:04.000Z', name: `test-${id}`, value: 5 }
                        ]);
                    });
                },{ timeout: 50000 } );
            });
        });
    });

    describe('juttle-influx-adapter', () => {
        it('can write data and read back data using the juttle CLI', () => {
            var id = uuid.v1().slice(0, 8);
            var db = `testdb_${id}`;

            return juttleBin(`read influx -db 'dummy' -raw 'CREATE DATABASE ${db}';`)
            .then(() => {
                return juttleBin(`emit -limit 5 -from :2014-01-01: | put name="test-${id}", value=count() | write influx -db '${db}'`);
            })
            .then(() => {
                return retry(() => {
                    return juttleBin(`read influx -db '${db}' -from :2014-01-01: name="test-${id}" | view text`)
                    .then((output) => {
                        var data = JSON.parse(output);
                        expect(data).to.deep.equal([
                            { time: '2014-01-01T00:00:00.000Z', name: `test-${id}`, value: 1 },
                            { time: '2014-01-01T00:00:01.000Z', name: `test-${id}`, value: 2 },
                            { time: '2014-01-01T00:00:02.000Z', name: `test-${id}`, value: 3 },
                            { time: '2014-01-01T00:00:03.000Z', name: `test-${id}`, value: 4 },
                            { time: '2014-01-01T00:00:04.000Z', name: `test-${id}`, value: 5 }
                        ]);
                    });
                }, { timeout: 5000 });
            });
        });
    });

    describe('juttle-graphite-adapter', () => {
        it('can write data and read back data using the juttle CLI', () => {
            var id = uuid.v1().slice(0, 8);

            // default data retention for graphite server is:
            //
            //  retentions = 5m:1d,15m:21d,30m:60d
            //
            // so we'll generate data from 30 minutes ago every 5 minutes and
            // then read back the exact points
            return juttleBin(`emit -limit 5 -every :5m: -from :30 minutes ago: | put name="test-${id}", value=count() | write graphite`)
            .then(() => {
                return retry(() => {
                    return juttleBin(`read graphite -from :60 minutes ago: name="test-${id}" | keep name, value | view text`)
                    .then((output) => {
                        var data = JSON.parse(output);
                        expect(data).to.deep.equal([
                            { name: `test-${id}`, value: 1 },
                            { name: `test-${id}`, value: 2 },
                            { name: `test-${id}`, value: 3 },
                            { name: `test-${id}`, value: 4 },
                            { name: `test-${id}`, value: 5 }
                        ]);
                    })
                }, { timeout: 5000 });
            });
        });
    });

    _.each([
        'mysql',
        'postgres',
        'sqlite'
    ], (adapterName) => {
        describe(`juttle-${adapterName}-adapter`, () => {
            it('can write data and read back data using the juttle CLI', () => {
                var id = uuid.v1().slice(0, 8);
                var table = `test_${id}`;

                // create a new table each time
                return juttleBin(`read ${adapterName} -db 'testdb' -raw "CREATE TABLE ${table}(time TIMESTAMP, name VARCHAR(32), value INTEGER);"`, { quiet: false })
                .then((output) => {
                    return juttleBin(`emit -limit 5 -from :2014-01-01: | put name="test-${id}", value=count() | write ${adapterName} -db 'testdb' -table '${table}'`);
                })
                .then(() => {
                    return retry(() => {
                        return juttleBin(`read ${adapterName} -db 'testdb' -table '${table}' -timeField 'time' -from :0: name="test-${id}" | view text`)
                        .then((output) => {
                            var data = JSON.parse(output);
                            expect(data).to.deep.equal([
                                { time: '2014-01-01T00:00:00.000Z', name: `test-${id}`, value: 1 },
                                { time: '2014-01-01T00:00:01.000Z', name: `test-${id}`, value: 2 },
                                { time: '2014-01-01T00:00:02.000Z', name: `test-${id}`, value: 3 },
                                { time: '2014-01-01T00:00:03.000Z', name: `test-${id}`, value: 4 },
                                { time: '2014-01-01T00:00:04.000Z', name: `test-${id}`, value: 5 }
                            ]);
                        });
                    }, { timeout: 5000 });
                });
            });
        });
    });
});
