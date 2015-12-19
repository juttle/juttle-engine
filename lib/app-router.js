var fs = require('fs');
var path = require('path');
var express = require('express');

var DIST_DIR = 'dist';

module.exports.init = function() {
    var router = express.Router();
    var devMode;

    try {
        var distDir = fs.statSync(path.resolve(DIST_DIR));
        devMode = !distDir.isDirectory();
    }
    catch(err) {
        devMode = true;
    }

    if (devMode) {
        var webpack = require('webpack');
        var webpackDevMiddleware = require('webpack-dev-middleware');
        var webpackConfig = require('../webpack.config');
        var assetPath = webpackConfig.output.publicPath;

        var compiler = webpack(webpackConfig);
        router.use(webpackDevMiddleware(compiler, {
            noInfo: true,
            publicPath: assetPath
        }));
    } else {
        // serve static assets from dist
        router.use('/assets', express.static(path.join(__dirname, '..', 'dist')));
    }

    router.get('/run', function(req, res) {
        res.sendFile(path.join(__dirname, '../src/apps/run/index.html'));
    });
    return router;
};
