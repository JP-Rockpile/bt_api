import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SseService } from './services/sse.service';
import { BtModelClientService } from './services/bt-model-client.service';
import { BtModelProxyService } from './services/bt-model-proxy.service';
import { DatabaseModule } from '../../common/database/database.module';
import { AuthModule } from '../../common/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule, ConfigModule],
  controllers: [ChatController],
  providers: [ChatService, SseService, BtModelClientService, BtModelProxyService],
  exports: [ChatService, SseService, BtModelClientService, BtModelProxyService],
})
export class ChatModule {}
