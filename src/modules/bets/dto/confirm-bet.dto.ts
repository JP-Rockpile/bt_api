import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for confirming a bet - user has reviewed recommendation and is ready to lock it in
 * This creates the bet record and can generate a deep link
 */
export class ConfirmBetDto {
  @ApiProperty({
    description: 'Event ID',
    example: 'cm123abc456def789',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    description: 'Market ID',
    example: 'cm123xyz789abc456',
  })
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @ApiProperty({
    description: 'Sportsbook ID to place bet at',
    example: 'draftkings',
  })
  @IsString()
  @IsNotEmpty()
  sportsbookId: string;

  @ApiProperty({
    description: 'Selected outcome (e.g., "home", "away", "over", "under", team name)',
    example: 'home',
  })
  @IsString()
  @IsNotEmpty()
  selectedOutcome: string;

  @ApiProperty({
    description: 'Stake amount in dollars',
    example: 50,
    minimum: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  stake: number;

  @ApiProperty({
    description: 'American odds at confirmation time',
    example: -110,
  })
  @IsNumber()
  @Type(() => Number)
  oddsAmerican: number;

  @ApiPropertyOptional({
    description: 'User notes or reasoning for the bet',
    example: 'Following sharp money movement',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'LLM recommendation data from planning phase (for audit trail)',
  })
  @IsOptional()
  @IsObject()
  llmRecommendation?: Record<string, unknown>;
}
