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
        'test/**/*.spec.js'
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
    var tests = [
        'test/**/*.spec.js'
    ];

    return gulp.src(tests)
    .pipe(mocha({
        log: true,
        timeout: 60000,
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
    return gulp_test()
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({
        thresholds: {
            global: {
                statements: 95,
                branches: 70,
                functions: 100,
                lines: 95
            }
        }
    }));
});

gulp.task('default', ['lint']);
