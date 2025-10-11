import { 
  IsString, 
  IsOptional, 
  IsObject, 
  IsEnum, 
  IsInt, 
  Min, 
  Max,
  IsNotEmpty 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageRole, MessageIntent } from '@betthink/shared';

/**
 * DTO for creating a new conversation
 * Maps to shared Conversation type
 */
export class CreateConversationDto {
  @ApiPropertyOptional({ 
    description: 'Optional title for the conversation',
    example: 'Lakers vs Warriors Betting Strategy' 
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ 
    description: 'Optional initial message content to start the conversation',
    example: 'Should I bet on the Lakers tonight?' 
  })
  @IsOptional()
  @IsString()
  initialMessage?: string;

  @ApiPropertyOptional({ 
    description: 'Additional metadata (e.g., related event, sport, etc.)' 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for creating a message in a conversation
 * Maps to shared Message type
 */
export class CreateMessageDto {
  @ApiProperty({ 
    description: 'Conversation ID',
    example: 'cm123abc456def789'
  })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({ 
    description: 'Message role - who is sending this message',
    enum: MessageRole,
    example: 'USER'
  })
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiProperty({ 
    description: 'Message content',
    example: 'What are the best odds for Lakers moneyline?'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ 
    description: 'Token count for tracking usage',
    example: 150
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenCount?: number;

  @ApiPropertyOptional({ 
    description: 'Message intent for classification',
    enum: MessageIntent
  })
  @IsOptional()
  @IsEnum(MessageIntent)
  intent?: MessageIntent;

  @ApiPropertyOptional({ 
    description: 'Additional metadata (attachments, citations, etc.)' 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for retrieving messages with pagination
 */
export class GetMessagesDto {
  @ApiPropertyOptional({ 
    description: 'Filter by conversation ID',
    example: 'cm123abc456def789'
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by role',
    enum: MessageRole
  })
  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole;

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: ['asc', 'desc'], 
    default: 'desc' 
  })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ 
    description: 'Number of results per page', 
    default: 50,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ 
    description: 'Offset for pagination', 
    default: 0,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
