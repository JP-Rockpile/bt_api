import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OddsService } from './odds.service';
import { OddsController } from './odds.controller';
import { UnabatedAdapter } from './adapters/unabated.adapter';
import { TheOddsApiAdapter } from './adapters/theodds.adapter';
import { OddsQueryService } from './services/odds-query.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    EventsModule,
  ],
  controllers: [OddsController],
  providers: [OddsService, UnabatedAdapter, TheOddsApiAdapter, OddsQueryService],
  exports: [OddsService, OddsQueryService],
})
export class OddsModule {}
