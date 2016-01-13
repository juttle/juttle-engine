var _ = require('underscore');
var JobManager = require('./job-manager');
var ObserverManager = require('./observer-manager');
var WebsocketEndpoint = require('./websocket-endpoint');
var logger = require('log4js').getLogger('jobs-handler'); //jshint unused:false
var JuttledErrors = require('./errors');

var job_mgr;
var observer_mgr;

function init(options) {
    job_mgr = new JobManager({max_saved_messages: options.max_saved_messages,
                              config_path: options.config_path});
    observer_mgr = new ObserverManager({job_mgr: job_mgr});
}

function create_job(req, res, next) {
    if (! _.has(req.body.bundle, 'program')) {
        var err = JuttledErrors.bundleError("Bundle does not contain program property", req.body.bundle);
        return res.status(err.status).send(err);
    }
    job_mgr.run_program({bundle: req.body.bundle,
                         inputs: req.body.inputs,
                         observer_id: req.body.observer})
    .then(function(info) {
        // Only include the pid if requested (Used for unit tests)
        if (! req.body.return_pid) {
            info = {job_id: info.job_id};
        }
        res.status(200).send(info);
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
    var job_descs = job_mgr.list_all_jobs();
    res.status(200).send(job_descs);
}

// This handles both GET .../jobs (get all jobs) and GET .../jobs/<id>.
function list_job(req, res, next) {
    var job_desc = job_mgr.list_job(req.params.job_id);
    if (! job_desc) {
        var err = JuttledErrors.jobNotFoundError(req.params.job_id);
        res.status(err.status).send(err);
    } else {
        res.status(200).send(job_desc);
    }
}

function subscribe_job(ws, req) {
    var ep = new WebsocketEndpoint({ws: ws});

    if ( ! job_mgr.add_endpoint_to_job(ep, req.params.job_id)) {
        // Send a message that there's no such job and close the websocket connection
        var err = JuttledErrors.jobNotFoundError(req.params.job_id);
        ep.send({err: err.message});
        ep.close();
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
