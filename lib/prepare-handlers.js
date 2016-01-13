var _ = require('underscore');
var logger = require('log4js').getLogger('prepare-handlers');

var read_config = require('juttle/lib/config/read-config');
var config = read_config();
var compiler = require('juttle/lib/compiler');
var optimize = require('juttle/lib/compiler/optimize');
var implicit_views = require('juttle/lib/compiler/flowgraph/implicit_views');
var JuttledErrors = require('./errors');
var JuttleErrors = require('juttle/lib/errors');

var JSDP = require('juttle-jsdp');
var JSDPValueConverter = require('./jsdp-value-converter');

function get_inputs(req, res, next) {

    logger.debug("Calling get_inputs with inputs:", req.body.inputs);

    var compile_options = {
        stage: "flowgraph",
        fg_processors: [implicit_views(config.implicit_sink || 'table'), optimize],
        inputs: JSDPValueConverter.convertToJuttleValue(JSDP.deserialize(req.body.inputs || {})),
        modules: req.body.bundle.modules
    };

    compiler.compile(req.body.bundle.program, compile_options)
    .then(function(graph) {
        var input_desc = _.map(graph.built_graph.inputs, function(input) {
            return {
                type: input.name,
                id: input.id,
                static: input.static,
                value: input.value,
                options: input.options
            };
        });

        res.status(200).send(JSDP.serialize(JSDPValueConverter.convertToJSDPValue(input_desc)));
    })
    .catch(function(err) {
        if (err instanceof JuttleErrors.SyntaxError ||
            err instanceof JuttleErrors.CompileError ||
            err instanceof JuttleErrors.RuntimeError) {
            // In this case, we return the program and modules along
            // with the error so the client can display the error in
            // context.
            var err_with_context = JuttledErrors.juttleError(err, req.body.bundle);
            res.status(err_with_context.status).send(err_with_context);
        } else {
            // Pass along the error so it will be picked up by
            // default_error_handler.
            next(err);
        }
    });
}

module.exports = {
    get_inputs: get_inputs
};
