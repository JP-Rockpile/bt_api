import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for planning a bet - user expresses intent via natural language
 * This gets sent to the LLM for analysis and recommendation
 */
export class PlanBetDto {
  @ApiProperty({
    description: 'User betting intent/query in natural language',
    example: 'Bet $50 on Lakers moneyline against the Warriors tonight',
  })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiPropertyOptional({
    description: 'Market ID if user wants to bet on a specific market',
    example: 'cm123abc456def789',
  })
  @IsOptional()
  @IsString()
  marketId?: string;

  @ApiPropertyOptional({
    description: 'Preferred sportsbook ID',
    example: 'draftkings',
  })
  @IsOptional()
  @IsString()
  sportsbookId?: string;

  @ApiPropertyOptional({
    description: 'Stake amount user wants to bet (optional in planning)',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stake?: number;

  @ApiPropertyOptional({
    description: 'Additional context for the LLM (previous messages, user preferences, etc.)',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
