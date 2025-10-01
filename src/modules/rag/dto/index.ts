import { IsString, IsOptional, IsObject, IsArray, IsNumber, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({ description: 'Document title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Document source (e.g., betting_guide, historical_analysis)' })
  @IsString()
  source: string;

  @ApiPropertyOptional({ description: 'Source URL' })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiPropertyOptional({ description: 'Content type', default: 'text/plain' })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class CreateChunkDto {
  @ApiProperty({ description: 'Chunk content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Chunk index (position in document)' })
  @IsInt()
  @Min(0)
  chunkIndex: number;

  @ApiPropertyOptional({ description: 'Chunk metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class SearchDto {
  @ApiProperty({ description: 'Query embedding vector (from model service)' })
  @IsArray()
  @IsNumber({}, { each: true })
  queryEmbedding: number[];

  @ApiPropertyOptional({ description: 'Maximum number of results', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: 'Similarity threshold (0-1)', default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}

