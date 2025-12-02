import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { exportContainersFor1C, generateOneCCsv, ContainerWithHistory } from '../exporters/index.js';
import { ApiResponse } from '../types/index.js';

/**
 * ============================================
 * 1C Integration Controller
 * ============================================
 * 
 * Контроллер для экспорта данных в формате, совместимом с 1С.
 */
export class ExportController {
  
  /**
   * GET /api/export/1c
   * Экспорт данных контейнеров в формате таблицы 1С
   * 
   * Query params:
   * - format: 'json' | 'csv' (default: 'json')
   * - containerIds: comma-separated list of container IDs (optional)
   */
  async exportFor1C(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'json', containerIds } = req.query;

      // Фильтр по ID контейнеров (если указан)
      const where = containerIds
        ? { id: { in: (containerIds as string).split(',') } }
        : {};

      // Получаем контейнеры с историей статусов
      const containers = await prisma.container.findMany({
        where,
        include: {
          statusEvents: {
            orderBy: { eventTime: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Преобразуем в формат для экспортера
      const containersWithHistory: ContainerWithHistory[] = containers.map(c => ({
        containerNumber: c.containerNumber,
        containerType: c.containerType,
        originPoint: c.originPoint,
        destinationPoint: c.destinationPoint,
        statusHistory: c.statusEvents.map(e => ({
          statusCode: e.statusCode,
          statusText: e.statusText,
          location: e.location,
          distanceToDestinationKm: e.distanceToDestinationKm,
          eta: e.eta,
          eventTime: e.eventTime,
        })),
      }));

      // Экспортируем в формат 1С
      const rows = exportContainersFor1C(containersWithHistory);

      if (format === 'csv') {
        // Отдаём CSV
        const csv = generateOneCCsv(rows);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="containers_1c.csv"');
        // Добавляем BOM для корректного отображения кириллицы в Excel
        res.send('\uFEFF' + csv);
      } else {
        // Отдаём JSON
        const response: ApiResponse<typeof rows> = {
          success: true,
          data: rows,
          message: `Exported ${rows.length} containers for 1C`,
        };
        res.json(response);
      }
    } catch (error) {
      console.error('Error exporting for 1C:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to export data for 1C',
      };
      res.status(500).json(response);
    }
  }
}

export const exportController = new ExportController();

