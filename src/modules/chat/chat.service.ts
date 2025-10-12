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

    // If an initial message is provided, create it
    if (initialMessage) {
      await this.createMessage(userId, conversationId, 'USER', initialMessage, {
        title,
        ...metadata,
      });
    }

    return {
      conversationId,
      title,
      createdAt: new Date().toISOString(),
      metadata,
    };
  }

  async getConversationHistory(userId: string, conversationId: string, limit: number = 50) {
    return this.prisma.message.findMany({
      where: {
        userId,
        conversationId,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
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
