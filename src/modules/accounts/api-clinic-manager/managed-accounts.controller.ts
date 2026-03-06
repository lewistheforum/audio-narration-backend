import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ManagedAccountsService } from './managed-accounts.service';
import { BanManagedAccountDto } from './dto/ban-managed-account.dto';
import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountRole } from '../enums/account-role.enum';

@ApiTags('Clinic Manager - Managed Accounts')
@Controller('clinic-manager/managed-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(AccountRole.CLINIC_MANAGER) // Only clinic managers can use these APIs
export class ManagedAccountsController {
  constructor(
    private readonly managedAccountsService: ManagedAccountsService,
  ) {}

  @Post(':id/ban')
  @ApiOperation({
    summary: 'Ban a managed account (doctor or staff)',
  })
  @ApiResponse({
    status: 200,
    description: 'Account banned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found or not owned by this manager',
  })
  async banAccount(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banDto: BanManagedAccountDto,
  ) {
    return this.managedAccountsService.banAccount(
      req.user._id,
      id,
      banDto.description,
    );
  }

  @Post(':id/unban')
  @ApiOperation({
    summary: 'Unban a managed account (doctor or staff)',
  })
  @ApiResponse({
    status: 200,
    description: 'Account unbanned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found or not owned by this manager',
  })
  async unbanAccount(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.managedAccountsService.unbanAccount(req.user._id, id);
  }

  @Get(':id/ban-history')
  @ApiOperation({ summary: 'Get ban history of a managed account' })
  @ApiResponse({
    status: 200,
    description: 'Ban history list',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found or not owned by this manager',
  })
  async getBanHistory(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.managedAccountsService.getBanHistory(req.user._id, id);
  }
}
