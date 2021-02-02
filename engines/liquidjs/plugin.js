const { Liquid } = require('liquidjs');

module.exports.opts = {
	engine: {
		liquid: new Liquid()
	}
};
