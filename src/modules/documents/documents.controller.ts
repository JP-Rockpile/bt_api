import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all documents' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  async findAll(@Query('sourceType') sourceType?: string) {
    return this.documentsService.findAll(sourceType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document with chunks' })
  @ApiResponse({ status: 200, description: 'Document details' })
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post('search')
  @ApiOperation({
    summary: 'Semantic search using vector embeddings',
    description:
      'Accept query embedding from model service and return relevant document chunks with distance scores',
  })
  @ApiResponse({ status: 200, description: 'Relevant document chunks' })
  async vectorSearch(
    @Body('embedding') embedding: number[],
    @Body('limit') limit?: number,
    @Body('threshold') threshold?: number,
  ) {
    return this.documentsService.vectorSearch(embedding, limit, threshold);
  }
}
