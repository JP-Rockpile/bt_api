import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UnabatedService } from './services/unabated.service';
import { RestSnapshotService } from './services/rest-snapshot.service';
import { RealtimeService } from './services/realtime.service';
import { DataNormalizerService } from './services/data-normalizer.service';
import { MarketParserService } from './services/market-parser.service';
import { UnabatedController } from './unabated.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [UnabatedController],
  providers: [
    UnabatedService,
    RestSnapshotService,
    RealtimeService,
    DataNormalizerService,
    MarketParserService,
  ],
  exports: [UnabatedService, MarketParserService],
})
export class UnabatedModule {}
