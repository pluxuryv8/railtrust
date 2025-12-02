import { StatusCode } from '@prisma/client';
import { STATUS_LABELS } from '../normalizers/types.js';

/**
 * Генератор клиентских уведомлений
 * 
 * Формирует текст письма для отправки КЛИЕНТУ на основе 
 * нормализованных данных о статусе контейнера.
 * 
 * Это ИСХОДЯЩИЕ данные клиенту, а не входящие от оператора.
 */

export interface ContainerStatusData {
  containerNumber: string;
  containerType?: string | null;
  originPoint?: string | null;
  destinationPoint?: string | null;
  finalDestination?: string | null;
  totalDistanceKm?: number | null;
  clientName?: string | null;
  clientContactPerson?: string | null;
  lastStatus?: {
    statusCode: StatusCode;
    statusText: string;
    location?: string | null;
    distanceToDestinationKm?: number | null;
    eta?: Date | null;
    eventTime: Date;
  } | null;
}

export interface NotificationOptions {
  format?: 'short' | 'full';
  includeGreeting?: boolean;
  includeRoute?: boolean;
  language?: 'ru' | 'en';
}

/**
 * Генерирует текст уведомления для клиента
 */
export function generateClientNotification(
  data: ContainerStatusData,
  options: NotificationOptions = {}
): string {
  const {
    format = 'full',
    includeGreeting = true,
    includeRoute = true,
    language = 'ru',
  } = options;

  const lines: string[] = [];

  // Приветствие
  if (includeGreeting) {
    const greeting = getGreeting(data.clientContactPerson, language);
    lines.push(greeting);
    lines.push('');
  }

  // Информация о контейнере
  if (format === 'full') {
    lines.push(`Контейнер ${data.containerNumber}`);
    if (data.containerType) {
      lines.push(`Тип: ${data.containerType}`);
    }
  }

  // Текущий статус
  if (data.lastStatus) {
    const status = data.lastStatus;

    if (format === 'short') {
      // Короткий формат (как в примере "Илья, доброе утро...")
      if (status.location) {
        lines.push(`Текущее местоположение КТК ${status.location}${
          status.distanceToDestinationKm 
            ? `, ${status.distanceToDestinationKm} км до станции ${data.destinationPoint || 'назначения'}`
            : ''
        }.`);
      }
      
      if (data.totalDistanceKm && data.destinationPoint && data.finalDestination) {
        lines.push(`Расстояние ${data.destinationPoint}-${data.finalDestination} ${data.totalDistanceKm} км`);
      }
    } else {
      // Полный формат
      lines.push('');
      lines.push(`Статус: ${status.statusText}`);
      
      if (status.location) {
        lines.push(`Текущее местоположение: ${status.location}`);
      }
      
      if (status.distanceToDestinationKm) {
        lines.push(`Расстояние до станции назначения: ${status.distanceToDestinationKm} км`);
      }
      
      if (status.eta) {
        const etaStr = formatDate(status.eta, language);
        lines.push(`Ожидаемая дата прибытия: ${etaStr}`);
      }
    }
  } else {
    lines.push('Информация о статусе отсутствует.');
  }

  // Маршрут
  if (includeRoute && format === 'full' && (data.originPoint || data.destinationPoint)) {
    lines.push('');
    lines.push(`Маршрут: ${data.originPoint || '?'} → ${data.destinationPoint || '?'}`);
  }

  return lines.join('\n');
}

/**
 * Генерирует приветствие
 */
function getGreeting(contactPerson: string | null | undefined, language: string): string {
  const hour = new Date().getHours();
  
  let timeOfDay: string;
  if (hour >= 5 && hour < 12) {
    timeOfDay = language === 'ru' ? 'Доброе утро' : 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = language === 'ru' ? 'Добрый день' : 'Good afternoon';
  } else {
    timeOfDay = language === 'ru' ? 'Добрый вечер' : 'Good evening';
  }

  if (contactPerson) {
    return `${contactPerson}, ${timeOfDay.toLowerCase()}.`;
  }
  
  return `${timeOfDay}!`;
}

/**
 * Форматирует дату
 */
function formatDate(date: Date, language: string): string {
  if (language === 'ru') {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Генерирует краткую сводку по нескольким контейнерам
 */
export function generateBatchNotification(
  containers: ContainerStatusData[],
  options: NotificationOptions = {}
): string {
  const { language = 'ru' } = options;
  
  const lines: string[] = [];
  
  // Заголовок
  lines.push(language === 'ru' ? 'Сводка по контейнерам:' : 'Container Summary:');
  lines.push('');
  
  for (const container of containers) {
    const status = container.lastStatus;
    const statusText = status ? STATUS_LABELS[status.statusCode] || status.statusText : '—';
    const location = status?.location || '—';
    const eta = status?.eta ? formatDate(status.eta, language) : '—';
    
    lines.push(`• ${container.containerNumber}: ${statusText}`);
    lines.push(`  Локация: ${location}, ETA: ${eta}`);
  }
  
  return lines.join('\n');
}

