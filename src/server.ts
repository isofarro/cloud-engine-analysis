import restify from 'restify';

const server = restify.createServer({
  name: 'cloud-engine-analysis',
  version: '1.0.0'
});

// Middleware
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

// Hello World endpoint
server.get('/hello', (_req, res, next) => {
  res.send({ message: 'Hello, World!' });
  return next();
});

// Health check endpoint
server.get('/health', (_req, res, next) => {
  res.send({ status: 'OK', timestamp: new Date().toISOString() });
  return next();
});

// Root endpoint
server.get('/', (_req, res, next) => {
  res.send({ 
    message: 'Welcome to Cloud Engine Analysis API',
    endpoints: {
      hello: '/hello',
      health: '/health'
    }
  });
  return next();
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Available endpoints:`);
  console.log(`   GET http://localhost:${PORT}/`);
  console.log(`   GET http://localhost:${PORT}/hello`);
  console.log(`   GET http://localhost:${PORT}/health`);
});

export default server;