import fastify from 'fastify'

const app = fastify()

app.get('/health', async () => {
  return { status: 'ok' }
})

app.listen({ port: 3000 }, () => {
  console.log('Server running on port 3000')
})

export { app }
