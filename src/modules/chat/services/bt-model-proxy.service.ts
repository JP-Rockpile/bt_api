import { Injectable, Logger } from '@nestjs/common';
import { BtModelClientService } from './bt-model-client.service';
import { SseService } from './sse.service';
import { ChatService } from '../chat.service';

interface SSEEvent {
  type: string;
  content?: string;
  event?: any;
  market?: any;
  tool?: string;
  parameters?: any;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Proxy service for streaming responses from bt_model to mobile clients
 * Handles SSE connection management, event forwarding, and error recovery
 */
@Injectable()
export class BtModelProxyService {
  private readonly logger = new Logger(BtModelProxyService.name);

  constructor(
    private btModelClient: BtModelClientService,
    private sseService: SseService,
    private chatService: ChatService,
  ) {}

  /**
   * Stream a response from bt_model to the user via SSE
   * This method:
   * 1. Opens SSE connection to bt_model (internal)
   * 2. Forwards all events to mobile app via SseService
   * 3. Persists final response to database
   * 4. Handles errors and cleanup
   */
  async streamResponse(
    userId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<void> {
    if (!this.btModelClient.isEnabled()) {
      this.logger.warn('bt_model is disabled, using placeholder response');
      return;
    }

    const streamUrl = this.btModelClient.getStreamUrl(conversationId);
    const headers = this.btModelClient.getHeaders(userId);

    this.logger.log(`Opening SSE stream to bt_model for user ${userId}, conversation ${conversationId}`);
    this.logger.log(`Stream URL: ${streamUrl}`);

    let accumulatedResponse = '';
    let abortController: AbortController | null = null;

    try {
      abortController = new AbortController();

      // Make POST request to bt_model chat endpoint with streaming enabled
      const response = await fetch(`${this.btModelClient.getStreamUrl(conversationId).split('?')[0]}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userMessage,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`bt_model SSE connection failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('bt_model response has no body');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.logger.log('bt_model stream completed');
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          try {
            // Parse SSE format: "data: {json}\n"
            const lines = eventStr.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6); // Remove "data: " prefix
                const event: SSEEvent = JSON.parse(jsonStr);

                // Forward event to mobile app via SseService
                this.handleBtModelEvent(userId, conversationId, event);

                // Accumulate content from llm_chunk events
                if (event.type === 'llm_chunk' && event.content) {
                  accumulatedResponse += event.content;
                }
              }
            }
          } catch (parseError) {
            this.logger.error(`Error parsing SSE event: ${parseError.message}`, eventStr);
          }
        }
      }

      // Persist final response to database
      if (accumulatedResponse.trim()) {
        this.logger.log(`Persisting assistant response to database (${accumulatedResponse.length} chars)`);
        await this.chatService.createMessage(
          userId,
          conversationId,
          'ASSISTANT',
          accumulatedResponse.trim(),
        );
      }

    } catch (error) {
      this.logger.error(`Error streaming from bt_model: ${error.message}`, error.stack);

      // Send error event to client
      this.sseService.sendToStream(userId, conversationId, {
        type: 'error',
        message: 'Failed to get response from AI service',
        timestamp: new Date().toISOString(),
      });

      throw error;
    } finally {
      // Cleanup
      if (abortController) {
        abortController.abort();
      }
    }
  }

  /**
   * Handle individual events from bt_model and forward to mobile app
   */
  private handleBtModelEvent(userId: string, conversationId: string, event: SSEEvent): void {
    this.logger.debug(`Forwarding event to mobile app: ${event.type}`);

    // Forward all event types to mobile app
    // The SseService will wrap this in MessageEvent format
    this.sseService.sendToStream(userId, conversationId, event);
  }
}

