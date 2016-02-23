'use strict';
let _ = require('underscore');

let messages = require('./strings/juttle-engine-error-strings-en-US.json');

class BaseError extends Error {
    constructor(code, info) {
        super();

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        this.code = code;
        this.info = info;

        let template = _.template(messages[this.code], {
            interpolate: /\{\{[^#\{]([\s\S]+?)[^\}]\}\}/g,
            evaluate: /\{\{\#([\s\S]+?)\}\}/g,
            variable: 'info'
        });

        this.message = template(info);
    }
}

class TopicMsgError extends BaseError {
    constructor(info) {
        super('JE-INVALID-TOPIC-MSG', info);
    }
}

let errors = {};

errors.topicMsgError = function(data) {
    return new TopicMsgError({
        missing_keys: _.difference(['bundle_id', 'bundle', 'type'], _.keys(data)).join(', ')
    });
}

module.exports = errors;
