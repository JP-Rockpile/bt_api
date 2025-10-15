import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval } from 'rxjs';
import { map, takeUntil, finalize } from 'rxjs/operators';

interface StreamClient {
  userId: string;
  conversationId: string;
  subject: Subject<Record<string, unknown>>;
  lastActivity: Date;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private clients: Map<string, StreamClient> = new Map();

  constructor() {
    // Cleanup inactive connections every minute
    interval(60000).subscribe(() => this.cleanupInactiveConnections());
  }

  createStream(userId: string, conversationId: string): Observable<MessageEvent> {
    const clientId = `${userId}:${conversationId}`;

    // Close existing connection if any
    if (this.clients.has(clientId)) {
      this.logger.log(`Closing existing stream for ${clientId}`);
      this.closeStream(clientId);
    }

    const subject = new Subject<Record<string, unknown>>();
    const client: StreamClient = {
      userId,
      conversationId,
      subject,
      lastActivity: new Date(),
    };

    this.clients.set(clientId, client);
    this.logger.log(`SSE stream created for ${clientId}`);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat$ = interval(30000).pipe(
      takeUntil(subject),
      map(() => ({ type: 'heartbeat', timestamp: new Date().toISOString() })),
    );

    return new Observable<MessageEvent>((observer) => {
      // Send initial connection message
      observer.next({
        data: {
          type: 'connected',
          conversationId,
          timestamp: new Date().toISOString(),
        },
      } as MessageEvent);

      // Subscribe to heartbeat
      const heartbeatSub = heartbeat$.subscribe((heartbeatData) => {
        client.lastActivity = new Date();
        observer.next({ data: heartbeatData } as MessageEvent);
      });

      // Subscribe to client-specific messages
      const messageSub = subject.subscribe({
        next: (data) => {
          client.lastActivity = new Date();
          // Data is already in the correct format, just wrap it in MessageEvent
          observer.next({ data } as MessageEvent);
        },
        error: (err) => {
          this.logger.error(`SSE stream error for ${clientId}: ${err.message}`);
          observer.error(err);
        },
        complete: () => {
          this.logger.log(`SSE stream completed for ${clientId}`);
          observer.complete();
        },
      });

      // Cleanup on unsubscribe/disconnect
      return () => {
        this.logger.log(`SSE stream unsubscribed for ${clientId}`);
        heartbeatSub.unsubscribe();
        messageSub.unsubscribe();
        this.closeStream(clientId);
      };
    }).pipe(
      finalize(() => {
        this.logger.log(`SSE stream finalized for ${clientId}`);
      }),
    );
  }

  /**
   * Send a message to a specific user's conversation stream
   */
  sendToStream(userId: string, conversationId: string, data: Record<string, unknown>) {
    const clientId = `${userId}:${conversationId}`;
    this.logger.log(`🔍 sendToStream - Looking for client: ${clientId}`);
    this.logger.log(`📊 Active clients: ${Array.from(this.clients.keys()).join(', ')}`);

    const client = this.clients.get(clientId);

    if (client) {
      // Send the data directly - it will be wrapped in MessageEvent by the observer
      client.subject.next(data);
      this.logger.log(`✅ Message sent to stream ${clientId} - Type: ${data.type}`);
    } else {
      this.logger.warn(
        `⚠️ No active stream for ${clientId} - message dropped - Type: ${data.type}`,
      );
      this.logger.warn(
        `Available streams: ${this.clients.size > 0 ? Array.from(this.clients.keys()).join(', ') : 'NONE'}`,
      );
    }
  }

  /**
   * Broadcast system message (e.g., odds update, bet status change)
   */
  broadcastSystemMessage(
    userId: string,
    conversationId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    this.sendToStream(userId, conversationId, {
      type: 'system',
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send streaming LLM response chunk
   */
  sendLLMChunk(
    userId: string,
    conversationId: string,
    chunk: string,
    metadata?: Record<string, unknown>,
  ) {
    this.logger.log(
      `📤 sendLLMChunk called for ${userId}:${conversationId} - chunk: "${chunk.trim()}"`,
    );
    this.sendToStream(userId, conversationId, {
      type: 'llm_chunk',
      content: chunk,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send LLM response completion
   */
  sendLLMComplete(
    userId: string,
    conversationId: string,
    fullResponse: string,
    metadata?: Record<string, unknown>,
  ) {
    this.logger.log(
      `🏁 sendLLMComplete called for ${userId}:${conversationId} - ${fullResponse.length} chars`,
    );
    this.sendToStream(userId, conversationId, {
      type: 'llm_complete',
      content: fullResponse,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  private closeStream(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subject.complete();
      this.clients.delete(clientId);
    }
  }

  private cleanupInactiveConnections() {
    const now = new Date();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [clientId, client] of this.clients.entries()) {
      const inactive = now.getTime() - client.lastActivity.getTime();
      if (inactive > timeout) {
        this.logger.log(`Cleaning up inactive connection: ${clientId}`);
        this.closeStream(clientId);
      }
    }
  }
}
