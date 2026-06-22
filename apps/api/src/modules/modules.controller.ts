import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { ModulesService } from './modules.service';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  list(@CurrentUser() user: RequestContext) {
    return this.modules.list(user.tenantId, user.userId, user.roles);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  findOne(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.modules.findOne(id, user.tenantId, user.userId, user.roles);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: RequestContext) {
    return this.modules.create(dto as never, user.tenantId, user.userId);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    return this.modules.update(id, dto as never, user.tenantId, user.userId, user.roles);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.modules.remove(id, user.tenantId, user.userId, user.roles);
  }
}
