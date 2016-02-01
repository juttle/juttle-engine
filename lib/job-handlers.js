var _ = require('underscore');
var JobManager = require('./job-manager');
var ObserverManager = require('./observer-manager');
var WebsocketEndpoint = require('./websocket-endpoint');
var logger = require('log4js').getLogger('jobs-handler'); // eslint-disable-line
var JuttledErrors = require('./errors');
var JuttleBundler = require('./bundler');

var JSDP = require('juttle-jsdp');
var JSDPValueConverter = require('./jsdp-value-converter');

var job_mgr;
var observer_mgr;
var root_dir;

function init(options) {
    job_mgr = new JobManager({max_saved_messages: options.max_saved_messages,
                              delayed_job_cleanup: options.delayed_job_cleanup,
                              config_path: options.config_path});
    observer_mgr = new ObserverManager({job_mgr: job_mgr});

    root_dir = options.root_directory;
}

function create_job(req, res, next) {

    var bundle_promise;

    if (_.has(req.body, 'path')) {
        logger.debug('running-from-path', req.body.path);
        var bundler = new JuttleBundler({root_dir: root_dir});
        bundle_promise = bundler.bundle(req.body.path);
    } else {
        if (! _.has(req.body.bundle, 'program')) {
            var err = JuttledErrors.bundleError('Bundle does not contain program property', req.body.bundle);
            return res.status(err.status).send(err);
        }
        bundle_promise = Promise.resolve({bundle: req.body.bundle});
    }

    return bundle_promise
    .then(function(res) {
        return job_mgr.run_program({bundle: res.bundle,
                                    inputs: JSDPValueConverter.convertToJuttleValue(JSDP.deserialize(req.body.inputs || {})),
                                    observer_id: req.body.observer,
                                    wait: req.body.wait,
                                    timeout: req.body.timeout});
    })
    .then(function(results) {
        // Only include the pid if requested (Used for unit tests)
        if (! req.body.return_pid) {
            results = _.omit(results, 'pid');
        }
        res.status(200).send(results);
    }).catch(Promise.TimeoutError, function(e) {

        // The program timed out. Still send the job manager a stop
        // for the job so the subprocess will be cleaned up.  The
        // error message is "<job-id> timed out", so we can get the
        // job id from the message.

        var job_id = e.message.split(' ')[0];
        job_mgr.delete_job(job_id);

        var err = JuttledErrors.timeoutError(req.body.timeout);
        res.status(err.status).send(err);
    }).catch(next);
}

function delete_job(req, res, next) {
    if (job_mgr.delete_job(req.params.job_id)) {
        res.status(200).send({});
    } else {
        var err = JuttledErrors.jobNotFoundError(req.params.job_id);
        res.status(err.status).send(err);
    }
}

function list_all_jobs(req, res, next) {
    var job_descs = _.map(job_mgr.get_all_jobs(), function(job) {
        return job.describe();
    });

    res.status(200).send(job_descs);
}

// This handles both GET .../jobs (get all jobs) and GET .../jobs/<id>.
function list_job(req, res, next) {
    var job = job_mgr.get_job(req.params.job_id);
    if (! job) {
        var err = JuttledErrors.jobNotFoundError(req.params.job_id);
        res.status(err.status).send(err);
    } else {
        res.status(200).send(job.describe());
    }
}

function subscribe_job(ws, req) {
    var ep = new WebsocketEndpoint({ws: ws});

    var job = job_mgr.get_job(req.params.job_id);

    if (! job) {
        // Send a message that there's no such job and close the websocket connection
        var err = JuttledErrors.jobNotFoundError(req.params.job_id);
        ep.send({err: err.message});
        ep.close();
    } else {
        job.add_endpoint(ep);
    }
}

function subscribe_observer(ws, req) {
    var ep = new WebsocketEndpoint({ws: ws});
    observer_mgr.add_endpoint_to_observer(ep, req.params.observer_id);
}

function list_observers(req, res, next) {
    var observer_descs = observer_mgr.list_observers();
    res.status(200).send(observer_descs);
}

module.exports = {
    init: init,
    create_job: create_job,
    delete_job: delete_job,
    list_job: list_job,
    list_all_jobs: list_all_jobs,
    subscribe_job: subscribe_job,
    subscribe_observer: subscribe_observer,
    list_observers: list_observers
};
