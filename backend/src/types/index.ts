import { StatusCode, SourceType } from '@prisma/client';

// ============================================
// DTOs для API
// ============================================

// Нормализованный формат события статуса
export interface NormalizedStatusEvent {
  containerId?: string;
  containerNumber?: string;
  statusCode: StatusCode;
  statusText: string;
  location?: string | null;
  distanceToDestinationKm?: number | null;
  eta?: string | null;
  etaUnload?: string | null;        // Дата разгрузки
  eventTime?: string;
  sourceType: SourceType;
  sourceRaw?: string | null;
  
  // Дополнительные поля из универсального парсера
  origin?: string;
  destination?: string;
  carrierName?: string;
  sourceInfo?: string;              // Источник данных
  operatorComment?: string;         // Комментарий оператора
}

// Входные данные для универсального процессора
export interface UniversalInput {
  /** Сырые данные - текст, JSON, массив */
  content: string | object | unknown[];
  
  /** Подсказка формата (опционально) */
  hint?: 'text' | 'json' | 'csv' | 'table' | 'api';
  
  /** Метаданные источника */
  metadata?: {
    sourceEmail?: string;
    sourceSubject?: string;
    sourceCarrierId?: string;
    sourceUrl?: string;
    receivedAt?: string;
  };
}

// Входные данные для email-парсера
export interface EmailInput {
  subject?: string;
  body: string;
  senderEmail?: string;
  receivedAt?: string;
}

// Входные данные для табличной строки (как в 1С/Excel)
export interface TableRowInput {
  containerType?: string;      // Тип КТК (20/24, 40)
  containerNumber?: string;    // Номер контейнера
  state?: string;              // Состояние
  from?: string;               // Пункт отправления
  to?: string;                 // Пункт назначения
  shippedToSea?: string;       // Отгружен в море (дата)
  onAnchorage?: string;        // На рейде (дата)
  arrivedPort?: string;        // Прибыл в порт (дата)
  onWarehouse?: string;        // Размещен на СВХ (дата)
  warehouseClosed?: string;    // Склад закрыт (дата)
  loadedOnRail?: string;       // Груженый на станции (дата)
  shippedOnRail?: string;      // Отгружен на ЖД (дата)
  currentLocation?: string;    // Текущее местоположение
  distanceToDestination?: string | number; // Расстояние до станции назначения
  eta?: string;                // Ориентировочная дата прибытия
}

// ============================================
// API Response DTOs
// ============================================

export interface ContainerListItem {
  id: string;
  containerNumber: string;
  containerType: string | null;
  originPoint: string | null;
  destinationPoint: string | null;
  clientName: string | null;
  carrierName: string | null;
  lastStatus: {
    statusCode: StatusCode;
    statusText: string;
    location: string | null;
    eta: Date | null;
    eventTime: Date;
  } | null;
}

export interface ContainerDetails extends ContainerListItem {
  totalDistanceKm: number | null;
  statusHistory: StatusEventItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusEventItem {
  id: string;
  statusCode: StatusCode;
  statusText: string;
  location: string | null;
  distanceToDestinationKm: number | null;
  eta: Date | null;
  eventTime: Date;
  sourceType: SourceType;
  sourceRaw: string | null;
  createdAt: Date;
}

// ============================================
// API Request DTOs
// ============================================

export interface ContainerFilterParams {
  search?: string;
  statusCode?: StatusCode;
  clientId?: string;
  carrierId?: string;
  page?: number;
  limit?: number;
}

export interface CreateStatusEventInput {
  containerId: string;
  statusCode: StatusCode;
  statusText: string;
  location?: string;
  distanceToDestinationKm?: number;
  eta?: string;
  eventTime: string;
  sourceType: SourceType;
  sourceRaw?: string;
}

// ============================================
// API Response Wrappers
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

