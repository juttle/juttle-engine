// This file defines error classes related to the JuttledService's REST api.

var Base = require('extendable-base');
var messages = require('./strings/juttled-error-strings-en-US').error;
var _ = require('underscore');

// Similar to version in juttle/lib/errors.js.


var BaseError = Base.inherits(Error, {

    template: function(info) {
        var template = _.template(messages[this.code], {
            interpolate: /\{\{([^}]*)\}\}/g,
            variable: 'info'
        });

        return template(info);
    },

    initialize: function(info) {
        Error.call(this, this.message);

        // not present on IE
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // Template the message given the info object
        this.message = this.template(info);

        // copy the code from the prototype to the instance so it will
        // be serialized.
        this.code = this.code;

        this.info = info;
    }
});

var errors = {};

// An error that can not be identified. Ideally, this error should
// never be thrown. It is only used as a catchall in cases where a
// more specific error can not be found.
errors.UnknownError = BaseError.extend({
    name: 'UnknownError',
    code: 'JS-UNKNOWN-ERROR',
    status: 500
});


// All errors from the juttle compiler and runtime are grouped as this
// error. The info.err field contains the complete error object from
// the Juttle compiler or runtime, and the info.bundle field should
// contain a program bundle containing the program and modules that
// resulted in the error.

errors.JuttleError = BaseError.extend({
    name: 'JuttleError',
    code: 'JS-JUTTLE-ERROR',
    status: 400
});

errors.BundleError = BaseError.extend({
    name: 'BundleError',
    code: 'JS-BUNDLE-ERROR',
    status: 400
});

errors.JobNotFoundError = BaseError.extend({
    name: 'JobNotFoundError',
    code: 'JS-JOB-NOT-FOUND-ERROR',
    status: 404
});

errors.FileNotFoundError = BaseError.extend({
    name: 'FileNotFoundError',
    code: 'JS-FILE-NOT-FOUND-ERROR',
    status: 404
});

errors.FileAccessError = BaseError.extend({
    name: 'FileAccessError',
    code: 'JS-FILE-ACCESS-ERROR',
    status: 403
});

errors.DirectoryNotFoundError = BaseError.extend({
    name: 'DirectoryNotFoundError',
    code: 'JS-DIR-NOT-FOUND-ERROR',
    status: 404
});

errors.DirectoryAccessError = BaseError.extend({
    name: 'DirectoryAccessError',
    code: 'JS-DIR-ACCESS-ERROR',
    status: 403
});

errors.InvalidPathError = BaseError.extend({
    name: 'InvalidPathError',
    code: 'JS-INVALID-PATH-ERROR',
    status: 400
})

errors.TimeoutError = BaseError.extend({
    name: 'TimeoutError',
    code: 'JS-TIMEOUT-ERROR',
    status: 408
})

errors.unknownError = function(err) {
    return new errors.UnknownError({err: err});
};

errors.juttleError = function(err, bundle) {
    return new errors.JuttleError({err: err, bundle: bundle});
};

errors.bundleError = function(reason, bundle) {
    return new errors.BundleError({reason: reason, bundle: bundle});
};

errors.jobNotFoundError = function(job_id) {
    return new errors.JobNotFoundError({job_id: job_id});
};

errors.fileNotFoundError = function(path) {
    return new errors.FileNotFoundError({path: path});
};

errors.fileAccessError = function(path) {
    return new errors.FileAccessError({path: path});
};

errors.directoryNotFoundError = function(path) {
    return new errors.DirectoryNotFoundError({path: path});
}

errors.directoryAccessError = function(path) {
    return new errors.DirectoryAccessError({path: path});
}

errors.invalidPathError = function(path) {
    return new errors.InvalidPathError({path: path});
}

errors.timeoutError = function(timeout) {
    return new errors.TimeoutError({timeout: timeout});
}

errors.is_juttled_error = function(err) {
    return (err instanceof errors.UnknownError ||
            err instanceof errors.JuttleError ||
            err instanceof errors.BundleError ||
            err instanceof errors.JobNotFoundError ||
            err instanceof errors.FileNotFoundError ||
            err instanceof errors.FileAccessError ||
            err instanceof errors.DirectoryNotFoundError ||
            err instanceof errors.DirectoryAccessError ||
            err instanceof errors.InvalidPathError ||
            err instanceof errors.TimeoutError);
};

module.exports = errors;
