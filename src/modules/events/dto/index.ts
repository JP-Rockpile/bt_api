import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetEventsDto {
  @ApiPropertyOptional({ description: 'Filter by sport (e.g., NFL, NBA, MMA)' })
  @IsOptional()
  @IsString()
  sport?: string;

  @ApiPropertyOptional({ description: 'Filter by league' })
  @IsOptional()
  @IsString()
  league?: string;

  @ApiPropertyOptional({ description: 'Filter by event status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by start time (from)' })
  @IsOptional()
  @IsDateString()
  startTimeFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by start time (to)' })
  @IsOptional()
  @IsDateString()
  startTimeTo?: string;

  @ApiPropertyOptional({ description: 'Number of results to return', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
