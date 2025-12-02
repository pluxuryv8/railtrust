import { Router } from 'express';
import containerRoutes from './containerRoutes.js';
import rawDataRoutes from './rawDataRoutes.js';
import statusEventRoutes from './statusEventRoutes.js';
import exportRoutes from './exportRoutes.js';
import ingestRoutes from './ingestRoutes.js';

const router = Router();

// API routes
router.use('/containers', containerRoutes);
router.use('/raw', rawDataRoutes);              // Legacy endpoints
router.use('/ingest', ingestRoutes);            // NEW: Универсальный приём данных
router.use('/status-events', statusEventRoutes);
router.use('/export', exportRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'smartsync-backend',
  });
});

export default router;
