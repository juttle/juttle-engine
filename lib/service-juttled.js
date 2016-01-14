var Base = require('extendable-base');
var _ = require('underscore');
var express = require('express');
var expressWs = require('express-ws');
var bodyParser = require('body-parser');
var jobs = require('./job-handlers');
var paths = require('./path-handlers');
var app_router = require('./app-router');
var prepares = require('./prepare-handlers');
var logger = require('log4js').getLogger('service-juttled');

var read_config = require('juttle/lib/config/read-config');
var Juttle = require('juttle/lib/runtime').Juttle;
var JuttledErrors = require('./errors');

var API_PREFIX = '/api/v0';

var JuttledService = Base.extend({

    initialize: function(options) {
        var config = read_config(options);
        Juttle.adapters.load(config.adapters);
        var self = this;

        self._config_path = options.config_path;
        this._app = express();
        expressWs(this._app);

        this._app.disable('x-powered-by');

        this._root_directory = options.root_directory;
        this._max_saved_messages = 1024;
        this._lingering_job_timeout = 10000;
        if (_.has(config, "juttled")) {
            if (_.has(config.juttled, "max_saved_messages")) {
                this._max_saved_messages = config.juttled.max_saved_messages;
            }

            if (_.has(config.juttled, "lingering_job_timeout")) {
                this._lingering_job_timeout = config.juttled.lingering_job_timeout;
            }
        }

        // add cors headers, allow ALL origins
        this._app.use(function (req, res, next) {

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

            // Pass to next layer of middleware
            next();
        });

        this._app.use(app_router.init());

        this.initRoutes();

        this._server = this._app.listen(options.port, function() {
            logger.info('Juttled service listening at http://localhost:' + options.port + " with root directory:" + self._root_directory);
        });
    },

    initRoutes: function() {

        jobs.init({max_saved_messages: this._max_saved_messages,
                   lingering_job_timeout: this._lingering_job_timeout,
                   config_path: this._config_path});
        paths.init({root_directory: this._root_directory});

        this._app.get(API_PREFIX + '/jobs',
                      jobs.list_all_jobs);
        this._app.get(API_PREFIX + '/jobs/:job_id',
                      jobs.list_job);
        this._app.delete(API_PREFIX + '/jobs/:job_id',
                         jobs.delete_job);
        this._app.post(API_PREFIX + '/jobs',
                      bodyParser.json(), jobs.create_job);
        this._app.ws(API_PREFIX + '/jobs/:job_id',
                    jobs.subscribe_job);
        this._app.ws(API_PREFIX + '/observers/:observer_id',
                    jobs.subscribe_observer);
        this._app.get(API_PREFIX + '/observers/',
                    jobs.list_observers);

        this._app.get(API_PREFIX + '/paths/*',
                     bodyParser.json(), paths.get_path);

        this._app.post(API_PREFIX + '/prepare',
                      bodyParser.json(), prepares.get_inputs);

        this._app.ws('/rendezvous/:topic',
                    paths.rendezvous_topic);

        this._app.use(this.default_error_handler.bind(this));

    },

    default_error_handler: function(err, req, res, next) {

        // Errors from bodyParser.json() might appear here. Transform
        // them into the error formats we expect.
        if (err.message === 'invalid json') {
            err = JuttledErrors.bundleError(err.message, err.body);
        } else if (! JuttledErrors.is_juttled_error(err)) {
            // This error isn't one of the standard errors in
            // JuttledErrors. Wrap the error in an UnknownError.
            err = JuttledErrors.unknownError(err);
        }

        res.status(err.status).send(err);
    },

    stop: function() {
        var self = this;

        self._server.close();
    }

});

module.exports = JuttledService;
