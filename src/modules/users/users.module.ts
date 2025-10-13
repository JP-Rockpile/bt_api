import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../../common/database/database.module';
import { AuthModule } from '../../common/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
