import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ClinicAdminProfileService } from './clinic-admin-profile.service';
import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountRole } from '../enums';
import {
  UpdateClinicAdminOwnProfileDto,
  AccountResponseDto,
} from '../dto';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { MESSAGES } from 'src/common/message';

@ApiTags('Clinic Admin Profile')
@Controller('clinic-admin')
@ApiExtraModels(AccountResponseDto, UpdateClinicAdminOwnProfileDto)
export class ClinicAdminProfileController {
  constructor(private readonly profileService: ClinicAdminProfileService) {}

  /**
   * Get Own Profile
   * 
   * Retrieves the current profile information for the authenticated clinic admin.
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get clinic admin own profile information' })
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  async getProfile(
    @Request() req: any,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const adminId = req.user._id;
    const result = await this.profileService.getOwnProfile(adminId);

    return {
      data: result,
      message: MESSAGES.successMessage.userFetchSuccess,
    };
  }

  /**
   * Update Own Profile
   * 
   * Allows the authenticated Clinic Admin to update their own profile information.
   * Covers all fields in clinic_admin_information entity.
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update clinic admin own profile' })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUpdateSuccess,
  })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateClinicAdminOwnProfileDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const adminId = req.user._id;
    const result = await this.profileService.updateOwnProfile(
      adminId,
      dto,
    );

    return {
      data: result,
      message: MESSAGES.successMessage.userUpdateSuccess,
    };
  }
}
