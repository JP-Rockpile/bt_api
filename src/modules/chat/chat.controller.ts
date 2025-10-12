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
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SseService } from './services/sse.service';
import { CreateConversationDto } from './dto';
import { Observable } from 'rxjs';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private sseService: SseService,
  ) {}

  @Post('conversations')
  @HttpCode(201)
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
    @Query('limit') limitParam?: string,
  ) {
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
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
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
  ): Observable<MessageEvent> {
    // Create and return the SSE stream for this user's conversation
    // This handles:
    // 1. Connection establishment with heartbeats
    // 2. LLM response streaming
    // 3. System messages (odds updates, bet status)
    // 4. Automatic cleanup on disconnect
    return this.sseService.createStream(userId, conversationId);
  }
}
