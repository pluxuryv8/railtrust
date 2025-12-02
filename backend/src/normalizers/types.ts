import { StatusCode, SourceType } from '@prisma/client';

/**
 * Результат нормализации данных
 */
export interface NormalizationResult {
  success: boolean;
  data?: ParsedStatusData;
  error?: string;
  confidence?: number; // 0-1, насколько уверены в результате
}

/**
 * Распарсенные данные статуса (промежуточный формат)
 */
export interface ParsedStatusData {
  containerNumber?: string;
  statusCode: StatusCode;
  statusText: string;
  location?: string;
  distanceToDestinationKm?: number;
  eta?: Date;
  eventTime: Date;
  sourceType: SourceType;
}

/**
 * Маппинг текстовых статусов на нормализованные коды
 */
export const STATUS_MAPPINGS: Record<string, StatusCode> = {
  // Русские варианты
  'загружен': StatusCode.LOADED,
  'в порту': StatusCode.IN_PORT,
  'в пути морем': StatusCode.ON_SHIP,
  'отгружен в море': StatusCode.ON_SHIP,
  'на рейде': StatusCode.ON_ANCHORAGE,
  'прибыл в порт': StatusCode.ARRIVED_PORT,
  'прибыл в порт назначения': StatusCode.ARRIVED_PORT,
  'на складе': StatusCode.ON_WAREHOUSE,
  'размещен на свх': StatusCode.ON_WAREHOUSE,
  'контейнер груженый в порту': StatusCode.IN_PORT,
  'растаможен': StatusCode.CUSTOMS_CLEARED,
  'в пути по жд': StatusCode.ON_RAIL,
  'отгружен на жд': StatusCode.ON_RAIL,
  'в пути жд': StatusCode.ON_RAIL,
  'отгружен / в пути по жд': StatusCode.ON_RAIL,
  'прибыл на станцию': StatusCode.RAIL_ARRIVED,
  'в пути авто': StatusCode.ON_AUTO,
  'доставлен': StatusCode.DELIVERED,
  
  // Из таблицы 1С
  'отгружен / в пути море': StatusCode.ON_SHIP,
};

/**
 * Человекочитаемые названия статусов
 */
export const STATUS_LABELS: Record<StatusCode, string> = {
  [StatusCode.LOADED]: 'Загружен',
  [StatusCode.IN_PORT]: 'В порту',
  [StatusCode.ON_SHIP]: 'В пути морем',
  [StatusCode.ON_ANCHORAGE]: 'На рейде',
  [StatusCode.ARRIVED_PORT]: 'Прибыл в порт назначения',
  [StatusCode.ON_WAREHOUSE]: 'На складе СВХ',
  [StatusCode.CUSTOMS_CLEARED]: 'Растаможен',
  [StatusCode.ON_RAIL]: 'В пути по ЖД',
  [StatusCode.RAIL_ARRIVED]: 'Прибыл на ЖД станцию',
  [StatusCode.ON_AUTO]: 'В пути автотранспортом',
  [StatusCode.DELIVERED]: 'Доставлен',
  [StatusCode.UNKNOWN]: 'Неизвестно',
};

