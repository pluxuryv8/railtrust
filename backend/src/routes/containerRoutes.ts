import { Router } from 'express';
import { containerController } from '../controllers/index.js';

const router = Router();

/**
 * GET /api/containers
 * Получение списка контейнеров
 * 
 * Query params:
 * - search: поиск по номеру контейнера
 * - statusCode: фильтр по статусу
 * - clientId: фильтр по клиенту
 * - carrierId: фильтр по перевозчику
 * - page: номер страницы (default: 1)
 * - limit: количество на странице (default: 20, max: 100)
 */
router.get('/', (req, res) => containerController.getContainers(req, res));

/**
 * GET /api/containers/:id
 * Получение детальной информации о контейнере
 * 
 * Params:
 * - id: ID контейнера или номер контейнера (MSKU1234567)
 */
router.get('/:id', (req, res) => containerController.getContainerById(req, res));

/**
 * GET /api/containers/:id/notification
 * Генерация текста уведомления для КЛИЕНТА
 * 
 * Это ИСХОДЯЩИЕ данные клиенту, формируемые на основе нормализованных статусов.
 * Пример:
 *   "Илья, доброе утро.
 *    Текущее местоположение КТК ст Гончарово, 1857 км до станции Иня-Восточная."
 * 
 * Query params:
 * - format: 'short' | 'full' (default: 'full')
 */
router.get('/:id/notification', (req, res) => containerController.getContainerNotification(req, res));

export default router;
