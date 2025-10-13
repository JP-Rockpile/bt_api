import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetBestPriceDto {
  @ApiProperty({ example: 'MLB', description: 'Sport/League identifier' })
  @IsString()
  league: string;

  @ApiProperty({ example: 'Brewers', description: 'Team name (fuzzy matched)' })
  @IsString()
  team: string;

  @ApiProperty({ example: '2025-10-13', description: 'ISO date for the game', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ enum: ['moneyline', 'spread', 'total'], example: 'moneyline' })
  @IsEnum(['moneyline', 'spread', 'total'])
  market: 'moneyline' | 'spread' | 'total';

  @ApiProperty({ description: 'Opponent team (optional, helps narrow down)', required: false })
  @IsOptional()
  @IsString()
  opponent?: string;
}
