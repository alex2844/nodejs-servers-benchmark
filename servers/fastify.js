'use strict'

process.env.NODE_ENV = 'production'

const fastify = require('fastify')({
	// logger: { prettyPrint: true }
})

let opts = { engine: {} }
if (!process.argv[2])
  opts.engine.ejs = require('ejs')
else{
  opts.templates = 'engines/'+process.argv[2]
  const plugin = (require('fs').existsSync('engines/'+process.argv[2]+'/plugin.js') && require('../'+opts.templates+'/plugin.js'))
  if (plugin.opts)
	opts = Object.assign(opts, plugin.opts)
  if (!opts.engine[process.argv[2]])
    opts.engine[process.argv[2]] = require(process.argv[2])
  if (plugin.plugin)
    fastify.register(plugin.plugin)
}

// fastify.register(require('point-of-view'), opts)
fastify.register(require('../pov.js'), opts)

if (!process.argv[2])
  fastify.get('/', (req, reply) => {
    reply.view('./template.ejs', { text: 'text' })
  })
else{
  const data = require('../data.js');
  fastify.get('/:file', (req, reply) => {
    reply.view(req.params.file, data)
  })
}

fastify.listen(3000, err => {
  if (err) throw err
  console.log(`server listening on ${fastify.server.address().port}`)
})
