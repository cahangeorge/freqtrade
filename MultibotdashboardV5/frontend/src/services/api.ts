/**
 * API client for communicating with the dashboard backend.
 */

import type { ApiResponse, TokenResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Try to restore token from localStorage
    this.accessToken = localStorage.getItem('access_token');
  }

  /**
   * Set the access token for authenticated requests.
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  /**
   * Get the current access token.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Build headers for API requests.
   */
  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Make an API request.
   */
  async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | string[]>;
      includeAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { body, params, includeAuth = true } = options;

    let url = `${this.baseUrl}${endpoint}`;

    // Add query parameters
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers: this.getHeaders(includeAuth),
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      this.setAccessToken(null);
      // Dispatch event for auth state change - triggers redirect to login
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    return data;
  }

  /**
   * GET request helper.
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | string[]>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, { params });
  }

  /**
   * POST request helper.
   */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, { body });
  }

  /**
   * PUT request helper.
   */
  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, { body });
  }

  /**
   * PATCH request helper.
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, { body });
  }

  /**
   * DELETE request helper.
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  // Auth endpoints
  async login(username: string, password: string): Promise<TokenResponse> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store the token
    if (data.data?.access_token) {
      this.setAccessToken(data.data.access_token);
    }

    return data.data;
  }

  logout(): void {
    this.setAccessToken(null);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await this.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    if (response.data.access_token) {
      this.setAccessToken(response.data.access_token);
    }
    return response.data;
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for testing
export { ApiClient };
