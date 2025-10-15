import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SseService } from './services/sse.service';
import { DatabaseModule } from '../../common/database/database.module';
import { AuthModule } from '../../common/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService, SseService],
  exports: [ChatService, SseService],
})
export class ChatModule {}
