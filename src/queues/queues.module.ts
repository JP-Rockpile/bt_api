import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';

// Queue processors
import { OddsIngestionProcessor } from './processors/odds-ingestion.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';

// Services needed by processors
import { OddsModule } from '../modules/odds/odds.module';

@Module({
  imports: [
    HttpModule,
    OddsModule,

    // Register BullMQ queues
    BullModule.registerQueue(
      {
        name: 'odds-ingestion',
      },
      {
        name: 'notifications',
      },
      {
        name: 'analytics',
      },
    ),
  ],
  providers: [OddsIngestionProcessor, NotificationsProcessor, AnalyticsProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
