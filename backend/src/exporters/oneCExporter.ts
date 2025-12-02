import { StatusCode } from '@prisma/client';
import { STATUS_LABELS } from '../normalizers/types.js';

/**
 * ============================================
 * 1C Integration Mapping Layer
 * ============================================
 * 
 * Экспорт данных в формате, совместимом с таблицей 1С.
 * 
 * Колонки таблицы 1С:
 * - Тип КТК
 * - Состояние
 * - Пункт отправления
 * - Пункт назначения
 * - Отгружен в море (дата)
 * - На рейде (дата)
 * - Прибыл в порт (дата)
 * - Размещён на СВХ (дата)
 * - Склад закрыт (дата)
 * - Отгружен на ЖД (дата)
 * - Текущее местоположение
 * - Расстояние до станции назначения
 * - Ориентировочная дата прибытия
 */

export interface OneCExportRow {
  container_number: string;     // Номер КТК
  container_type: string;       // Тип КТК (20/24, 40)
  state: string;                // Состояние (человекочитаемое)
  origin: string;               // Пункт отправления
  destination: string;          // Пункт назначения
  shipped_to_sea: string;       // Отгружен в море (дата)
  on_anchorage: string;         // На рейде (дата)
  arrived_port: string;         // Прибыл в порт (дата)
  on_warehouse: string;         // Размещён на СВХ (дата)
  warehouse_closed: string;     // Склад закрыт (дата)
  shipped_on_rail: string;      // Отгружен на ЖД (дата)
  current_location: string;     // Текущее местоположение
  distance_to_destination: string; // Расстояние до назначения
  eta: string;                  // Ориентировочная дата прибытия
}

export interface ContainerWithHistory {
  containerNumber: string;
  containerType: string | null;
  originPoint: string | null;
  destinationPoint: string | null;
  statusHistory: Array<{
    statusCode: StatusCode;
    statusText: string;
    location: string | null;
    distanceToDestinationKm: number | null;
    eta: Date | null;
    eventTime: Date;
  }>;
}

/**
 * Преобразует данные контейнера в формат строки 1С
 */
export function mapContainerToOneCRow(container: ContainerWithHistory): OneCExportRow {
  const history = container.statusHistory;
  
  // Ищем даты для каждого этапа
  const findEventDate = (codes: StatusCode[]): string => {
    const event = history.find(e => codes.includes(e.statusCode));
    return event ? formatDateFor1C(event.eventTime) : '';
  };

  // Получаем последний статус
  const lastStatus = history[0]; // История отсортирована по убыванию eventTime
  
  return {
    container_number: container.containerNumber,
    container_type: container.containerType || '',
    state: lastStatus ? (lastStatus.statusText || STATUS_LABELS[lastStatus.statusCode]) : '',
    origin: container.originPoint || '',
    destination: container.destinationPoint || '',
    shipped_to_sea: findEventDate([StatusCode.ON_SHIP]),
    on_anchorage: findEventDate([StatusCode.ON_ANCHORAGE]),
    arrived_port: findEventDate([StatusCode.ARRIVED_PORT]),
    on_warehouse: findEventDate([StatusCode.ON_WAREHOUSE]),
    warehouse_closed: findEventDate([StatusCode.CUSTOMS_CLEARED]),
    shipped_on_rail: findEventDate([StatusCode.ON_RAIL]),
    current_location: lastStatus?.location || '',
    distance_to_destination: lastStatus?.distanceToDestinationKm?.toString() || '',
    eta: lastStatus?.eta ? formatDateFor1C(lastStatus.eta) : '',
  };
}

/**
 * Форматирует дату в формат 1С (DD.MM.YYYY)
 */
function formatDateFor1C(date: Date): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Конвертирует массив контейнеров в формат 1С
 */
export function exportContainersFor1C(containers: ContainerWithHistory[]): OneCExportRow[] {
  return containers.map(mapContainerToOneCRow);
}

/**
 * Генерирует CSV для импорта в 1С
 */
export function generateOneCCsv(rows: OneCExportRow[]): string {
  // Заголовки (на русском для 1С)
  const headers = [
    'Номер КТК',
    'Тип КТК',
    'Состояние',
    'Пункт отправления',
    'Пункт назначения',
    'Отгружен в море',
    'На рейде',
    'Прибыл в порт',
    'Размещён на СВХ',
    'Склад закрыт',
    'Отгружен на ЖД',
    'Текущее местоположение',
    'Расстояние до назначения',
    'Ориентировочная дата прибытия',
  ];

  const lines: string[] = [headers.join(';')];

  for (const row of rows) {
    const values = [
      row.container_number,
      row.container_type,
      row.state,
      row.origin,
      row.destination,
      row.shipped_to_sea,
      row.on_anchorage,
      row.arrived_port,
      row.on_warehouse,
      row.warehouse_closed,
      row.shipped_on_rail,
      row.current_location,
      row.distance_to_destination,
      row.eta,
    ];
    
    // Экранируем значения для CSV
    const escaped = values.map(v => {
      if (v.includes(';') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    });
    
    lines.push(escaped.join(';'));
  }

  // Используем Windows line endings для совместимости с 1С
  return lines.join('\r\n');
}

