import { StatusCode, SourceType, Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { 
  ContainerListItem, 
  ContainerDetails, 
  ContainerFilterParams,
  StatusEventItem 
} from '../types/index.js';

/**
 * Сервис для работы с контейнерами
 */
export class ContainerService {
  
  /**
   * Получение списка контейнеров с последним статусом
   */
  async getContainers(params: ContainerFilterParams): Promise<{
    data: ContainerListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, statusCode, clientId, carrierId, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // Формируем условия фильтрации
    const where: Prisma.ContainerWhereInput = {};

    if (search) {
      where.containerNumber = {
        contains: search.toUpperCase(),
        mode: 'insensitive',
      };
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (carrierId) {
      where.carrierId = carrierId;
    }

    // Получаем контейнеры
    const [containers, total] = await Promise.all([
      prisma.container.findMany({
        where,
        include: {
          client: {
            select: { name: true },
          },
          carrier: {
            select: { name: true },
          },
          statusEvents: {
            orderBy: { eventTime: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.container.count({ where }),
    ]);

    // Фильтрация по статусу (после получения данных)
    let filteredContainers = containers;
    if (statusCode) {
      filteredContainers = containers.filter(
        c => c.statusEvents[0]?.statusCode === statusCode
      );
    }

    // Преобразуем в DTO
    const data: ContainerListItem[] = filteredContainers.map(container => ({
      id: container.id,
      containerNumber: container.containerNumber,
      containerType: container.containerType,
      originPoint: container.originPoint,
      destinationPoint: container.destinationPoint,
      clientName: container.client?.name || null,
      carrierName: container.carrier?.name || null,
      lastStatus: container.statusEvents[0] ? {
        statusCode: container.statusEvents[0].statusCode,
        statusText: container.statusEvents[0].statusText,
        location: container.statusEvents[0].location,
        eta: container.statusEvents[0].eta,
        eventTime: container.statusEvents[0].eventTime,
      } : null,
    }));

    return { data, total, page, limit };
  }

  /**
   * Получение детальной информации о контейнере
   */
  async getContainerById(id: string): Promise<ContainerDetails | null> {
    const container = await prisma.container.findUnique({
      where: { id },
      include: {
        client: {
          select: { name: true },
        },
        carrier: {
          select: { name: true },
        },
        statusEvents: {
          orderBy: { eventTime: 'desc' },
        },
      },
    });

    if (!container) {
      return null;
    }

    const statusHistory: StatusEventItem[] = container.statusEvents.map(event => ({
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

    return {
      id: container.id,
      containerNumber: container.containerNumber,
      containerType: container.containerType,
      originPoint: container.originPoint,
      destinationPoint: container.destinationPoint,
      totalDistanceKm: container.totalDistanceKm,
      clientName: container.client?.name || null,
      carrierName: container.carrier?.name || null,
      lastStatus: statusHistory[0] || null,
      statusHistory,
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
    };
  }

  /**
   * Получение контейнера по номеру
   */
  async getContainerByNumber(containerNumber: string): Promise<ContainerDetails | null> {
    const container = await prisma.container.findUnique({
      where: { containerNumber: containerNumber.toUpperCase() },
      include: {
        client: {
          select: { name: true },
        },
        carrier: {
          select: { name: true },
        },
        statusEvents: {
          orderBy: { eventTime: 'desc' },
        },
      },
    });

    if (!container) {
      return null;
    }

    const statusHistory: StatusEventItem[] = container.statusEvents.map(event => ({
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

    return {
      id: container.id,
      containerNumber: container.containerNumber,
      containerType: container.containerType,
      originPoint: container.originPoint,
      destinationPoint: container.destinationPoint,
      totalDistanceKm: container.totalDistanceKm,
      clientName: container.client?.name || null,
      carrierName: container.carrier?.name || null,
      lastStatus: statusHistory[0] || null,
      statusHistory,
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
    };
  }

  /**
   * Создание или получение контейнера
   */
  async findOrCreateContainer(
    containerNumber: string,
    options?: {
      containerType?: string;
      originPoint?: string;
      destinationPoint?: string;
    }
  ): Promise<{ id: string; containerNumber: string; created: boolean }> {
    const normalized = containerNumber.replace(/\s/g, '').toUpperCase();

    const existing = await prisma.container.findUnique({
      where: { containerNumber: normalized },
      select: { id: true, containerNumber: true },
    });

    if (existing) {
      return { ...existing, created: false };
    }

    const created = await prisma.container.create({
      data: {
        containerNumber: normalized,
        containerType: options?.containerType,
        originPoint: options?.originPoint,
        destinationPoint: options?.destinationPoint,
      },
      select: { id: true, containerNumber: true },
    });

    return { ...created, created: true };
  }
}

export const containerService = new ContainerService();

