import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Sse,
  MessageEvent,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { SseAuthGuard } from '../../common/auth/guards/sse-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { SseHeadersInterceptor } from '../../common/interceptors/sse-headers.interceptor';
import { ChatService } from './chat.service';
import { SseService } from './services/sse.service';
import { BtModelProxyService } from './services/bt-model-proxy.service';
import { BtModelClientService } from './services/bt-model-client.service';
import { CreateConversationDto } from './dto';
import { Observable } from 'rxjs';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private sseService: SseService,
    private btModelProxy: BtModelProxyService,
    private btModelClient: BtModelClientService,
  ) {}

  @Post('conversations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createConversation(
      userId,
      createConversationDto.title,
      createConversationDto.initialMessage,
      createConversationDto.metadata,
    );

    // If there was an initial message, stream AI response via SSE
    if (createConversationDto.initialMessage) {
      this.streamAIResponse(userId, conversation.id, createConversationDto.initialMessage);
    }

    return conversation;
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
    this.logger.log(
      `📨 Message received - User: ${userId}, Conversation: ${conversationId}, Content: "${content}"`,
    );

    // Persist the user message
    const saved = await this.chatService.createMessage(userId, conversationId, 'USER', content);
    this.logger.log(`✅ User message saved to database`);

    // Stream response from bt_model (or placeholder if bt_model is disabled)
    // This will:
    // 1. Stream response chunks via SSE (llm_chunk events)
    // 2. Send completion signal (llm_complete event)
    // 3. Persist final response to database
    this.logger.log(`🤖 Triggering AI response for user ${userId}`);
    this.streamAIResponse(userId, conversationId, content);

    return saved;
  }

  /**
   * Stream AI response from bt_model (or placeholder if bt_model is disabled)
   * Handles both production (bt_model) and development (placeholder) scenarios
   */
  private async streamAIResponse(
    userId: string,
    conversationId: string,
    userMessage: string,
  ) {
    this.logger.log(
      `🎬 streamAIResponse STARTED - User: ${userId}, Conv: ${conversationId}`,
    );

    // Don't await - send response asynchronously via SSE
    setTimeout(async () => {
      try {
        // Check if bt_model is enabled
        if (this.btModelClient.isEnabled()) {
          this.logger.log(`🤖 Streaming response from bt_model`);
          await this.btModelProxy.streamResponse(userId, conversationId, userMessage);
        } else {
          // Fallback to placeholder response for development
          this.logger.log(`⚠️ bt_model disabled, using placeholder response`);
          await this.sendPlaceholderResponse(userId, conversationId, userMessage);
        }
      } catch (error) {
        // Log error but don't fail the original request
        this.logger.error('❌ Error streaming AI response:', error);
        console.error('Error streaming AI response:', error);

        // Send error via SSE
        this.sseService.sendToStream(userId, conversationId, {
          type: 'error',
          message: 'Failed to generate response',
          timestamp: new Date().toISOString(),
        });
      }
    }, 500); // Small delay to ensure SSE connection is established
  }

  /**
   * Placeholder response for development when bt_model is disabled
   * Simulates LLM streaming response via SSE
   */
  private async sendPlaceholderResponse(
    userId: string,
    conversationId: string,
    userMessage: string,
  ) {
    this.logger.log(`📝 Sending placeholder response`);

    const placeholderResponse = `I received your message: "${userMessage}". This is a placeholder response. Enable bt_model by setting BT_MODEL_ENABLED=true in your .env file.`;

    // Simulate streaming by sending chunks
    const words = placeholderResponse.split(' ');
    let chunkCount = 0;

    for (const word of words) {
      const chunk = word + ' ';
      chunkCount++;

      // Send each word as a chunk via SSE
      this.logger.debug(
        `📤 Sending chunk ${chunkCount}/${words.length}: "${chunk.trim()}" to ${userId}:${conversationId}`,
      );
      this.sseService.sendLLMChunk(userId, conversationId, chunk);

      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Send completion signal
    this.logger.log(`🏁 Sending llm_complete event`);
    this.sseService.sendLLMComplete(userId, conversationId, placeholderResponse.trim(), {
      model: 'placeholder',
      tokensUsed: words.length,
    });

    // Persist the assistant response to database
    this.logger.log(`💾 Persisting assistant response to database`);
    await this.chatService.createMessage(
      userId,
      conversationId,
      'ASSISTANT',
      placeholderResponse.trim(),
    );
    this.logger.log(`✅ Placeholder response complete!`);
  }

  @Sse('conversations/:conversationId/stream')
  @UseGuards(SseAuthGuard) // Use SSE-specific auth guard instead of controller-level guard
  @UseInterceptors(SseHeadersInterceptor)
  @ApiOperation({
    summary: 'SSE endpoint for real-time chat updates',
    description:
      'Server-sent events stream for receiving LLM response chunks, system messages, and bet status updates. ' +
      'This is a long-lived connection that should remain open while the user is viewing the conversation. ' +
      'The frontend can send messages via POST to /messages while this stream is active. ' +
      'Authentication can be provided via Authorization header (preferred) or token query parameter (for browsers).',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description:
      'JWT token for authentication (alternative to Authorization header for browser EventSource)',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established. Connection will remain open.',
    headers: {
      'Content-Type': {
        description: 'text/event-stream',
        schema: { type: 'string' },
      },
      'Cache-Control': {
        description: 'no-cache, no-transform',
        schema: { type: 'string' },
      },
      Connection: {
        description: 'keep-alive',
        schema: { type: 'string' },
      },
    },
  })
  streamChat(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
  ): Observable<MessageEvent> {
    this.logger.log(`SSE stream requested for user ${userId}, conversation ${conversationId}`);

    // Create and return the SSE stream for this user's conversation
    // This handles:
    // 1. Connection establishment with heartbeats
    // 2. LLM response streaming
    // 3. System messages (odds updates, bet status)
    // 4. Automatic cleanup on disconnect
    return this.sseService.createStream(userId, conversationId);
  }
}
