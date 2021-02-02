const { spawn, execSync } = require('child_process');
const { join } = require('path');
const { createWriteStream, existsSync, readdirSync, readFileSync } = require('fs');
const { cpus, platform, arch, totalmem } = require('os');
const autocannon = require('autocannon');
// const format = require('autocannon/lib/format');
const prettyBytes = require('pretty-bytes');
const Table = require('cli-table3');
const ProgressBar = require('progress');

let table_style = { border: [] };
if (process.env.OUTPUT) {
	table_style.head = [];
	process.__defineGetter__('stdout', () => createWriteStream(__dirname+'/'+process.env.OUTPUT, { flags: 'w' }));
}

const test = async (f='') => {
	let res = await autocannon({
		url: 'http://localhost:3000/'+f,
		connections: 100,
		pipelining: 10,
		duration: 5
	});
	if (res.non2xx)
		console.log(`${res['2xx']} 2xx responses, ${res.non2xx} non 2xx responses`);
	// console.log(`${format(res.requests.total)} requests in ${res.duration}s, ${prettyBytes(res.throughput.total)} read`);
	return Math.floor(res.requests.total / res.duration);
}
const run = async (s, e, t, p) => {
	let server = spawn('node', [ './servers/'+s, (e || '') ]);
	server.stderr.on('data', data => console.log('stderr: '+data));
	await new Promise(r => server.stdout.on('data', data => {
		if (data.indexOf('server listening on ') > -1)
			r();
	}));
	let res;
	if (t) {
		res = {};
		let plugin = (existsSync('engines/'+e+'/plugin.js') && require('./engines/'+e+'/plugin.js'));
		let progress = new ProgressBar('[:p] :bar: :e: :f_ ', {
			width: 20,
			incomplete: ' ',
			total: t.length+1,
			clear: true
		});
		for (let f of t) {
			let f_ = f.split('.')[0];
			progress.tick({ p, e, f_ });
			res[f_] = await test((plugin && plugin.filename) ? plugin.filename(f) : f);
		}
		if (plugin.clear)
			await plugin.clear();
		progress.tick();
	}else
		res = await test();
	server.kill('SIGINT');
	return res;
}

(async () => {
	let table = new Table({
		style: table_style,
		head: [ 'Nodejs', 'Platform', 'Processor', 'Memory' ]
	});
	table.push([
		process.version,
		platform(),
		(
			cpus()[0].model.replace('unknown', '') || execSync(
				'export LC_ALL=C; lscpu; echo -n "Governor: "; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null; echo; unset LC_ALL'
			).toString().split('\n').filter(line => line.startsWith('Model name:')).map(line => line.split(':')[1].trim()).join()
		).replace(/\s\s/g, '')+' ('+cpus().length+') '+arch(),
		prettyBytes(totalmem())
	]);
	console.log(table.toString());
	console.log('Calculate the average number of requests per second');
	if (!process.argv[2] || (process.argv[2] === '--only-servers')) {
		let table = new Table({
			style: table_style,
			head: [ 'Server', 'Requests' ]
		});
		let servers = readdirSync('./servers/');
		let progress = new ProgressBar('[:p] :bar: :s_ ', {
			width: 20,
			incomplete: ' ',
			total: servers.length+1,
			clear: true
		});
		let steps = servers.length+1;
		for (let s of servers) {
			let s_ = s.slice(0, -3);
			progress.tick({
				p: --steps,
				s_
			});
			table.push([ s_, await run(s) ]);
		}
		progress.tick();
		console.log(table.toString());
	}
	if (!process.argv[2] || (process.argv[2] === '--only-engines')) {
		let engines = ((process.argv[3] || '').replace('?', '') ? process.argv[3].split(',') : readdirSync('./engines/'));
		let json = {};
		let ext = {};
		let steps = engines.length+1;
		for (let e of engines) {
			let templates = ((process.argv[4] || '').replace('?', '') ? process.argv[4].split(',') : readdirSync('./engines/'+e, {
				withFileTypes: true
			}).filter(d => d.isFile()).map(d => d.name).filter(f => (!f.startsWith('_') && !f.endsWith('.js')))).filter(f => existsSync('./engines/'+e+'/'+f));
			json[e] = await run('fastify.js', e, templates, --steps);
			ext[e] = templates[0].endsWith('.html');
		}
		let head = Object.values(json).reduce((arr, cur) => {
			Object.keys(cur).forEach(key => {
				if (!arr.includes(key))
					arr.push(key);
			});
			return arr;
		}, []).sort();
		let table = new Table({
			style: table_style,
			head: [ 'Engine' ].concat(head).concat([ 'Total', 'setExt' ])
		});
		for (let k in json) {
			let arr = head.map(h => json[k][h]);
			table.push([ k ].concat(arr).concat([ arr.reduce((a, b) => ((a || 0) + (b || 0))), ext[k] ]));
		}
		console.log(table.toString());
	}
})();
