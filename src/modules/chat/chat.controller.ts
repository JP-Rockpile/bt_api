import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return this.chatService.createConversation(
      userId,
      createConversationDto.title,
      createConversationDto.initialMessage,
      createConversationDto.metadata,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get user conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getUserConversations(userId);
  }

  @Get('conversations/:conversationId/history')
  @ApiOperation({ summary: 'Get conversation message history' })
  @ApiResponse({ status: 200, description: 'Conversation messages' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getConversationHistory(userId, conversationId, limit);
  }

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message created' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @Body('content') content: string,
  ) {
    return this.chatService.createMessage(userId, conversationId, 'USER', content);
  }

  @Sse('conversations/:conversationId/stream')
  @ApiOperation({
    summary: 'SSE endpoint for real-time chat updates',
    description:
      'Server-sent events stream for receiving LLM response chunks, system messages, and bet status updates',
  })
  streamChat(
    @CurrentUser('id') _userId: string,
    @Param('conversationId') _conversationId: string,
  ): Observable<MessageEvent> {
    // This is a simplified example
    // In production, this would:
    // 1. Establish connection to model service
    // 2. Stream LLM chunks
    // 3. Inject system messages (odds updates, bet status)
    // 4. Handle heartbeats and reconnection

    // For demonstration, sending heartbeat every 30 seconds
    return interval(30000).pipe(
      map((counter) => ({
        data: JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          counter,
        }),
      })),
    );
  }
}
