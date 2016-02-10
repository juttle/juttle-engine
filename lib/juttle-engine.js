'use strict';
var _ = require('underscore');
var express = require('express');
var service = require('juttle-service').service;
var logSetup = require('juttle-service').logSetup;
var getLogger = require('juttle-service').getLogger;
var viewer = require('juttle-viewer');
var daemonize = require('daemon');

var app, server;

function run(opts, ready) {
    logSetup(_.defaults(opts, {'log-default-output': '/var/log/juttle-engine.log'}));
    var logger = getLogger('juttle-engine')

    if (opts.daemonize) {
        daemonize();
    }

    logger.debug('initializing');

    var service_opts = {
        root_directory: opts.root,
        config_path: opts.config
    };

    service.configure(service_opts);

    app = express();
    app.disable('x-powered-by');

    service.addRoutes(app, service_opts);

    app.use(viewer({juttleServiceHost: opts.host + ':' + opts.port}));

    server = app.listen(opts.port, opts.host, () => {
        logger.info('Juttle engine listening at http://' + opts.host + ':' + opts.port
                    + ' with root directory: ' + opts.root);
        ready && ready();
    });
}

function stop() {
    server.close();
}

module.exports = {
    run,
    stop
}
