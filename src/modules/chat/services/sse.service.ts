import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

interface StreamClient {
  userId: string;
  conversationId: string;
  subject: Subject<MessageEvent>;
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
      this.closeStream(clientId);
    }

    const subject = new Subject<MessageEvent>();
    const client: StreamClient = {
      userId,
      conversationId,
      subject,
      lastActivity: new Date(),
    };

    this.clients.set(clientId, client);
    this.logger.log(`SSE stream created for ${clientId}`);

    // Send heartbeat every 30 seconds
    const heartbeat$ = interval(30000).pipe(
      takeUntil(subject),
      map(() => ({
        data: { type: 'heartbeat', timestamp: new Date().toISOString() },
      })),
    );

    return new Observable((observer) => {
      // Send initial connection message
      observer.next({
        data: {
          type: 'connected',
          conversationId,
          timestamp: new Date().toISOString(),
        },
      });

      // Subscribe to heartbeat
      const heartbeatSub = heartbeat$.subscribe((event) => observer.next(event));

      // Subscribe to client-specific messages
      const messageSub = subject.subscribe({
        next: (data) => {
          client.lastActivity = new Date();
          observer.next({ data });
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

      // Cleanup on unsubscribe
      return () => {
        this.logger.log(`SSE stream closed for ${clientId}`);
        heartbeatSub.unsubscribe();
        messageSub.unsubscribe();
        this.closeStream(clientId);
      };
    });
  }

  /**
   * Send a message to a specific user's conversation stream
   */
  sendToStream(userId: string, conversationId: string, data: Record<string, unknown>) {
    const clientId = `${userId}:${conversationId}`;
    const client = this.clients.get(clientId);

    if (client) {
      client.subject.next({ data } as MessageEvent);
      this.logger.debug(`Message sent to stream ${clientId}:`, data.type);
    } else {
      this.logger.warn(`No active stream for ${clientId}`);
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
