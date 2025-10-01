import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OddsIngestionProcessor } from './processors/odds-ingestion.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { QueueService } from './queue.service';
import { OddsModule } from '@modules/odds/odds.module';
import { BetsModule } from '@modules/bets/bets.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'odds-ingestion' },
      { name: 'notifications' },
      { name: 'analytics' },
    ),
    OddsModule,
    BetsModule,
  ],
  providers: [
    QueueService,
    OddsIngestionProcessor,
    NotificationsProcessor,
    AnalyticsProcessor,
  ],
  exports: [QueueService],
})
export class QueueModule {}

