import { Router } from 'express';
import { statusEventController } from '../controllers/index.js';

const router = Router();

/**
 * GET /api/status-events
 * Получение истории статусов контейнера
 * 
 * Query params:
 * - container_id: ID контейнера (обязательный)
 */
router.get('/', (req, res) => statusEventController.getStatusHistory(req, res));

export default router;

