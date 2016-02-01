var _ = require('underscore');
var chakram = require('chakram');
var expect = chakram.expect;
var logSetup = require('../lib/log-setup');
var JuttleEngine = require('../lib/juttle-engine');
var WebSocket = require('ws');
var Promise = require('bluebird');
var findFreePort = Promise.promisify(require('find-free-port'));
var fs = Promise.promisifyAll(require('fs'));
var fs_extra = Promise.promisifyAll(require('fs-extra'));

var JSDP = require('juttle-jsdp');
var moment = require('moment');

var juttleRoot = __dirname + '/juttle-root';
logSetup.init({'log-level': process.env.DEBUG ? 'debug' : 'info'});

var juttleBaseUrl;
function run_path(path) {
    var bundle;
    return chakram.get(juttleBaseUrl + '/paths/' + path)
        .then(function(bundle_response) {
            expect(bundle_response).to.have.status(200);
            bundle = bundle_response.body;
            return chakram.post(juttleBaseUrl + '/jobs/', bundle);
        })
        .then(function(run_response) {
            expect(run_response).to.have.status(200);
            return {
                bundle: bundle,
                job_id: run_response.body.job_id
            };
        });
}

// The syntax error info object for the file
// 'has-syntax-error.juttle'. Used in multiple places.
var has_syntax_error_info_obj = {
    bundle: {
        modules: {},
        program: 'emit -every :0.33s: -limit 5\n    | batch -every :1s:\n    | batch -every :1s:\n    | puty foo="bar"\n    | view table -display.progressive true\n'
    },
    err: {
        code: 'JUTTLE-SYNTAX-ERROR-WITH-EXPECTED',
        info: {
            expected: [
                {
                    description: '";"',
                    type: 'literal',
                    value: ';'
                },
                {
                    description: '"|"',
                    type: 'literal',
                    value: '|'
                },
                {
                    description: 'option',
                    type: 'other'
                }
            ],
            expectedDescription: '";", "|" or option',
            found: 'f',
            foundDescription: '"f"',
            location: {
                end: {
                    column: 13,
                    line: 4,
                    offset: 89
                },
                filename: 'main',
                start: {
                    column: 12,
                    line: 4,
                    offset: 88
                }
            }
        },
        message: 'Expected ";", "|" or option but "f" found.'
    }
};


// Remaining tests to create:
//   - Bundling with modules
//   - Running a program error cases. all should return reasonable error
//     - juttle program has syntax error
//     - specifies inputs that don't actually map to anything in the program

