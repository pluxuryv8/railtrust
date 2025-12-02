import { Request, Response } from 'express';
import { statusEventService } from '../services/index.js';
import { ApiResponse, StatusEventItem } from '../types/index.js';

/**
 * Контроллер для работы со статусами контейнеров
 */
export class StatusEventController {
  
  /**
   * GET /api/status-events
   * Получение истории статусов контейнера
   */
  async getStatusHistory(req: Request, res: Response): Promise<void> {
    try {
      const { container_id } = req.query;

      if (!container_id || typeof container_id !== 'string') {
        const response: ApiResponse<null> = {
          success: false,
          error: 'container_id query parameter is required',
        };
        res.status(400).json(response);
        return;
      }

      const statusHistory = await statusEventService.getStatusHistory(container_id);

      const response: ApiResponse<StatusEventItem[]> = {
        success: true,
        data: statusHistory,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching status history:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch status history',
      };
      res.status(500).json(response);
    }
  }
}

export const statusEventController = new StatusEventController();

