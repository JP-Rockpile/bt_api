import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Perform vector similarity search using pgvector
   */
  async search(queryEmbedding: number[], limit = 10, threshold = 0.7) {
    try {
      // Convert embedding array to pgvector format
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      // Use raw SQL for vector similarity search
      // Using cosine distance operator (<=>)
      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          document_id: string;
          content: string;
          chunk_index: number;
          metadata: unknown;
          similarity: number;
        }>
      >(
        `
        SELECT 
          c.id,
          c.document_id,
          c.content,
          c.chunk_index,
          c.metadata,
          d.title as document_title,
          d.source as document_source,
          d.source_url as document_source_url,
          1 - (c.embedding <=> $1::vector) as similarity
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> $1::vector
        LIMIT $2
      `,
        embeddingString,
        limit,
      );

      // Filter by threshold
      const filtered = results.filter((r) => r.similarity >= threshold);

      this.logger.log(
        `Vector search found ${filtered.length} results above threshold ${threshold}`,
      );

      return filtered.map((r) => ({
        id: r.id,
        documentId: r.document_id,
        content: r.content,
        chunkIndex: r.chunk_index,
        metadata: r.metadata,
        document: {
          title: r.document_title,
          source: r.document_source,
          sourceUrl: r.document_source_url,
        },
        similarity: parseFloat(r.similarity),
      }));
    } catch (error) {
      this.logger.error(`Vector search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update chunk embedding
   */
  async updateChunkEmbedding(chunkId: string, embedding: number[]) {
    const embeddingString = `[${embedding.join(',')}]`;

    await this.prisma.$executeRawUnsafe(
      `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
      embeddingString,
      chunkId,
    );

    this.logger.log(`Updated embedding for chunk ${chunkId}`);
  }
}
