import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Search documents using vector similarity
   */
  async vectorSearch(embedding: number[], limit: number = 10, threshold: number = 0.8) {
    return this.prisma.vectorSearch(embedding, limit, threshold);
  }

  /**
   * Get all active documents
   */
  async findAll(sourceType?: string) {
    const where: any = { isActive: true };

    if (sourceType) {
      where.sourceType = sourceType;
    }

    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
          },
        },
      },
    });
  }

  /**
   * Get document by ID with chunks
   */
  async findOne(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
  }
}

