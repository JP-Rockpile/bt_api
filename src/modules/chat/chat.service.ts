import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { MessageRole as PrismaMessageRole, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { MessageRole } from '@betthink/shared';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async createConversation(
    userId: string,
    title?: string,
    initialMessage?: string,
    metadata?: Record<string, unknown>,
  ) {
    const conversationId = createId();
    const now = new Date().toISOString();
    let messageCount = 0;
    let lastMessageAt: string | null = null;

    // If an initial message is provided, create it
    if (initialMessage) {
      await this.createMessage(userId, conversationId, 'USER', initialMessage, {
        title,
        ...metadata,
      });
      messageCount = 1;
      lastMessageAt = now;

      // NOTE: The assistant response will be sent via SSE by the controller
      // and persisted asynchronously. Don't create placeholder here.
    }

    // Return conversation in the format expected by mobile app
    return {
      id: conversationId,
      userId,
      title: title || '',
      createdAt: now,
      updatedAt: now,
      lastMessageAt,
      messageCount,
    };
  }

  async getConversationHistory(userId: string, conversationId: string, limit: number = 50) {
    const messages = await this.prisma.message.findMany({
      where: {
        userId,
        conversationId,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    // Map database fields to frontend-expected format
    return messages.map((message) => ({
      id: message.id,
      chatId: message.conversationId, // Frontend expects 'chatId' not 'conversationId'
      role: message.role.toLowerCase(), // Convert 'USER' to 'user', 'ASSISTANT' to 'assistant'
      content: message.content,
      timestamp: message.createdAt.toISOString(), // Frontend expects 'timestamp' not 'createdAt'
      metadata: message.metadata || {},
    }));
  }

  async createMessage(
    userId: string,
    conversationId: string,
    role: MessageRole | PrismaMessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    // Convert shared MessageRole to Prisma MessageRole if needed
    const prismaRole = typeof role === 'string' ? (role as PrismaMessageRole) : role;

    this.logger.log(`Creating message in conversation ${conversationId} with role ${prismaRole}`);

    return this.prisma.message.create({
      data: {
        userId,
        conversationId,
        role: prismaRole,
        content,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async getUserConversations(userId: string) {
    // Get all conversation IDs with their latest message
    const conversations = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: { userId },
      _max: { createdAt: true },
      _count: { id: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    // Get the latest message for each conversation
    const conversationDetails = await Promise.all(
      conversations.map(async (conv) => {
        const latestMessage = await this.prisma.message.findFirst({
          where: {
            userId,
            conversationId: conv.conversationId,
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          conversationId: conv.conversationId,
          messageCount: conv._count.id,
          lastMessageAt: conv._max.createdAt,
          preview: latestMessage?.content.substring(0, 100),
        };
      }),
    );

    return conversationDetails;
  }
}
