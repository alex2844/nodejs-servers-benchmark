const { rmdirSync, unlinkSync, existsSync, mkdirSync } = require('fs');
const { sync } = require('glob');
const { join } = require('path');
const outputDir = join(__dirname, 'static');

module.exports.clear = () => {
	return new Promise(res => {
		rmdirSync(outputDir, { recursive: true });
		rmdirSync(join(__dirname, '../../.cache'), { recursive: true });
		const files = sync(__dirname+'/**/*.marko.js');
		for (let file of files) {
			unlinkSync(file);
		}
		return res();
	});
}
module.exports.plugin = (fastify, opts) => {
	try {
		require('lasso-marko/package.json');
	} catch (e) {
		throw new Error('npm install lasso-marko');
	}
	try {
		require('@lasso/marko-taglib/package.json');
	} catch (e) {
		throw new Error('npm install @lasso/marko-taglib');
	}
	if (!existsSync(outputDir))
		mkdirSync(outputDir);
	require('lasso').configure({
		plugins: [ 'lasso-marko' ],
		outputDir
	});
	return fastify.register(require('fastify-static'), {
		root: outputDir,
		prefix: '/static'
	});
};
