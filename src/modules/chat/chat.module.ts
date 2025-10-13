import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SseService } from './services/sse.service';
import { DatabaseModule } from '../../common/database/database.module';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';
import { OddsModule } from '../odds/odds.module';
import { EventsModule } from '../events/events.module';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';

@Module({
  imports: [DatabaseModule, LlmModule, RagModule, OddsModule, EventsModule],
  controllers: [ChatController],
  providers: [ChatService, SseService, ChatOrchestratorService],
  exports: [ChatService, SseService, ChatOrchestratorService],
})
export class ChatModule {}
