import fastify from 'fastify'

const app = fastify()

app.get('/health', async (_req, _reply) => {
  return { status: 'ok' }
})

app.listen({ port: 3000 }, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log('Server running on port 3000')
})

export { app }
