import { Request, Response } from 'express';
import { StatusCode } from '@prisma/client';
import { containerService } from '../services/index.js';
import { generateClientNotification } from '../generators/index.js';
import { ApiResponse, PaginatedResponse, ContainerListItem, ContainerDetails } from '../types/index.js';

/**
 * Контроллер для работы с контейнерами
 */
export class ContainerController {
  
  /**
   * GET /api/containers
   * Получение списка контейнеров с фильтрацией и пагинацией
   */
  async getContainers(req: Request, res: Response): Promise<void> {
    try {
      const { 
        search, 
        statusCode, 
        clientId, 
        carrierId, 
        page = '1', 
        limit = '20' 
      } = req.query;

      const result = await containerService.getContainers({
        search: search as string | undefined,
        statusCode: statusCode as StatusCode | undefined,
        clientId: clientId as string | undefined,
        carrierId: carrierId as string | undefined,
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 100), // Max 100 per page
      });

      const response: PaginatedResponse<ContainerListItem> = {
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching containers:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch containers',
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/containers/:id
   * Получение детальной информации о контейнере
   */
  async getContainerById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Проверяем, это ID или номер контейнера
      let container: ContainerDetails | null;
      
      // Если похоже на номер контейнера (буквы + цифры)
      if (/^[A-Za-z]{4}\d{6,7}$/.test(id.replace(/\s/g, ''))) {
        container = await containerService.getContainerByNumber(id);
      } else {
        container = await containerService.getContainerById(id);
      }

      if (!container) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Container not found',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<ContainerDetails> = {
        success: true,
        data: container,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching container:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to fetch container',
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/containers/:id/notification
   * Генерация текста уведомления для КЛИЕНТА
   * 
   * Это исходящие данные клиенту, формируемые на основе нормализованных статусов.
   * Пример:
   *   "Илья, доброе утро.
   *    Текущее местоположение КТК ст Гончарово, 1857 км до станции Иня-Восточная."
   */
  async getContainerNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { format = 'full' } = req.query;

      // Получаем контейнер
      let container: ContainerDetails | null;
      
      if (/^[A-Za-z]{4}\d{6,7}$/.test(id.replace(/\s/g, ''))) {
        container = await containerService.getContainerByNumber(id);
      } else {
        container = await containerService.getContainerById(id);
      }

      if (!container) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Container not found',
        };
        res.status(404).json(response);
        return;
      }

      // Генерируем уведомление
      const notification = generateClientNotification(
        {
          containerNumber: container.containerNumber,
          containerType: container.containerType,
          originPoint: container.originPoint,
          destinationPoint: container.destinationPoint,
          totalDistanceKm: container.totalDistanceKm,
          clientName: container.clientName,
          clientContactPerson: null, // TODO: получить из Client
          lastStatus: container.lastStatus ? {
            statusCode: container.lastStatus.statusCode,
            statusText: container.lastStatus.statusText,
            location: container.lastStatus.location,
            distanceToDestinationKm: container.statusHistory[0]?.distanceToDestinationKm,
            eta: container.lastStatus.eta ? new Date(container.lastStatus.eta) : null,
            eventTime: new Date(container.lastStatus.eventTime),
          } : null,
        },
        {
          format: format === 'short' ? 'short' : 'full',
        }
      );

      const response: ApiResponse<{ notification: string; containerNumber: string }> = {
        success: true,
        data: {
          containerNumber: container.containerNumber,
          notification,
        },
        message: 'Notification generated successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error generating notification:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to generate notification',
      };
      res.status(500).json(response);
    }
  }
}

export const containerController = new ContainerController();