describe('Juttle Engine Tests', function() {
    var juttled;

    before(function() {
        findFreePort(10000, 20000)
        .then((freePort) => {
            juttleBaseUrl = 'http://localhost:' + freePort + '/api/v0';
            juttled = new JuttleEngine({port: freePort, root_directory: juttleRoot});
        });
    });

    after(function() {
        juttled.stop();
    });

    describe('Job Info Fetch Tests', function() {

        it('Fetch job id that doesn\'t exist', function() {
            var response = chakram.get(juttleBaseUrl + '/jobs/no-such-job');
            expect(response).to.have.status(404);
            expect(response).to.have.json({
                code: 'JS-JOB-NOT-FOUND-ERROR',
                message: 'No such job: no-such-job',
                info: {
                    job_id: 'no-such-job'
                }
            });
            return chakram.wait();
        });

        function start_job_check_job_id() {
            var job_id;
            return run_path('forever.juttle')
            .then(function(res) {
                job_id = res.job_id;
                var response = chakram.get(juttleBaseUrl + '/jobs/' + res.job_id);
                expect(response).to.have.status(200);

                var expected = _.extend({}, res.bundle, {
                    endpoints: [],
                    job_id: res.job_id
                });
                expect(response).to.have.json(expected);

                return chakram.wait();
            })
            .then(function() {
                var response = chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                return expect(response).to.have.status(200);
            });
        }

        it('Start first job, should be able to get that job id', function() {
            return start_job_check_job_id();
        });

        it('Start 2 jobs at once, should return both jobs', function() {
            var job_ids = [];
            var bundle;
            return run_path('forever.juttle')
            .then(function(res) {
                job_ids.push(res.job_id);

                // We only need 1 copy of the bundle, as we're running
                // the same program.
                bundle = res.bundle;

                return run_path('forever.juttle');
            })
            .then(function(res) {
                job_ids.push(res.job_id);
                var expected = _.map(job_ids, function(job_id) {
                    return _.extend({}, bundle, {
                        endpoints: [],
                        job_id: job_id
                    });
                });
                var response = chakram.get(juttleBaseUrl + '/jobs');
                expect(response).to.have.status(200);
                expect(response).to.have.json(expected);
                return chakram.wait();
            })
            .then(function() {
                return chakram.all(_.map(job_ids, function(job_id) {
                    return chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                }));
            });
        });

        it('Start & stop two jobs. Fetch all job ids, should not return anything', function() {
            var job_ids = [];
            return run_path('forever.juttle')
            .then(function(res) {
                job_ids.push(res.job_id);
                return run_path('forever.juttle');
            })
            .then(function(res) {
                job_ids.push(res.job_id);
                return chakram.all(_.map(job_ids, function(job_id) {
                    return chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                }));
            })
            .then(function() {
                return chakram.all(_.map(job_ids, function(job_id) {
                    return chakram.get(juttleBaseUrl + '/jobs/' + job_id);
                }));
            })
            .then(function(responses) {
                responses.forEach(function(response) {
                    expect(response).to.have.status(404);
                    // Not deeply checking the contents of the error
                    // here. Prior tests check that for the case of an
                    // unknown job.
                });
                return chakram.wait();
            })
            .then(function() {
                var response = chakram.get(juttleBaseUrl + '/jobs/');
                expect(response).to.have.status(200);
                expect(response).to.have.json([]);
                return chakram.wait();
            });
        });
    });

    describe('Bundling Tests', function() {
        describe('Invalid cases', function() {
            var dangling_symlink = juttleRoot + '/dangling-symlink.juttle';
            var not_readable = juttleRoot + '/not-readable.juttle';

            before(function() {
                fs_extra.removeAsync(dangling_symlink)
                .then(function() {
                    return fs_extra.removeAsync(not_readable);
                })
                .then(function() {
                    // Create a symlink to a file that doesn't exist
                    return fs.symlinkAsync('no-such-file.juttle', dangling_symlink);
                })
                .then(function() {
                    // Copy forever.juttle to a file and make it not readable.
                    return fs_extra.copyAsync(juttleRoot + '/forever.juttle', not_readable);
                })
                .then(function() {
                    return fs.chmodAsync(not_readable, '300');
                })
                .catch(function(err) {
                    throw err;
                });
            });


            it('File doesn\'t exist', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/no-such-path.juttle');
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-FILE-NOT-FOUND-ERROR',
                    message: 'No such file: no-such-path.juttle',
                    info: {
                        path: 'no-such-path.juttle'
                    }
                });
                return chakram.wait();
            });

            it('Is a directory', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/.');
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-FILE-NOT-FOUND-ERROR',
                    message: 'No such file: .',
                    info: {
                        path: '.'
                    }
                });
                return chakram.wait();
            });

            it('Is a dangling symlink', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/dangling-symlink.juttle');
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-FILE-NOT-FOUND-ERROR',
                    message: 'No such file: dangling-symlink.juttle',
                    info: {
                        path: 'dangling-symlink.juttle'
                    }
                });
                return chakram.wait();
            });

            it('Is not readable', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/not-readable.juttle');
                expect(response).to.have.status(403);
                expect(response).to.have.json({
                    code: 'JS-FILE-ACCESS-ERROR',
                    message: 'Can not read file: not-readable.juttle',
                    info: {
                        path: 'not-readable.juttle'
                    }
                });
                return chakram.wait();
            });

            it('Has a syntax error', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/has-syntax-error.juttle');
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: has_syntax_error_info_obj
                });
                return chakram.wait();
            });

            it('Refers to a module that doesn\'t exist', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/missing-module.juttle');
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: {
                        bundle: {
                            modules: {},
                            program: 'import \'no-such-juttle.juttle\' as nope;\n\nemit -limit 10 | put x=nope.a | view timechart;\n'
                        },
                        err: {
                            code: 'RT-MODULE-NOT-FOUND',
                            info: {
                                location: {
                                    'end': {
                                        'column': 40,
                                        'line': 1,
                                        'offset': 39
                                    },
                                    'filename': 'main',
                                    'start': {
                                        'column': 1,
                                        'line': 1,
                                        'offset': 0
                                    }
                                },
                                'module': 'no-such-juttle.juttle'
                            },
                            'message': 'Error: could not find module "no-such-juttle.juttle"'
                        }
                    }
                });
                return chakram.wait();
            });

            after(function() {
                return fs_extra.removeAsync(dangling_symlink)
                .then(function() {
                    return fs_extra.removeAsync(not_readable);
                })
                .catch(function(err) {
                    throw err;
                });
            });
        });

        describe('Valid cases', function() {

            var forever_program;
            var module_program;
            var test_module;
            var remote_module_program;
            var subdir_module;
            var module_relative_to_root_program;
            var module_relative_to_program_program;

            before(function() {
                return Promise.all(_.map(['forever.juttle',
                                          'modules.juttle',
                                          'test-module.juttle',
                                          'remote-module.juttle',
                                          'subdir/subdir-module.juttle',
                                          'subdir/modules-relative-to-root.juttle',
                                          'subdir/modules-relative-to-program.juttle'
                                         ], function(filename) {
                    return fs.readFileAsync(juttleRoot + '/' + filename, 'utf8');
                }))
                .then(function(files) {
                    forever_program = files[0];
                    module_program = files[1];
                    test_module = files[2];
                    remote_module_program = files[3];
                    subdir_module = files[4];
                    module_relative_to_root_program = files[5];
                    module_relative_to_program_program = files[6];
                });
            });

            it('Single .juttle file without modules', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/forever.juttle');
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    bundle: {
                        program: forever_program,
                        modules: {}
                    }
                });
                return chakram.wait();
            });

            it('Program with modules', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/modules.juttle');
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    bundle: {
                        program: module_program,
                        modules: {
                            'test-module.juttle': test_module
                        }
                    }
                });
                return chakram.wait();
            });

            it('Program with remote modules', function() {
                this.timeout(30000);
                var response = chakram.get(juttleBaseUrl + '/paths/remote-module.juttle');
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    bundle: {
                        program: remote_module_program,
                        modules: {
                            'https://gist.githubusercontent.com/go-oleg/8a71831b9fecd4f3250d/raw/1a622943b6e3ac7712942bb4e2cd6f8ec04136ad/main.juttle': 'export const a = 52;'
                        }
                    }
                });
                return chakram.wait();
            });

            it('Program with modules specified relative to root directory', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/subdir/modules-relative-to-root.juttle');
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    bundle: {
                        program: module_relative_to_root_program,
                        modules: {
                            '/subdir/subdir-module.juttle': subdir_module
                        }
                    }
                });
                return chakram.wait();
            });

            it('Program with modules specified relative to program', function() {
                var response = chakram.get(juttleBaseUrl + '/paths/subdir/modules-relative-to-program.juttle');
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    bundle: {
                        program: module_relative_to_program_program,
                        modules: {
                            'subdir-module.juttle': subdir_module
                        }
                    }
                });
                return chakram.wait();
            });
        });
    });

    describe('Get Directory Tests', function() {
        describe('Valid cases', function() {

            it('list contents of current directory', function() {
                return chakram.get(juttleBaseUrl + '/directory')
                .then(function(response) {
                    expect(response).to.have.status(200);

                    var body = response.body;
                    expect(body.is_root).to.be.true;
                    expect(body.path).to.equal('/');
                    expect(body.directories).to.deep.equal(['subdir']);
                    expect(body.juttles.length).to.be.above(0);
                })
            });

            it('list contents of subdir', function() {
                return chakram.get(juttleBaseUrl + '/directory?path=subdir')
                .then(function(response) {
                    expect(response).to.have.status(200);
                    expect(response.body.is_root).to.be.false;
                    expect(response.body.path).to.equal('/subdir');
                    expect(response.body.directories.length).to.equal(0);
                    expect(response.body.juttles.length).to.be.above(0);
                })
            });

            it('list root using subdir + ..', function() {
                return chakram.get(juttleBaseUrl + '/directory?path=/subdir/..')
                .then(function(response) {
                    expect(response).to.have.status(200);

                    var body = response.body;
                    expect(body.is_root).to.be.true;
                    expect(body.path).to.equal('/');
                    expect(body.directories).to.deep.equal(['subdir']);
                    expect(body.juttles.length).to.be.above(0);
                })
            });

        });

        describe('Invalid cases', function() {
            it('non existant path 404s', function() {
                var response = chakram.get(juttleBaseUrl + '/directory?path=non-existent')
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-DIR-NOT-FOUND-ERROR',
                    message: 'No such directory: non-existent',
                    info: {
                        path: 'non-existent'
                    }
                });
                return chakram.wait();
            });

            it('don\'t allow \'..\' when not at end of path', function() {
                var response = chakram.get(juttleBaseUrl + '/directory?path=/../..');
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-INVALID-PATH-ERROR',
                    message: '\'..\' only allow at end of path: /../..',
                    info: {
                        path: '/../..'
                    }
                });
                return chakram.wait();
            });

            it('don\'t allow users to navigate behind root', function() {
                var response = chakram.get(juttleBaseUrl + '/directory?path=/..');
                expect(response).to.have.status(403);
                expect(response).to.have.json({
                    code: 'JS-DIR-ACCESS-ERROR',
                    message: 'Can not read directory: /..',
                    info: {
                        path: '/..'
                    }
                });
                return chakram.wait();
            });

            it('fetching file and not directory throws error', function() {
                var response = chakram.get(juttleBaseUrl + '/directory?path=forever.juttle');
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-DIR-NOT-FOUND-ERROR',
                    message: 'No such directory: forever.juttle',
                    info: {
                        path: 'forever.juttle'
                    }
                });
                return chakram.wait();
            });
        });
    });

    describe('Run a Program From a Bundle Tests', function() {

        describe('Invalid Cases', function() {
            it('Empty body', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs', '');
                expect(response).to.have.json({
                    code: 'JS-BUNDLE-ERROR',
                    message: 'Malformed bundle: Unexpected token \"',
                    info: {
                        bundle: '\"\"',
                        reason: 'Unexpected token \"'
                    }
                });
                expect(response).to.have.status(400);
                return chakram.wait();
            });

            it('Non JSON', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs', 'not json');
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-BUNDLE-ERROR',
                    message: 'Malformed bundle: Unexpected token \"',
                    info: {
                        bundle: '\"not json\"',
                        reason: 'Unexpected token \"'
                    }
                });
                return chakram.wait();
            });

            it('Bundle without program', function() {
                var bundle = {};
                var response = chakram.post(juttleBaseUrl + '/jobs', {bundle: bundle});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-BUNDLE-ERROR',
                    message: 'Malformed bundle: Bundle does not contain program property',
                    info: {
                        bundle: bundle,
                        reason: 'Bundle does not contain program property'
                    }
                });
                return chakram.wait();
            });

            it('Program contains syntax error', function() {
                var bundle = {program: 'not juuttle'};
                var response = chakram.post(juttleBaseUrl + '/jobs', {bundle: bundle});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: {
                        bundle: bundle,
                        err: {

                            code: 'JUTTLE-SYNTAX-ERROR-WITH-EXPECTED',
                            info: {
                                expected: [
                                    {
                                        description: '";"',
                                        type: 'literal',
                                        value: ';'
                                    },
                                    {
                                        description: '"|"',
                                        type: 'literal',
                                        value: '|'
                                    },
                                    {
                                        description: 'option',
                                        type: 'other'
                                    }
                                ],
                                expectedDescription: '";", "|" or option',
                                found: 'j',
                                foundDescription: '"j"',
                                location: {
                                    end: {
                                        column: 6,
                                        line: 1,
                                        offset: 5
                                    },
                                    filename: 'main',
                                    start: {
                                        column: 5,
                                        line: 1,
                                        offset: 4
                                    }
                                }
                            },
                            message: 'Expected ";", "|" or option but "j" found.'
                        }
                    }
                });
                return chakram.wait();
            });

            it('Program contains syntax error in module', function() {
                var bundle = {
                    program: 'import "errors.juttle" as j1; emit -limit 1 | view table',
                    modules: {
                        'errors.juttle': 'not juttle'
                    }
                };
                var response = chakram.post(juttleBaseUrl + '/jobs', {bundle: bundle});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: {
                        bundle: bundle,
                        err: {

                            code: 'JUTTLE-SYNTAX-ERROR-WITH-EXPECTED',
                            info: {
                                expected: [
                                    {
                                        description: '";"',
                                        type: 'literal',
                                        value: ';'
                                    },
                                    {
                                        description: '"|"',
                                        type: 'literal',
                                        value: '|'
                                    },
                                    {
                                        description: 'option',
                                        type: 'other'
                                    }
                                ],
                                expectedDescription: '";", "|" or option',
                                found: 'j',
                                foundDescription: '"j"',
                                location: {
                                    end: {
                                        column: 6,
                                        line: 1,
                                        offset: 5
                                    },
                                    filename: 'errors.juttle',
                                    start: {
                                        column: 5,
                                        line: 1,
                                        offset: 4
                                    }
                                }
                            },
                            message: 'Expected ";", "|" or option but "j" found.'
                        }
                    }
                });
                return chakram.wait();
            });

            it('Program contains reference to undefined module', function() {
                var bundle = {
                    program: 'import "no-such-module.juttle" as j1; emit -limit 1 | put foo=j1.val | view table'
                };
                var response = chakram.post(juttleBaseUrl + '/jobs', {bundle: bundle});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: {
                        bundle: bundle,
                        err: {
                            code: 'RT-MODULE-NOT-FOUND',
                            info: {
                                location: {
                                    end: {
                                        column: 38,
                                        line: 1,
                                        offset: 37
                                    },
                                    filename: 'main',
                                    start: {
                                        column: 1,
                                        line: 1,
                                        offset: 0
                                    }
                                },
                                module: 'no-such-module.juttle'
                            },
                            message: 'Error: could not find module "no-such-module.juttle"'
                        }
                    }
                });
                return chakram.wait();
            });
        });

        describe('Valid Cases', function() {

            it('Simple program', function() {
                return chakram.post(juttleBaseUrl + '/jobs', {bundle: {program: 'emit -limit 1 | view table'}})
                .then(function(response) {
                    expect(response).to.have.status(200);
                    expect(response.body).to.include.keys('job_id');
                });
            });

            it('Simple program with modules', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs', {
                    bundle: {
                        program: 'import \"mod.juttle\" as mod; emit -limit 1 | put key=mod.val | view table',
                        modules: {
                            'mod.juttle': 'export const val=3;'
                        }
                    }
                });
                return expect(response).to.have.status(200);
            });

            it('With wait=true', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {
                    bundle: {
                        program: 'emit -from :0: -limit 1 | put foo=\'bar\' | view text'
                    },
                    wait: true
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    errors: [],
                    warnings: [],
                    output: {
                        sink0: {
                            data: [{type: 'point', point: {foo: 'bar', 'time:date': '1970-01-01T00:00:00.000Z'}}],
                            options: {
                                _jut_time_bounds: []
                            },
                            type: 'text'
                        }
                    }
                });

                return chakram.wait();
            });
        });
    });

    describe('Run a Program From a Path Tests', function() {

        describe('Invalid Cases', function() {
            it('From a path that doesn\'t exist', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'no-such-path.juttle', wait: true});
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-FILE-NOT-FOUND-ERROR',
                    message: 'No such file: no-such-path.juttle',
                    info: {
                        path: 'no-such-path.juttle'
                    }
                });
                return chakram.wait();
            });

            it('From a path that has juttle compile errors', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'has-syntax-error.juttle', wait: true});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: has_syntax_error_info_obj
                });
                return chakram.wait();
            });

            it('From a path where the timeout triggers', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'forever.juttle', timeout: 2000, wait: true});
                expect(response).to.have.status(408);
                expect(response).to.have.json({
                    code: 'JS-TIMEOUT-ERROR',
                    message: 'Program timed out after 2000 ms',
                    info: {timeout: 2000}
                });
                return chakram.wait();
            });
        });

        describe('Valid Cases', function() {
            it('Simple program', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'simple.juttle', wait: true});
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    errors: [],
                    warnings: [],
                    output: {
                        sink0: {
                            data: [{type: 'mark', 'time:date': '1970-01-01T00:00:00.000Z'},
                                   {type: 'point', point: {'time:date': '1970-01-01T00:00:00.000Z'}},
                                   {type: 'point', point: {'time:date': '1970-01-01T00:00:01.000Z'}},
                                   {type: 'mark', 'time:date': '1970-01-01T00:00:02.000Z'},
                                   {type: 'point', point: {'time:date': '1970-01-01T00:00:02.000Z'}},
                                   {type: 'mark', 'time:date': '1970-01-01T00:00:04.000Z'}],
                            options: {
                                _jut_time_bounds: [],
                                format: 'raw'
                            },
                            type: 'text'
                        },
                        sink1: {
                            data: [{type: 'mark', 'time:date': '1970-01-01T00:00:00.000Z'},
                                   {type: 'point', point: {'time:date': '1970-01-01T00:00:00.000Z'}},
                                   {type: 'point', point: {'time:date': '1970-01-01T00:00:01.000Z'}},
                                   {type: 'mark', 'time:date': '1970-01-01T00:00:02.000Z'},
                                   {type: 'point', point: {'time:date': '1970-01-01T00:00:02.000Z'}},
                                   {type: 'mark', 'time:date': '1970-01-01T00:00:04.000Z'}],
                            options: {
                                _jut_time_bounds: [],
                                title: 'My Table'
                            },
                            type: 'table'
                        }
                    }
                });

                return chakram.wait();
            });

            it('Program w/ modules', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'modules.juttle', wait: true});
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    errors: [],
                    warnings: [],
                    output: {
                        sink0: {
                            data: [{type: 'point', point: {foo: 'bar', 'time:date': '1970-01-01T00:00:00.000Z'}}],
                            options: {
                                _jut_time_bounds: []
                            },
                            type: 'text'
                        }
                    }
                });

                return chakram.wait();
            });

            it('Program w/ inputs', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {
                    path: 'inputs.juttle',
                    inputs: JSDP.serialize({
                        inval: 'baz'
                    }, {
                        toObject: true
                    }),
                    wait: true
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    errors: [],
                    warnings: [],
                    output: {
                        sink0: {
                            data: [{type: 'point', point: {foo: 'baz', 'time:date': '1970-01-01T00:00:00.000Z'}}],
                            options: {
                                _jut_time_bounds: []
                            },
                            type: 'text'
                        }
                    }
                });

                return chakram.wait();
            });

            it('Program with runtime errors', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'runtime_errors.juttle', wait: true});
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    errors: [{
                        code: 'RT-INTERNAL-ERROR',
                        info: {
                            error: 'Error: ENOENT: no such file or directory, open \'nobody\'',
                            location: {
                                end: {column: 1, line: 2, offset: 25},
                                filename: 'main',
                                start: {column: 1, line: 1, offset: 0}
                            },
                            procName: 'read-file'
                        },
                        message: 'Error: internal error Error: ENOENT: no such file or directory, open \'nobody\''
                    }],
                    warnings: [],
                    output: {
                        sink0: {
                            data: [],
                            options: {
                                _jut_time_bounds: [{from: null, last: null, to: null}]
                            },
                            type: 'table'
                        }
                    }
                });

                return chakram.wait();

            });

            it('Program with runtime warnings', function() {
                var response = chakram.post(juttleBaseUrl + '/jobs/', {path: 'runtime_warnings.juttle', wait: true});
                expect(response).to.have.status(200);
                expect(response).to.have.json({
                    errors: [],
                    warnings: [{
                        code: 'RT-FIELD-NOT-FOUND',
                        info: {
                            field: 'nobody',
                            location: {
                                end: {column: 1, line: 2, offset: 38},
                                filename: 'main',
                                start: {column: 27, line: 1, offset: 26}
                            },
                            procName: 'sort'
                        },
                        message: 'Warning: field "nobody" does not exist'
                    }],
                    output: {
                        sink0: {
                            data: [{type: 'point', point: {}}],
                            options: {
                                _jut_time_bounds: []
                            },
                            type: 'table'
                        }
                    }
                });

                return chakram.wait();
            });

            it('With wait=false', function() {
                return chakram.post(juttleBaseUrl + '/jobs/', {path: 'modules.juttle', wait: false})
                .then(function(response) {
                    expect(response).to.have.status(200);
                    expect(response.body).to.include.keys('job_id');
                });
            });
        });

    });

    describe('Observer Tests', function() {

        describe('Observer job notifications', function() {
            var observer_a;
            var observer_b;

            beforeEach(function(done) {
                observer_a = new WebSocket(juttleBaseUrl + '/observers/A');
                observer_a.on('open', function() {
                    observer_b = new WebSocket(juttleBaseUrl + '/observers/B');
                    observer_b.on('open', function() {
                        done();
                    });
                });
            });

            it('Can view 2 observers', function() {
                var response = chakram.get(juttleBaseUrl + '/observers');
                expect(response).to.have.status(200);
                expect(response).to.have.json([
                    {observer_id: 'A'},
                    {observer_id: 'B'}
                ]);
                return chakram.wait();
            });

            it('Start/stop program on observer, should get job started/stopped messages', function(done) {
                var got_start_message = false;
                var job_id;

                // This message listener controls the test. It succeeds
                // when we've seen the job_start and job_end messages for
                // the same job_id being started later in the test.
                observer_a.on('message', function(data) {
                    data = JSON.parse(data);
                    if (data.type === 'job_start') {
                        got_start_message = true;
                    } else if (data.type === 'job_end') {
                        expect(got_start_message).to.be.true;
                        expect(job_id).to.equal(data.job_id);
                        done();
                    }
                });
                chakram.post(juttleBaseUrl + '/jobs', {
                    bundle: {program: 'emit -limit 10000 | view table'},
                    observer: 'A'
                })
                .then(function(response) {
                    job_id = response.body.job_id;
                })
                .then(function() {
                    var response = chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                    expect(response).to.have.status(200);
                    return chakram.wait();
                });

                // The test acually succeeds in the message handler above.
            });

            it('Verify that killing juttle subprocess still results in job_stopped message', function(done) {
                observer_a.on('message', function(data) {
                    data = JSON.parse(data);
                    if (data.type === 'job_end') {
                        done();
                    }
                });
                var response = chakram.post(juttleBaseUrl + '/jobs', {
                    bundle: {program: 'emit -limit 10000 | view table'},
                    observer: 'A',
                    return_pid: true
                });
                return expect(response).to.have.status(200)
                .then(function(response) {
                    process.kill(response.body.pid, 'SIGTERM');
                });
            });

            afterEach(function(done) {
                observer_b.on('close', function() {
                    done();
                });
                observer_a.on('close', function() {
                    observer_b.close();
                });
                observer_a.close();
            });
        });

        describe('Listing observers', function() {

            it('Start and stop 2 observers, checking list observers along the way', function(done) {
                var observer_a = new WebSocket(juttleBaseUrl + '/observers/A');
                var observer_b;

                observer_a.on('close', function() {
                    var response = chakram.get(juttleBaseUrl + '/observers');
                    expect(response).to.have.status(200);
                    expect(response).to.have.json([
                        {observer_id: 'B'}
                    ]);
                    chakram.wait()
                    .then(function() {
                        observer_b.close();
                    });
                });

                observer_a.on('open', function() {
                    observer_b = new WebSocket(juttleBaseUrl + '/observers/B');
                    observer_b.on('open', function() {
                        observer_b.on('close', function() {
                            var response = chakram.get(juttleBaseUrl + '/observers');
                            expect(response).to.have.status(200);
                            expect(response).to.have.json([]);
                            chakram.wait()
                            .then(function() {
                                done();
                            });
                        });

                        observer_a.close();
                    });
                });
            });
        });
    });

    describe('Juttle Data Websocket Tests', function() {

        var run_program_with_initial_timeout = function(initial_delay, done) {
            var ws_client;

            chakram.post(juttleBaseUrl + '/jobs', {
                bundle: {program: 'import \"module.juttle\" as mod;' +
                         'input my_input: dropdown -label "My Input" -items [10, 20, 30];' +
                         'input my_date_input: date;' +
                         'emit -limit 5 | put fromInput = true, val=my_input, datePlus2s = my_date_input + :2s: | batch -every :1s: | view table;' +
                         'emit -limit 5 | put val2=mod.val | batch -every :1s: | view logger',
                         modules: {
                             'module.juttle': 'export const val=30;'
                         }
                        },
                inputs: JSDP.serialize({
                    my_input: 20,
                    my_date_input: new Date(1000)
                }, {
                    toObject: true
                })
            })
            // Add an initial delay to force use of the job
            // manager replay ability for new websockets.
            .delay(initial_delay)
                .then(function(response) {
                    var job_id = response.body.job_id;
                    var got_job_start = false;
                    var num_points = 0;
                    var num_ticks = 0;
                    var num_marks = 0;
                    var num_sink_ends = 0;
                    ws_client = new WebSocket(juttleBaseUrl + '/jobs/' + job_id);
                    ws_client.on('message', function(data) {
                        //console.log("Got Websocket:", data);
                        data = JSDP.deserialize(data);
                        if (data.type === 'job_start') {
                            got_job_start = true;
                            expect(data.job_id === job_id);
                            expect(data.sinks[0].sink_id).to.match(/sink\d+/);
                            expect(data.sinks[1].sink_id).to.match(/sink\d+/);

                            // Change the sink ids to just "sink" to
                            // allow for an exact match of the full
                            // sink description.
                            data.sinks[0].sink_id = 'sink';
                            data.sinks[1].sink_id = 'sink';

                            expect(data.sinks).to.deep.equal([
                                {
                                    type: 'table',
                                    sink_id: 'sink',
                                    options: {
                                        '_jut_time_bounds': []
                                    }
                                },
                                {
                                    type: 'logger',
                                    sink_id: 'sink',
                                    options: {
                                        '_jut_time_bounds': []
                                    }
                                }
                            ]);
                        } else if (data.type === 'job_end') {
                            expect(data.job_id === job_id);

                            // Now check that we received all the ticks/marks/etc we expected.
                            expect(got_job_start).to.be.true;
                            expect(num_points).to.equal(10);

                            // We allow fewer ticks because ticks
                            // occur every second on the second while
                            // the points are emitted from :now:,
                            // which may not land exactly on a given
                            // second.
                            expect(num_ticks).to.be.within(8,10);

                            expect(num_marks).to.be.equal(12);
                            expect(num_sink_ends).to.equal(2);
                            done();
                        } else if (data.type === 'tick') {
                            num_ticks++;
                            expect(data.sink_id).to.match(/sink\d+/);
                            expect(data.job_id).to.equal(job_id);
                        } else if (data.type === 'mark') {
                            num_marks++;
                            expect(data.sink_id).to.match(/sink\d+/);
                            expect(data.job_id).to.equal(job_id);
                        } else if (data.type === 'sink_end') {
                            num_sink_ends++;
                            expect(data.sink_id).to.match(/sink\d+/);
                            expect(data.job_id).to.equal(job_id);
                        } else if (data.type === 'points') {
                            num_points++;
                            expect(data.sink_id).to.match(/sink\d+/);
                            expect(data.job_id).to.equal(job_id);
                            expect(data.points).to.have.length(1);

                            // val properties come from the
                            // input. val2 properties come from the
                            // module.
                            if (_.has(data.points[0], 'fromInput')) {
                                expect(data.points[0].val).to.equal(20);
                                expect(data.points[0].datePlus2s.getTime()).to.equal(new Date(3000).getTime());
                            } else {
                                expect(data.points[0].val2).to.equal(30);
                            }
                        }
                    });
                });
        };

        describe('Valid Cases', function() {
            this.timeout(30000);
            it('Single websocket can get start, points, end messages', function(done) {
                run_program_with_initial_timeout(2000, done);
            });

            it('Late subscriber (after job stops) can still get start, points, end messages', function(done) {
                run_program_with_initial_timeout(8000, done);
            });

            it('runtime errors', function() {
                return chakram.post(juttleBaseUrl + '/jobs', {
                    bundle: {
                        program: 'read file -file "nobody"'
                    }
                })
                .then(function(response) {
                    var job_id = response.body.job_id;
                    var ws_client = new WebSocket(juttleBaseUrl + '/jobs/' + job_id);
                    var got_error = false;
                    return new Promise(function(resolve, reject) {
                        ws_client.on('message', function(data) {
                            data = data || '{}';
                            data = JSON.parse(data);
                            if (data.type === 'error' && data.error.message.match(/ENOENT/)) {
                                got_error = true;
                            }

                            if (data.type === 'job_end') {
                                if (!got_error) {
                                    reject(new Error('should have gotten job error message'));
                                } else {
                                    resolve();
                                }
                            }
                        });
                    });
                });
            });

            it('runtime warnings', function() {
                return chakram.post(juttleBaseUrl + '/jobs', {
                    bundle: {
                        program: 'emit -from :0: -limit 1 | sort nobody'
                    }
                })
                .then(function(response) {
                    var job_id = response.body.job_id;
                    var ws_client = new WebSocket(juttleBaseUrl + '/jobs/' + job_id);
                    var got_warning = false;
                    return new Promise(function(resolve, reject) {
                        ws_client.on('message', function(data) {
                            data = data || '{}';
                            data = JSON.parse(data);
                            if (data.type === 'warning') {
                                got_warning = true;
                            }

                            if (data.type === 'job_end') {
                                if (!got_warning) {
                                    reject(new Error('should have gotten job warning message'));
                                } else {
                                    resolve();
                                }
                            }
                        });
                    });
                });
            });
        });

        describe('Invalid Cases', function() {
            it('Websocket connection to non-existent job, should get reasonable message', function(done) {
                var ws_client = new WebSocket(juttleBaseUrl + '/jobs/no-such-job');
                ws_client.on('message', function(data) {
                    data = JSDP.deserialize(data);
                    expect(data).to.deep.equal({err: 'No such job: no-such-job'});
                    done();
                });
            });

            it('Websocket connection after job has finished, should get reasonable message', function(done) {

                var job_id;

                var response = chakram.post(juttleBaseUrl + '/jobs', {
                    bundle: {program: 'emit -limit 10 | view table'}
                });
                return expect(response).to.have.status(200)
                .then(function(response) {
                    job_id = response.body.job_id;
                    response = chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                    return expect(response).to.have.status(200);
                })
                .then(function(response) {
                    var ws_client = new WebSocket(juttleBaseUrl + '/jobs/' + job_id);
                    ws_client.on('message', function(data) {
                        data = JSDP.deserialize(data);
                        expect(data).to.deep.equal({err: 'No such job: ' + job_id});
                        done();
                    });
                });
            });

            // Skipping this test as it takes ~1m. But it does pass.
            it.skip('Don\'t respond to pings with pongs. Will be eventually disconnected', function(done) {
                this.timeout(90000);

                var observer = new WebSocket(juttleBaseUrl + '/observers/A');
                observer.on('close', function() {
                    done();
                });
            });
        });

    });

    describe('Stop a Job Tests', function() {

        it('Try to stop non-existent job', function() {
            var response = chakram.delete(juttleBaseUrl + '/jobs/no-such-job');
            expect(response).to.have.status(404);
            expect(response).to.have.json({
                code: 'JS-JOB-NOT-FOUND-ERROR',
                message: 'No such job: no-such-job',
                info: {
                    job_id: 'no-such-job'
                }
            });
            return chakram.wait();
        });

        it('Able to start and stop a single job', function() {
            var job_id;
            return run_path('forever.juttle')
            .then(function(res) {
                job_id = res.job_id;
                var response = chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                return expect(response).to.have.status(200);
            })
            .then(function() {
                var response = chakram.get(juttleBaseUrl + '/jobs/' + job_id);
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-JOB-NOT-FOUND-ERROR',
                    message: 'No such job: ' + job_id,
                    info: {
                        job_id: job_id
                    }
                });
                return chakram.wait();
            });
        });

        it('Can not stop the same job twice', function() {
            var job_id;
            return run_path('forever.juttle')
            .then(function(res) {
                job_id = res.job_id;
                var response = chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                return expect(response).to.have.status(200);
            })
            .then(function() {
                var response = chakram.delete(juttleBaseUrl + '/jobs/' + job_id);
                expect(response).to.have.status(404);
                expect(response).to.have.json({
                    code: 'JS-JOB-NOT-FOUND-ERROR',
                    message: 'No such job: ' + job_id,
                    info: {
                        job_id: job_id
                    }
                });
                return chakram.wait();
            });
        });
    });

    describe('Prepare Inputs Tests', function() {
        describe('Valid Cases', function() {
            it('Simple program with a single input', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'input a: dropdown -label "My Input" -items [10, 20, 30]; ' +
                            'emit -limit 1 | put myval=a | view table'
                    }
                });

                expect(response).to.have.status(200);
                expect(response).to.have.json([{
                    'type': 'dropdown',
                    'id': 'a',
                    'static': true,
                    'value': null,
                    'options': {
                        'label': 'My Input',
                        'items': [10, 20, 30]
                    }
                }]);
                return chakram.wait();
            });

            it('Program with multiple inputs', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'input a: dropdown -label "My Input" -items [10, 20, 30]; ' +
                            'input b: combobox -label "My Combobox" -items [20, 30, 40] -default 40 -description "Here is a combobox"; ' +
                            'input c: date -default :2010-01-01T00:00:00.000Z:;' +
                            'input d: duration -default :2 hours:;' +
                            'emit -limit 1 | put myval=a, someval=b | view table'
                    }
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json(JSDP.serialize([
                    {
                        'type': 'dropdown',
                        'id': 'a',
                        'static': true,
                        'value': null,
                        'options': {
                            'label': 'My Input',
                            'items': [10, 20, 30]
                        }
                    },
                    {
                        'type': 'combobox',
                        'id': 'b',
                        'static': true,
                        'value': 40,
                        'options': {
                            'label': 'My Combobox',
                            'items': [20, 30, 40],
                            'default': 40,
                            'description': 'Here is a combobox'
                        }
                    },
                    {
                        'type': 'date',
                        'id': 'c',
                        'static': true,
                        'value': new Date('2010-01-01T00:00:00.000Z'),
                        'options': {
                            'default': new Date('2010-01-01T00:00:00.000Z')
                        }
                    },
                    {
                        'type': 'duration',
                        'id': 'd',
                        'static': true,
                        'value': moment.duration(2, 'hours'),
                        'options': {
                            'default': moment.duration(2, 'hours')
                        }
                    }
                ], { toObject: true }));
                return chakram.wait();

            });

            it('Program with a value overriding a default', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'input a: dropdown -label "My Input" -items [10, 20, 30] -default 10; ' +
                            'input b: date -default :2010-01-01T00:00:00.000Z:;' +
                            'input c: duration -default :2 hours:;' +
                            'emit -limit 1 | put myval=a | view table'
                    },
                    inputs: JSDP.serialize({
                        a: 20,
                        b: new Date('2010-01-02T00:00:00.000Z'),
                        c: moment.duration(5, 'hours')
                    }, { toObject: true })
                });

                expect(response).to.have.status(200);
                expect(response).to.have.json(JSDP.serialize([
                    {
                        'type': 'dropdown',
                        'id': 'a',
                        'static': true,
                        'value': 20,
                        'options': {
                            'label': 'My Input',
                            'items': [10, 20, 30],
                            default: 10
                        }
                    },
                    {
                        'type': 'date',
                        'id': 'b',
                        'static': true,
                        'value': new Date('2010-01-02T00:00:00.000Z'),
                        'options': {
                            'default': new Date('2010-01-01T00:00:00.000Z')
                        }
                    },
                    {
                        'type': 'duration',
                        'id': 'c',
                        'static': true,
                        'value': moment.duration(5, 'hours'),
                        'options': {
                            'default': moment.duration(2, 'hours')
                        }
                    }
                ], { toObject: true }));
                return chakram.wait();
            });

            it('Program with multiple inputs where one input depends on the value of another', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'input a: dropdown -label "My Input" -items [10, 20, 30]; ' +
                            'input b: combobox -label "My Combobox" -items [a, 30, 40] -default 40 -description "Here is a combobox"; ' +
                            'emit -limit 1 | put myval=a, someval=b | view table'
                    },
                    inputs: {
                        a: 10
                    }
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json([
                    {
                        'type': 'dropdown',
                        'id': 'a',
                        'static': true,
                        'value': 10,
                        'options': {
                            'label': 'My Input',
                            'items': [10, 20, 30]
                        }
                    },
                    {
                        'type': 'combobox',
                        'id': 'b',
                        'static': false,
                        'value': 40,
                        'options': {
                            'label': 'My Combobox',
                            'items': [10, 30, 40],
                            'default': 40,
                            'description': 'Here is a combobox'
                        }
                    }]);
                return chakram.wait();
            });

            it('Program with -juttle inputs', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'input a: dropdown -label "My Input" -juttle "emit -limit 10"; ' +
                            'emit -limit 1 | put myval=a | view table'
                    }
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json([
                    {
                        'type': 'dropdown',
                        'id': 'a',
                        'static': true,
                        'value': null,
                        'options': {
                            'label': 'My Input',
                            'juttle': 'emit -limit 10'
                        }
                    }]);
                return chakram.wait();
            });

            it('Program with inputs defined in a sub', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'input x: number; ' +
                            'sub y() { input x: text -default "foo"; input y: dropdown -items [1, 2, 3] ; pass } ' +
                            'emit | y; emit -limit 1 | put myval=a | view table'
                    }
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json([
                    {
                        'id': 'x',
                        'type': 'number',
                        'options': {},
                        'static': true,
                        'value': null
                    },
                    {
                        'id': 'y.x[0]',
                        'type': 'text',
                        'options': {
                            'default': 'foo'
                        },
                        'static': true,
                        'value': 'foo'
                    },
                    {
                        'id': 'y.y[0]',
                        'type': 'dropdown',
                        'options': {
                            'items': [1, 2, 3]
                        },
                        'static': true,
                        'value': null
                    }]);
                return chakram.wait();
            });

            it('Program with inputs defined in a module', function() {
                var response = chakram.post(juttleBaseUrl + '/prepare', {
                    bundle: {
                        program: 'import \"input.juttle\" as inp; ' +
                            'sub y() { input x: text -default "foo"; input y: dropdown -items [1, 2, 3] ; pass } ' +
                            'emit | y; emit -limit 1 | put myval=a | view table',
                        modules: {
                            'input.juttle': 'input x: number;'
                        }
                    }
                });
                expect(response).to.have.status(200);
                expect(response).to.have.json([
                    {
                        'id': 'input.juttle/x',
                        'type': 'number',
                        'options': {},
                        'static': true,
                        'value': null
                    },
                    {
                        'id': 'y.x[0]',
                        'type': 'text',
                        'options': {
                            'default': 'foo'
                        },
                        'static': true,
                        'value': 'foo'
                    },
                    {
                        'id': 'y.y[0]',
                        'type': 'dropdown',
                        'options': {
                            'items': [1, 2, 3]
                        },
                        'static': true,
                        'value': null
                    }]);
                return chakram.wait();
            });
        });

        describe('Invalid Cases', function() {
            it('Empty program', function() {
                var bundle = {
                    program: ''
                };
                var response = chakram.post(juttleBaseUrl + '/prepare', {bundle: bundle});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: {
                        bundle: bundle,
                        err: {
                            message: 'Error: Cannot run a program without a flowgraph.',
                            code: 'RT-PROGRAM-WITHOUT-FLOWGRAPH',
                            info: {
                                location: {
                                    filename: 'main',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1
                                    },
                                    end: {
                                        offset: 0,
                                        line: 1,
                                        column: 1
                                    }
                                }
                            }
                        }
                    }
                });
                return chakram.wait();
            });

            it('Not juttle', function() {
                var bundle = {program: 'not juttle'};
                var response = chakram.post(juttleBaseUrl + '/prepare', {bundle: bundle});
                expect(response).to.have.status(400);
                expect(response).to.have.json({
                    code: 'JS-JUTTLE-ERROR',
                    message: 'Error from juttle compiler or runtime',
                    info: {
                        bundle: bundle,
                        err: {
                            message: 'Expected ";", "|" or option but "j" found.',
                            code: 'JUTTLE-SYNTAX-ERROR-WITH-EXPECTED',
                            info: {
                                location: {
                                    end: {
                                        column: 6,
                                        line: 1,
                                        offset: 5
                                    },
                                    start: {
                                        column: 5,
                                        line: 1,
                                        offset: 4
                                    },
                                    filename: 'main'
                                },
                                foundDescription: '"j"',
                                found: 'j',
                                expectedDescription: '";", "|" or option',
                                expected: [
                                    {
                                        description: '";"',
                                        value: ';',
                                        type: 'literal'
                                    },
                                    {
                                        description: '"|"',
                                        value: '|',
                                        type: 'literal'
                                    },
                                    {
                                        description: 'option',
                                        type: 'other'
                                    }
                                ]
                            }
                        }
                    }
                });
                return chakram.wait();
            });
        });
    });
});
