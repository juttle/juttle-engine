var _ = require('underscore');
var fs = require('fs-extra');
var log4js = require('log4js');

module.exports.init = function(opts) {
    if (opts['log-config']) {
        log4js.configure(opts['log-config']);
    } else {
        var log4js_opts = {
            'levels': {
                '[all]': opts['log-level']
            }
        };

        // If daemonizing and if no output file was specified, use a
        // default.
        if (opts.daemonize && !_.has(opts, 'output')) {
            opts.output = '/var/log/juttle-engine.log';
        }

        if (_.has(opts, 'output')) {

            try {
                fs.statSync(opts.output);
            } catch (err) {
                // Try to create it if it doesn't exist. If this
                // doesn't work, the following accessSync will not
                // work.
                fs.createWriteStream(opts.output);
            }

            fs.accessSync(opts.output, fs.R_OK | fs.W_OK);

            log4js_opts.appenders = [
                {type: 'file', filename: opts.output}
            ];

        } else {
            log4js_opts.appenders = [
                    {type: 'console'}
            ];
        }
        log4js.configure(log4js_opts);
    }
}

