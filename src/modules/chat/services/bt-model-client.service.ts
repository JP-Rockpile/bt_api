import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../config/configuration';

/**
 * HTTP client for communicating with bt_model service
 * Handles service-to-service authentication and request formatting
 */
@Injectable()
export class BtModelClientService {
  private readonly logger = new Logger(BtModelClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly serviceToken: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService<Configuration>) {
    const btModelConfig = this.configService.get('btModel', { infer: true });
    const securityConfig = this.configService.get('security', { infer: true });

    // Handle config with defaults
    this.baseUrl = btModelConfig?.baseUrl || 'http://localhost:8000';
    this.timeout = btModelConfig?.timeout || 30000;
    this.enabled = btModelConfig?.enabled ?? false;
    this.serviceToken = securityConfig?.btModelServiceToken || '';

    this.logger.log(`BtModelClient initialized: ${this.baseUrl} (enabled: ${this.enabled})`);
  }

  /**
   * Check if bt_model integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !!this.serviceToken;
  }

  /**
   * Send a message to bt_model and get a non-streaming response
   * Used for testing and non-SSE scenarios
   */
  async sendMessage(
    conversationId: string,
    message: string,
    userId: string,
  ): Promise<{ response: string; metadata?: any }> {
    if (!this.isEnabled()) {
      throw new Error('bt_model integration is not enabled');
    }

    const url = `${this.baseUrl}/chat/`;
    
    this.logger.log(`Sending message to bt_model: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(userId),
        body: JSON.stringify({
          conversation_id: conversationId,
          message: message,
          stream: false,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`bt_model request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(`Error sending message to bt_model: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get SSE stream URL for bt_model
   */
  getStreamUrl(conversationId: string): string {
    return `${this.baseUrl}/chat/?conversation_id=${conversationId}&stream=true`;
  }

  /**
   * Get headers for bt_model requests with service authentication
   */
  getHeaders(userId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Service-Token': this.serviceToken,
    };

    // Forward user context for ownership checks in bt_model
    if (userId) {
      headers['X-User-Id'] = userId;
    }

    return headers;
  }
}

