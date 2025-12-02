// Status codes (matching backend)
export type StatusCode =
  | 'LOADED'
  | 'IN_PORT'
  | 'ON_SHIP'
  | 'ON_ANCHORAGE'
  | 'ARRIVED_PORT'
  | 'ON_WAREHOUSE'
  | 'CUSTOMS_CLEARED'
  | 'ON_RAIL'
  | 'RAIL_ARRIVED'
  | 'ON_AUTO'
  | 'DELIVERED'
  | 'UNKNOWN';

export type SourceType = 'EMAIL' | 'EXCEL' | 'API' | 'MANUAL';

// Container list item
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
    eta: string | null;
    eventTime: string;
  } | null;
}

// Container details
export interface ContainerDetails extends ContainerListItem {
  totalDistanceKm: number | null;
  statusHistory: StatusEventItem[];
  createdAt: string;
  updatedAt: string;
}

// Status event
export interface StatusEventItem {
  id: string;
  statusCode: StatusCode;
  statusText: string;
  location: string | null;
  distanceToDestinationKm: number | null;
  eta: string | null;
  eventTime: string;
  sourceType: SourceType;
  sourceRaw: string | null;
  createdAt: string;
}

// API response types
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

// Filter params
export interface ContainerFilterParams {
  search?: string;
  statusCode?: StatusCode;
  page?: number;
  limit?: number;
}

// Status labels and colors
export const STATUS_LABELS: Record<StatusCode, string> = {
  LOADED: 'Загружен',
  IN_PORT: 'В порту',
  ON_SHIP: 'В пути морем',
  ON_ANCHORAGE: 'На рейде',
  ARRIVED_PORT: 'Прибыл в порт',
  ON_WAREHOUSE: 'На складе СВХ',
  CUSTOMS_CLEARED: 'Растаможен',
  ON_RAIL: 'В пути по ЖД',
  RAIL_ARRIVED: 'Прибыл на ЖД',
  ON_AUTO: 'В пути авто',
  DELIVERED: 'Доставлен',
  UNKNOWN: 'Неизвестно',
};

export const STATUS_COLORS: Record<StatusCode, string> = {
  LOADED: 'status-loaded',
  IN_PORT: 'status-in-port',
  ON_SHIP: 'status-on-ship',
  ON_ANCHORAGE: 'status-on-anchorage',
  ARRIVED_PORT: 'status-arrived-port',
  ON_WAREHOUSE: 'status-on-warehouse',
  CUSTOMS_CLEARED: 'status-customs-cleared',
  ON_RAIL: 'status-on-rail',
  RAIL_ARRIVED: 'status-rail-arrived',
  ON_AUTO: 'status-on-auto',
  DELIVERED: 'status-delivered',
  UNKNOWN: 'status-unknown',
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  EMAIL: 'Email',
  EXCEL: 'Excel/1C',
  API: 'API',
  MANUAL: 'Вручную',
};

