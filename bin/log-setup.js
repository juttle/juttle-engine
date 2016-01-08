var fs = require('fs-extra');
var path = require('path');
var log4js = require('log4js');

module.exports.init = function(opts) {
    if (opts.l) {
        log4js.configure(opts.l);
    } else {
        var log4js_opts;

        if (opts.d) {
            var logfile = '/var/log/outriggerd.log';
            if (opts.o) {
                logfile = opts.o;
            }

            // Throw an error if we can't log to the configured log
            // file.
            fs.accessSync(logfile, fs.R_OK | fs.W_OK);

            log4js_opts = {
                appenders: [
                    {type: 'file', filename: logfile}
                ]
            };
        } else {
            log4js_opts = {
                appenders: [
                    {type: 'console'}
                ]
            };
        }
        log4js.configure(log4js_opts);
    }
}

