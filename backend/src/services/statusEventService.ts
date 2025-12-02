import { StatusCode, SourceType } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { normalizerService } from '../normalizers/index.js';
import { containerService } from './containerService.js';
import { 
  NormalizedStatusEvent, 
  EmailInput, 
  TableRowInput,
  StatusEventItem 
} from '../types/index.js';

/**
 * Сервис для работы со статусами контейнеров
 */
export class StatusEventService {
  
  /**
   * Получение истории статусов контейнера
   */
  async getStatusHistory(containerId: string): Promise<StatusEventItem[]> {
    const events = await prisma.statusEvent.findMany({
      where: { containerId },
      orderBy: { eventTime: 'desc' },
    });

    return events.map(event => ({
      id: event.id,
      statusCode: event.statusCode,
      statusText: event.statusText,
      location: event.location,
      distanceToDestinationKm: event.distanceToDestinationKm,
      eta: event.eta,
      eventTime: event.eventTime,
      sourceType: event.sourceType,
      sourceRaw: event.sourceRaw,
      createdAt: event.createdAt,
    }));
  }

  /**
   * Обработка входящего email-сообщения ОТ ОПЕРАТОРА
   * 
   * Это ВХОДЯЩИЕ данные от перевозчика/оператора, а не исходящие клиенту.
   * Пример:
   *   "Контейнер MSKU1234567 на станции Гончарово, 1857 км до Иня-Восточная"
   */
  async processOperatorEmail(input: EmailInput): Promise<{
    success: boolean;
    data?: NormalizedStatusEvent;
    error?: string;
    rawMessageId?: string;
  }> {
    // Сохраняем сырое сообщение от оператора
    const rawMessage = await prisma.rawMessage.create({
      data: {
        sourceType: SourceType.EMAIL,
        content: input.body,
        senderEmail: input.senderEmail,
        subject: input.subject,
      },
    });

    try {
      // Нормализуем данные
      const result = normalizerService.normalizeEmail(input);
      
      if (!result.success || !result.data) {
        await prisma.rawMessage.update({
          where: { id: rawMessage.id },
          data: {
            processed: true,
            processedAt: new Date(),
            errorMessage: result.error || 'Normalization failed',
          },
        });

        return {
          success: false,
          error: result.error || 'Failed to normalize operator email data',
          rawMessageId: rawMessage.id,
        };
      }

      const normalizedData = result.data;

      // Если номер контейнера не найден - ошибка
      if (!normalizedData.containerNumber) {
        await prisma.rawMessage.update({
          where: { id: rawMessage.id },
          data: {
            processed: true,
            processedAt: new Date(),
            errorMessage: 'Container number not found in operator email',
          },
        });

        return {
          success: false,
          error: 'Container number not found in operator email',
          rawMessageId: rawMessage.id,
        };
      }

      // Находим или создаём контейнер
      const container = await containerService.findOrCreateContainer(
        normalizedData.containerNumber
      );

      // Создаём событие статуса
      const statusEvent = await prisma.statusEvent.create({
        data: {
          containerId: container.id,
          statusCode: normalizedData.statusCode,
          statusText: normalizedData.statusText,
          location: normalizedData.location,
          distanceToDestinationKm: normalizedData.distanceToDestinationKm,
          eta: normalizedData.eta,
          eventTime: normalizedData.eventTime,
          sourceType: SourceType.EMAIL,
          sourceRaw: input.body,
          rawMessageId: rawMessage.id,
        },
      });

      // Обновляем сырое сообщение
      await prisma.rawMessage.update({
        where: { id: rawMessage.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      // Обновляем время изменения контейнера
      await prisma.container.update({
        where: { id: container.id },
        data: { updatedAt: new Date() },
      });

      return {
        success: true,
        data: {
          containerId: container.id,
          containerNumber: container.containerNumber,
          statusCode: statusEvent.statusCode,
          statusText: statusEvent.statusText,
          location: statusEvent.location,
          distanceToDestinationKm: statusEvent.distanceToDestinationKm,
          eta: statusEvent.eta,
          eventTime: statusEvent.eventTime,
          sourceType: statusEvent.sourceType,
          sourceRaw: statusEvent.sourceRaw,
        },
        rawMessageId: rawMessage.id,
      };
    } catch (error) {
      await prisma.rawMessage.update({
        where: { id: rawMessage.id },
        data: {
          processed: true,
          processedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Обработка строки таблицы (из выгрузки оператора: 1С или Excel)
   */
  async processTableRow(input: TableRowInput): Promise<{
    success: boolean;
    data?: NormalizedStatusEvent;
    error?: string;
    rawMessageId?: string;
  }> {
    // Сохраняем сырые данные
    const rawMessage = await prisma.rawMessage.create({
      data: {
        sourceType: SourceType.EXCEL,
        content: JSON.stringify(input),
      },
    });

    try {
      // Нормализуем данные
      const result = normalizerService.normalizeTableRow(input);
      
      if (!result.success || !result.data) {
        await prisma.rawMessage.update({
          where: { id: rawMessage.id },
          data: {
            processed: true,
            processedAt: new Date(),
            errorMessage: result.error || 'Normalization failed',
          },
        });

        return {
          success: false,
          error: result.error || 'Failed to normalize table row',
          rawMessageId: rawMessage.id,
        };
      }

      const normalizedData = result.data;

      // Если номер контейнера не найден - ошибка
      if (!normalizedData.containerNumber) {
        await prisma.rawMessage.update({
          where: { id: rawMessage.id },
          data: {
            processed: true,
            processedAt: new Date(),
            errorMessage: 'Container number not provided',
          },
        });

        return {
          success: false,
          error: 'Container number is required',
          rawMessageId: rawMessage.id,
        };
      }

      // Находим или создаём контейнер
      const container = await containerService.findOrCreateContainer(
        normalizedData.containerNumber,
        {
          containerType: input.containerType,
          originPoint: input.from,
          destinationPoint: input.to,
        }
      );

      // Создаём событие статуса
      const statusEvent = await prisma.statusEvent.create({
        data: {
          containerId: container.id,
          statusCode: normalizedData.statusCode,
          statusText: normalizedData.statusText,
          location: normalizedData.location,
          distanceToDestinationKm: normalizedData.distanceToDestinationKm,
          eta: normalizedData.eta,
          eventTime: normalizedData.eventTime,
          sourceType: SourceType.EXCEL,
          sourceRaw: JSON.stringify(input),
          rawMessageId: rawMessage.id,
        },
      });

      // Обновляем сырое сообщение
      await prisma.rawMessage.update({
        where: { id: rawMessage.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      // Обновляем контейнер
      await prisma.container.update({
        where: { id: container.id },
        data: {
          updatedAt: new Date(),
          containerType: input.containerType || undefined,
          originPoint: input.from || undefined,
          destinationPoint: input.to || undefined,
        },
      });

      return {
        success: true,
        data: {
          containerId: container.id,
          containerNumber: container.containerNumber,
          statusCode: statusEvent.statusCode,
          statusText: statusEvent.statusText,
          location: statusEvent.location,
          distanceToDestinationKm: statusEvent.distanceToDestinationKm,
          eta: statusEvent.eta,
          eventTime: statusEvent.eventTime,
          sourceType: statusEvent.sourceType,
          sourceRaw: statusEvent.sourceRaw,
        },
        rawMessageId: rawMessage.id,
      };
    } catch (error) {
      await prisma.rawMessage.update({
        where: { id: rawMessage.id },
        data: {
          processed: true,
          processedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Найти или создать контейнер по номеру
   * Используется универсальным процессором
   */
  async findOrCreateContainer(
    containerNumber: string,
    additionalData?: {
      origin?: string;
      destination?: string;
      containerType?: string;
    }
  ) {
    return containerService.findOrCreateContainer(containerNumber, {
      originPoint: additionalData?.origin,
      destinationPoint: additionalData?.destination,
      containerType: additionalData?.containerType,
    });
  }

  /**
   * Ручное создание статуса
   */
  async createStatusEvent(input: {
    containerId: string;
    statusCode: StatusCode;
    statusText: string;
    location?: string;
    distanceToDestinationKm?: number;
    eta?: Date;
    eventTime: Date;
  }): Promise<StatusEventItem> {
    const event = await prisma.statusEvent.create({
      data: {
        ...input,
        sourceType: SourceType.MANUAL,
      },
    });

    await prisma.container.update({
      where: { id: input.containerId },
      data: { updatedAt: new Date() },
    });

    return {
      id: event.id,
      statusCode: event.statusCode,
      statusText: event.statusText,
      location: event.location,
      distanceToDestinationKm: event.distanceToDestinationKm,
      eta: event.eta,
      eventTime: event.eventTime,
      sourceType: event.sourceType,
      sourceRaw: event.sourceRaw,
      createdAt: event.createdAt,
    };
  }
}

export const statusEventService = new StatusEventService();
