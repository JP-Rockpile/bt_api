import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlanBetDto {
  @ApiProperty({ description: 'User betting intent/query', example: 'Bet $50 on Lakers moneyline' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({ description: 'Optional conversation context', required: false })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

