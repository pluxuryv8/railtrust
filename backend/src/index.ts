import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isDev } from './config/index.js';
import routes from './routes/index.js';
import prisma from './utils/prisma.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SmartSync Adaptive API',
    version: '1.0.0',
    description: 'Container tracking and status normalization service for Rail Trust',
    endpoints: {
      health: '/api/health',
      containers: '/api/containers',
      containerDetails: '/api/containers/:id',
      containerNotification: '/api/containers/:id/notification',
      statusEvents: '/api/status-events',
      rawOperatorEmail: '/api/raw/operator-email',
      rawTableRow: '/api/raw/table-row',
      rawTableRows: '/api/raw/table-rows',
      export1C: '/api/export/1c',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: isDev ? err.message : 'Something went wrong',
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
const start = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✓ Database connected');

    app.listen(config.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║              SmartSync Adaptive API Server                   ║
║                     Rail Trust                               ║
╠══════════════════════════════════════════════════════════════╣
║  Status:     Running                                         ║
║  Port:       ${config.port.toString().padEnd(47)}║
║  Env:        ${config.nodeEnv.padEnd(47)}║
║  CORS:       ${config.corsOrigin.padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝

API Endpoints:
  Containers:
    GET  /api/containers             - List containers
    GET  /api/containers/:id         - Container details
    GET  /api/containers/:id/notification - Generate client notification

  Status Events:
    GET  /api/status-events          - Status history

  Raw Data (from operators):
    POST /api/raw/operator-email     - Process operator email
    POST /api/raw/table-row          - Process table row
    POST /api/raw/table-rows         - Process table rows (batch)

  1C Integration:
    GET  /api/export/1c              - Export for 1C (JSON/CSV)

  Health:
    GET  /api/health                 - Health check
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
