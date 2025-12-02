import { Router } from 'express';
import { exportController } from '../controllers/index.js';

const router = Router();

/**
 * ============================================
 * 1C Integration Routes
 * ============================================
 */

/**
 * GET /api/export/1c
 * Экспорт данных контейнеров в формате таблицы 1С
 * 
 * Query params:
 * - format: 'json' | 'csv' (default: 'json')
 * - containerIds: comma-separated list of container IDs (optional)
 * 
 * CSV формат включает колонки:
 * - Номер КТК
 * - Тип КТК
 * - Состояние
 * - Пункт отправления
 * - Пункт назначения
 * - Отгружен в море
 * - На рейде
 * - Прибыл в порт
 * - Размещён на СВХ
 * - Склад закрыт
 * - Отгружен на ЖД
 * - Текущее местоположение
 * - Расстояние до назначения
 * - Ориентировочная дата прибытия
 */
router.get('/1c', (req, res) => exportController.exportFor1C(req, res));

export default router;

