import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../strategies/auth0.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

