import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { RagService } from './rag.service';
import { CreateDocumentDto, CreateChunkDto, SearchDto } from './dto';

@ApiTags('rag')
@Controller('rag')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('Auth0')
export class RagController {
  constructor(private ragService: RagService) {}

  @Post('documents')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new document (admin only)' })
  @ApiResponse({ status: 201, description: 'Document created' })
  createDocument(@Body() createDto: CreateDocumentDto) {
    return this.ragService.createDocument(createDto);
  }

  @Post('documents/:documentId/chunks')
  @Roles('admin')
  @ApiOperation({ summary: 'Add a chunk to a document (admin only)' })
  @ApiResponse({ status: 201, description: 'Chunk created' })
  createChunk(@Param('documentId') documentId: string, @Body() createDto: CreateChunkDto) {
    return this.ragService.createChunk(documentId, createDto);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get all documents' })
  @ApiQuery({ name: 'source', required: false })
  @ApiResponse({ status: 200, description: 'Documents retrieved' })
  getDocuments(@Query('source') source?: string) {
    return this.ragService.getDocuments(source);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get document by ID with all chunks' })
  @ApiResponse({ status: 200, description: 'Document retrieved' })
  getDocument(@Param('id') id: string) {
    return this.ragService.getDocument(id);
  }

  @Delete('documents/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete document and all its chunks (admin only)' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  deleteDocument(@Param('id') id: string) {
    return this.ragService.deleteDocument(id);
  }

  @Post('search')
  @ApiOperation({
    summary: 'Search for similar chunks using vector similarity',
    description: 'Accepts a query embedding from the model service and returns relevant chunks',
  })
  @ApiResponse({ status: 200, description: 'Similar chunks retrieved' })
  searchSimilarChunks(@Body() searchDto: SearchDto) {
    return this.ragService.searchSimilarChunks(
      searchDto.queryEmbedding,
      searchDto.limit,
      searchDto.threshold,
    );
  }
}
