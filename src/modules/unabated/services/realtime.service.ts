import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { RealtimeMessage, MarketLineUpdate } from '../interfaces/unabated.interfaces';

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private ws: WebSocket;
  private running: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectSec: number;
  private readonly heartbeatSec: number;
  private subscriptionId: string;
  private marketLineHandler: (line: MarketLineUpdate) => Promise<void>;

  private readonly apiHost: string;
  private readonly apiKey: string;
  private readonly apiRegion: string;

  constructor(private configService: ConfigService) {
    this.apiHost =
      this.configService.get<string>('UNABATED_REALTIME_HOST') || 'realtime.unabated.com';
    this.apiKey = this.configService.get<string>('UNABATED_REALTIME_API_KEY') || '';
    this.apiRegion = this.configService.get<string>('UNABATED_REALTIME_REGION', 'us-east-1');
    this.maxReconnectSec = this.configService.get<number>('UNABATED_WS_MAX_RECONNECT_SEC', 60);
    this.heartbeatSec = this.configService.get<number>('UNABATED_WS_HEARTBEAT_SEC', 25);
  }

  onModuleDestroy() {
    this.close();
  }

  setMarketLineHandler(handler: (line: MarketLineUpdate) => Promise<void>): void {
    this.marketLineHandler = handler;
  }

  private buildWebSocketUrl(): string {
    const endpoint = `wss://${this.apiHost}/graphql/realtime`;
    const headerData = {
      host: this.apiHost,
      Authorization: this.apiKey,
    };
    const headerB64 = Buffer.from(JSON.stringify(headerData)).toString('base64');
    const payloadB64 = Buffer.from('{}').toString('base64');
    return `${endpoint}?header=${headerB64}&payload=${payloadB64}`;
  }

  async subscribe(leagueIds: string[]): Promise<void> {
    if (!this.marketLineHandler) {
      throw new Error('Market line handler not set');
    }

    this.logger.log(`Subscribing to market line updates for leagues: ${leagueIds.join(', ')}`);
    this.running = true;

    while (this.running) {
      try {
        await this.connect();
      } catch (error) {
        if (!this.running) break;
        this.logger.error(`Subscription error: ${error.message}`);
        await this.reconnectBackoff();
      }
    }
  }

  private async connect(): Promise<void> {
    const url = this.buildWebSocketUrl();
    this.ws = new WebSocket(url, {
      headers: {
        'Sec-WebSocket-Protocol': 'graphql-ws',
      },
    });

    return new Promise((resolve, reject) => {
      this.ws.on('open', () => {
        this.logger.log('✅ WebSocket connected!');
        this.reconnectAttempts = 0;
        this.sendConnectionInit();
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString());
          this.logger.debug(`WebSocket message received: ${JSON.stringify(parsed)}`);
          await this.handleMessage(parsed);
        } catch (error) {
          this.logger.warn(`Failed to parse message: ${error.message}`);
          this.logger.warn(`Raw message: ${data.toString()}`);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`WebSocket error: ${error.message}`);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.logger.warn(`WebSocket closed - Code: ${code}, Reason: ${reason.toString()}`);
        if (this.running) {
          reject(new Error(`WebSocket closed unexpectedly - Code: ${code}, Reason: ${reason.toString()}`));
        } else {
          resolve();
        }
      });
    });
  }

  private sendConnectionInit(): void {
    const message = {
      type: 'connection_init',
      payload: {
        authorization: {
          host: this.apiHost,
          Authorization: this.apiKey,
        },
      },
    };
    this.logger.log(`📤 Sent connection_init to ${this.apiHost}`);
    this.ws.send(JSON.stringify(message));
  }

  private startSubscription(): void {
    this.subscriptionId = this.generateUuid();

    const subscription = {
      id: this.subscriptionId,
      type: 'start',
      payload: {
        data: JSON.stringify({
          query: `
            subscription marketLineUpdate {
              marketLineUpdate {
                leagueId
                marketSourceGroup
                messageId
                messageTimestamp
                correlationId
                marketLines {
                  marketId
                  marketLineId
                  marketSourceId
                  points
                  price
                  sourcePrice
                  sourceFormat
                  statusId
                  sequenceNumber
                  edge
                  bestAltPoints
                  bestAltPrice
                  bestAltEdge
                  disabled
                  marketLineKey
                  modifiedOn
                }
              }
            }
          `,
        }),
        extensions: {
          authorization: {
            host: this.apiHost,
            Authorization: this.apiKey,
            'x-amz-user-agent': 'unabated-nestjs/1.0.0',
          },
        },
      },
    };

    this.logger.log(`📤 Sent subscription start (ID: ${this.subscriptionId})`);
    this.ws.send(JSON.stringify(subscription));
  }

  private async handleMessage(message: any): Promise<void> {
    const msgType = message.type;

    switch (msgType) {
      case 'connection_ack':
        this.logger.log('✅ Connection acknowledged!');
        if (message.payload?.connectionTimeoutMs) {
          this.logger.log(`   Timeout: ${message.payload.connectionTimeoutMs}ms`);
        }
        this.startSubscription();
        break;

      case 'start_ack':
        this.logger.log(`✅ Subscription acknowledged! ID: ${message.id}`);
        this.logger.log('   Now receiving market updates...');
        break;

      case 'ka':
        this.logger.debug('💓 Keepalive');
        break;

      case 'data':
        const payload = message.payload;
        const data = payload?.data;
        const update = data?.marketLineUpdate as RealtimeMessage;

        if (update && update.marketLines) {
          await this.processMarketLineUpdate(update);
        }
        break;

      case 'error':
        this.logger.error(`Subscription error: ${JSON.stringify(message)}`);
        break;

      default:
        this.logger.debug(`Unhandled message type: ${msgType}`);
    }
  }

  private async processMarketLineUpdate(update: RealtimeMessage): Promise<void> {
    const { leagueId, messageId, messageTimestamp, marketLines } = update;

    this.logger.log('📊 Market Update:');
    this.logger.log(`   League: ${leagueId}`);
    this.logger.log(`   Lines: ${marketLines.length}`);
    this.logger.log(`   Message: ${messageId}`);
    this.logger.log(`   Timestamp: ${messageTimestamp}`);

    for (const line of marketLines) {
      if (this.marketLineHandler) {
        try {
          await this.marketLineHandler(line);
        } catch (error) {
          this.logger.error(`Error in market line handler: ${error.message}`);
        }
      }
    }
  }

  private async reconnectBackoff(): Promise<void> {
    this.reconnectAttempts++;
    const backoffSeconds = Math.min(this.maxReconnectSec, Math.pow(2, this.reconnectAttempts));

    this.logger.log(`Reconnecting after ${backoffSeconds}s (attempt ${this.reconnectAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
  }

  close(): void {
    this.running = false;
    if (this.ws) {
      this.ws.close();
      this.logger.log('Realtime client closed');
    }
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
