'use strict';
var _ = require('underscore');
var Promise = require('bluebird');
var express = require('express');
var JuttleService = require('juttle-service');
var service = JuttleService.service;
var logSetup = require('juttle-service').logSetup;
var getLogger = require('juttle-service').getLogger;
var WebsocketEndpoint = require('juttle-service').WebsocketEndpoint;
var viewer = require('juttle-viewer');
var daemonize = require('daemon');
var BundleNotifier = require('./bundle-notifier');

var app, server;

const JUTTLE_ENGINE_VERSION = require('../package.json').version;
JuttleService.version.addComponent('juttle-engine', JUTTLE_ENGINE_VERSION);

function run(opts, ready) {
    // If no port was provided on the command line, use a default port
    // of 8080.
    if (! _.has(opts, 'port')) {
        opts.port = 8080;
    }

    let config = service.configure(opts);

    logSetup(config);
    var logger = getLogger('juttle-engine');
    var bundle_notifier = new BundleNotifier();

    logger.debug('service configuration', config);

    if (config.daemonize) {
        daemonize();
    }

    app = express();
    app.disable('x-powered-by');

    service.addRoutes(app, config, opts['config']);

    let viewerOpts = {
        indexPath: opts['index-path']
    };
    if (config.host) {
        viewerOpts.juttleServiceHost = config.host + ':' + config.port;
    }
    logger.debug('configuring juttle-viewer with', viewerOpts);
    app.use(viewer(viewerOpts));

    // Also add routes for rendezvous.
    app.ws('/rendezvous/:topic', (ws, req) => {
        var ep = new WebsocketEndpoint({ws: ws});
        bundle_notifier.add_endpoint_to_topic(ep, req.params.topic);
    });

    var listenAddr = config.host || '0.0.0.0';
    server = app.listen(config.port, listenAddr, () => {
        logger.info('Juttle engine listening at http://' + listenAddr + ':' + config.port
                    + ' with root directory: ' + config.root);
        ready && ready();
    });
}

function stop() {
    return new Promise((resolve, reject) => {
        server.close(resolve);
    });
}

module.exports = {
    run,
    stop
}
