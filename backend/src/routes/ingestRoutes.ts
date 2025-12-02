import { Router } from 'express';
import {
  ingestUniversal,
  ingestText,
  ingestJson,
  ingestCsv,
  ingestBatch,
  getProcessingLogs,
  getProcessingStats,
  testParsing,
  resetDatabase,
  seedDemoData,
} from '../controllers/ingestController.js';

const router = Router();

/**
 * ============================================
 * INGEST ROUTES - Маршруты приёма данных
 * ============================================
 * 
 * Все endpoints для загрузки данных в систему:
 * 
 * POST /api/ingest         - Универсальный приём (автодетект формата)
 * POST /api/ingest/text    - Текстовые данные (email, сообщения)
 * POST /api/ingest/json    - Структурированный JSON
 * POST /api/ingest/csv     - CSV данные
 * POST /api/ingest/batch   - Пакетная загрузка
 * POST /api/ingest/test    - Тестовый парсинг (без сохранения)
 * 
 * GET /api/ingest/logs     - Логи обработки
 * GET /api/ingest/stats    - Статистика обработки
 * 
 * POST /api/ingest/reset   - Сброс базы данных
 * POST /api/ingest/seed    - Заполнить тестовыми данными
 */

// === ОСНОВНЫЕ ENDPOINTS ЗАГРУЗКИ ===

// Универсальный приём с автоопределением формата
router.post('/', ingestUniversal);

// Специализированные endpoints
router.post('/text', ingestText);
router.post('/json', ingestJson);
router.post('/csv', ingestCsv);
router.post('/batch', ingestBatch);

// Тестовый парсинг без сохранения
router.post('/test', testParsing);

// === МОНИТОРИНГ И ЛОГИРОВАНИЕ ===

// Логи обработки
router.get('/logs', getProcessingLogs);

// Статистика
router.get('/stats', getProcessingStats);

// === УПРАВЛЕНИЕ ДАННЫМИ ===

// Сброс базы данных
router.post('/reset', resetDatabase);

// Заполнить тестовыми данными
router.post('/seed', seedDemoData);

export default router;

