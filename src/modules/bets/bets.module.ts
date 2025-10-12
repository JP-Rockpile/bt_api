import { Module } from '@nestjs/common';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';
import { DeepLinkService } from './services/deep-link.service';

@Module({
  controllers: [BetsController],
  providers: [BetsService, DeepLinkService],
  exports: [BetsService],
})
export class BetsModule {}
