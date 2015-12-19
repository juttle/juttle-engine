var fs = require('fs-extra');
var path = require('path');
var log4js = require('log4js');

/**
 * make a log directory, just in case it isn't there.
 */
module.exports.init = function() {
    fs.emptyDirSync(path.join(__dirname, '../log'));

    log4js.configure(path.join(__dirname, '../log4js.json'));
}

