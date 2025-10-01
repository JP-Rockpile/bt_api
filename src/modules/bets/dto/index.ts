import { IsString, IsNumber, IsOptional, IsObject, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BetStatus } from '@prisma/client';

export class PlanBetDto {
  @ApiProperty({ description: 'Market ID' })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Sportsbook ID' })
  @IsString()
  sportsbookId: string;

  @ApiProperty({ description: 'Selected outcome' })
  @IsString()
  selectedOutcome: string;

  @ApiPropertyOptional({ description: 'Stake amount (optional in planning phase)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stake?: number;

  @ApiPropertyOptional({ description: 'User intent/reasoning for bet' })
  @IsOptional()
  @IsString()
  userIntent?: string;

  @ApiPropertyOptional({ description: 'Additional context for LLM' })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class ConfirmBetDto {
  @ApiProperty({ description: 'Stake amount' })
  @IsNumber()
  @Min(0)
  stake: number;

  @ApiPropertyOptional({ description: 'LLM recommendation from planning phase' })
  @IsOptional()
  @IsObject()
  llmRecommendation?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'User notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateDeepLinkDto {
  @ApiPropertyOptional({ description: 'Additional parameters for deep link' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class UpdateBetStatusDto {
  @ApiProperty({ description: 'New bet status', enum: BetStatus })
  @IsEnum(BetStatus)
  status: BetStatus;
}
