import { Router } from 'express';
import { rawDataController } from '../controllers/index.js';

const router = Router();

/**
 * POST /api/raw/operator-email
 * Приём email-сообщения ОТ ОПЕРАТОРА (перевозчика) для парсинга
 * 
 * Это ВХОДЯЩИЕ данные от перевозчиков, а не исходящие клиенту.
 * Пример входного текста от оператора:
 *   "Контейнер MSKU1234567 прибыл на станцию Гончарово.
 *    Расстояние до ст. Иня-Восточная: 1857 км.
 *    ETA: 04.12.2025"
 * 
 * Body:
 * {
 *   "body": "Текст письма от оператора...",
 *   "subject": "Тема письма (опционально)",
 *   "senderEmail": "operator@carrier.com (опционально)",
 *   "receivedAt": "2025-01-01T00:00:00Z (опционально)"
 * }
 */
router.post('/operator-email', (req, res) => rawDataController.processOperatorEmail(req, res));

/**
 * POST /api/raw/table-row
 * Приём строки таблицы (из выгрузки оператора: Excel/1С)
 * 
 * Body:
 * {
 *   "containerNumber": "MSKU1234567",
 *   "containerType": "20/24",
 *   "state": "Отгружен / в пути по ЖД",
 *   "from": "SHANGHAI, CHINA",
 *   "to": "Москва",
 *   "shippedToSea": "18.10.2025",
 *   "arrivedPort": "04.12.2025",
 *   "currentLocation": "ст. Гончарово",
 *   "distanceToDestination": "1857",
 *   "eta": "04.12.2025"
 * }
 */
router.post('/table-row', (req, res) => rawDataController.processTableRow(req, res));

/**
 * POST /api/raw/table-rows
 * Пакетный приём строк таблицы (до 100 строк)
 * 
 * Body:
 * {
 *   "rows": [
 *     { "containerNumber": "MSKU1234567", ... },
 *     { "containerNumber": "TCKU7654321", ... }
 *   ]
 * }
 */
router.post('/table-rows', (req, res) => rawDataController.processTableRows(req, res));

export default router;
