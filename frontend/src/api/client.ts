import axios from 'axios';
import type {
  ApiResponse,
  PaginatedResponse,
  ContainerListItem,
  ContainerDetails,
  StatusEventItem,
  ContainerFilterParams,
} from '../types';

const API_BASE = '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Containers API
export const containersApi = {
  /**
   * Get list of containers with filtering and pagination
   */
  getContainers: async (
    params: ContainerFilterParams = {}
  ): Promise<PaginatedResponse<ContainerListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<ContainerListItem>>(
      '/containers',
      { params }
    );
    return data;
  },

  /**
   * Get container details by ID or container number
   */
  getContainer: async (id: string): Promise<ContainerDetails> => {
    const { data } = await apiClient.get<ApiResponse<ContainerDetails>>(
      `/containers/${id}`
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch container');
    }
    return data.data;
  },

  /**
   * Get client notification text for a container
   * This is the OUTGOING notification to the client
   */
  getNotification: async (id: string, format: 'short' | 'full' = 'full'): Promise<string> => {
    const { data } = await apiClient.get<ApiResponse<{ notification: string }>>(
      `/containers/${id}/notification`,
      { params: { format } }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to generate notification');
    }
    return data.data.notification;
  },
};

// Status events API
export const statusEventsApi = {
  /**
   * Get status history for a container
   */
  getStatusHistory: async (containerId: string): Promise<StatusEventItem[]> => {
    const { data } = await apiClient.get<ApiResponse<StatusEventItem[]>>(
      '/status-events',
      { params: { container_id: containerId } }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch status history');
    }
    return data.data;
  },
};

// Raw data API (for testing/demo - INCOMING data from operators)
export const rawDataApi = {
  /**
   * Process email from OPERATOR (not to client!)
   */
  processOperatorEmail: async (body: string, subject?: string, senderEmail?: string) => {
    const { data } = await apiClient.post('/raw/operator-email', {
      body,
      subject,
      senderEmail,
    });
    return data;
  },

  /**
   * Process table row from operator
   */
  processTableRow: async (row: Record<string, unknown>) => {
    const { data } = await apiClient.post('/raw/table-row', row);
    return data;
  },
};

// Export API (1C Integration)
export const exportApi = {
  /**
   * Export containers for 1C
   */
  exportFor1C: async (format: 'json' | 'csv' = 'json', containerIds?: string[]) => {
    const params: Record<string, string> = { format };
    if (containerIds?.length) {
      params.containerIds = containerIds.join(',');
    }
    
    if (format === 'csv') {
      // For CSV, return blob URL for download
      const response = await apiClient.get('/export/1c', {
        params,
        responseType: 'blob',
      });
      return URL.createObjectURL(response.data);
    }
    
    const { data } = await apiClient.get('/export/1c', { params });
    return data;
  },
};

export default apiClient;
