import buildFastify from './app'
import config from './config'

const start = async () => {
  try {
    const fastify = await buildFastify()
    console.info(`API exposed at http://${config.HOST}:${config.PORT}/`)
    await fastify.listen({ port: config.PORT as number, host: config.HOST })
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

start()
