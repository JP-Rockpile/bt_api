import { Module } from '@nestjs/common';
import { SportsbooksService } from './sportsbooks.service';
import { SportsbooksController } from './sportsbooks.controller';

@Module({
  controllers: [SportsbooksController],
  providers: [SportsbooksService],
  exports: [SportsbooksService],
})
export class SportsbooksModule {}

