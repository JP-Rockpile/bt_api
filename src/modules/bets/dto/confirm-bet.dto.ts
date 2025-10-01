import { IsString, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ConfirmBetDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ description: 'Market ID' })
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @ApiProperty({ description: 'Sportsbook ID' })
  @IsString()
  @IsNotEmpty()
  sportsbookId: string;

  @ApiProperty({ description: 'Selected outcome (e.g., home, away, over, under)' })
  @IsString()
  @IsNotEmpty()
  selectedOutcome: string;

  @ApiProperty({ description: 'Stake amount in dollars', example: 50 })
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  stake: number;

  @ApiProperty({ description: 'American odds at confirmation', example: -110 })
  @IsNumber()
  @Type(() => Number)
  oddsAmerican: number;
}

