import { IsOptional, IsObject, IsArray, IsString, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User preferences as JSON object' })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Expo push notification device tokens' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceTokens?: string[];
}

export class LinkSportsbookDto {
  @ApiProperty({ description: 'Sportsbook ID to link' })
  @IsString()
  sportsbookId: string;

  @ApiPropertyOptional({ description: 'User preference order (lower = higher priority)' })
  @IsOptional()
  @IsNumber()
  preferenceOrder?: number;

  @ApiPropertyOptional({ description: 'Whether user has verified account' })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
