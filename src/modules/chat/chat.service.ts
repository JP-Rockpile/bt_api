import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { MessageRole, Prisma } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

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
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.message.create({
      data: {
        userId,
        conversationId,
        role,
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
