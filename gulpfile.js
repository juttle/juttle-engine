'use strict';

var eslint = require('gulp-eslint');
var gulp = require('gulp');
var isparta = require('isparta');
var istanbul = require('gulp-istanbul');
var mocha = require('gulp-mocha');

gulp.task('lint', function() {
    return gulp.src([
        'gulpfile.js',
        'bin/*',
        'lib/**/*.js',
        'test/**/*.js'
    ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('instrument', function () {
    return gulp.src([
        'lib/**/*.js',
        'src/**/*.js'
    ])
    .pipe(istanbul({
        includeUntested: true,
        // ES6 Instrumentation
        instrumenter: isparta.Instrumenter
    }))
    .pipe(istanbul.hookRequire());
});

function gulp_test() {
    var timeout;
    var slow;
    var argv = require('minimist')(process.argv.slice(2));

    var tests = [
        'test/**/*.spec.js'
    ];

    // by passing the argument `--sys` you can also run the app tests
    // which require spinning up a browser, by default we do not run
    // the app tests
    if (!argv.sys) {
        tests.push('!test/app/**/*.spec.js');
        tests.push('!test/npm/**/*.spec.js');
        tests.push('!test/examples/**/*.spec.js');
        tests.push('!test/adapters/**/*.spec.js');
        timeout = 20000; // 20s, test timeout
        slow = 15000;    // 15s, slow warning
    } else {
        // downloading and running docker containers can take a bit the first
        // time around
        timeout = 300000; // 5min, test timeout
        slow = 240000;    // 4min, slow warning
    }

    return gulp.src(tests)
    .pipe(mocha({
        log: true,
        timeout: timeout,
        slow: slow,
        reporter: 'spec',
        ui: 'bdd',
        ignoreLeaks: true,
        globals: ['should']
    }));
}

gulp.task('test', function() {
    return gulp_test();
});

gulp.task('test-coverage', ['instrument'], function() {
    var argv = require('minimist')(process.argv.slice(2));
    var thresholds;

    if (argv.sys) {
        thresholds = {
            global: {
                statements: 95,
                branches: 78,
                functions: 97,
                lines: 95
            }
        };
    } else {
        thresholds = {
            global: {
                statements: 96,
                branches: 73,
                functions: 100,
                lines: 96
            }
        };
    }

    return gulp_test()
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({ thresholds: thresholds }));
});

gulp.task('default', ['lint']);
