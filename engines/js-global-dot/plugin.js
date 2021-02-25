const { readFileSync } = require('fs');

module.exports.opts = {
	engine: {
		dot: require('js-global-dot')
	},
	options: {
		includes: {
			_include: readFileSync(__dirname+'/_include.def.html').toString()
		}
	}
};
module.exports.filename = file => file.split('.')[0];
