import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  controllers: [RagController],
  providers: [RagService, VectorSearchService],
  exports: [RagService, VectorSearchService],
})
export class RagModule {}
