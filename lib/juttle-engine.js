'use strict';
var _ = require('underscore');
var express = require('express');
var service = require('juttle-service').service;
var logSetup = require('juttle-service').logSetup;
var getLogger = require('juttle-service').getLogger;
var WebsocketEndpoint = require('juttle-service').WebsocketEndpoint;
var viewer = require('juttle-viewer');
var daemonize = require('daemon');
var EndpointNotifier = require('./endpoint-notifier');

var app, server;

function run(opts, ready) {
    logSetup(_.defaults(opts, {'log-default-output': '/var/log/juttle-engine.log'}));
    var logger = getLogger('juttle-engine')
    var endpoint_notifier = new EndpointNotifier();

    if (opts.daemonize) {
        daemonize();
    }

    logger.debug('initializing with options', opts);

    var service_opts = {
        root_directory: opts.root,
        config_path: opts.config
    };

    service.configure(service_opts);

    app = express();
    app.disable('x-powered-by');

    service.addRoutes(app, service_opts);

    let viewerOpts = {};
    if (opts.host) {
        viewerOpts.juttleServiceHost = opts.host + ':' + opts.port;
    }
    logger.debug('configuring juttle-viewer with', viewerOpts);
    app.use(viewer(viewerOpts));

    // Also add routes for rendezvous.
    app.ws('/rendezvous/:topic', (ws, req) => {
        var ep = new WebsocketEndpoint({ws: ws});
        endpoint_notifier.add_endpoint_to_topic(ep, req.params.topic);
    });

    var listenAddr = opts.host || '0.0.0.0';
    server = app.listen(opts.port, listenAddr, () => {
        logger.info('Juttle engine listening at http://' + listenAddr + ':' + opts.port
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
