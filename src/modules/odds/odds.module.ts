import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OddsService } from './odds.service';
import { OddsController } from './odds.controller';
import { UnabatedAdapter } from './adapters/unabated.adapter';
import { TheOddsApiAdapter } from './adapters/theodds.adapter';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [OddsController],
  providers: [OddsService, UnabatedAdapter, TheOddsApiAdapter],
  exports: [OddsService],
})
export class OddsModule {}
