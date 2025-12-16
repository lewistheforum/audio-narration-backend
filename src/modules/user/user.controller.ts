import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Patch,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UpdatePasswordDto,
  UsernameEmailListDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';

@ApiTags('Users management')
@Controller('users')
@ApiExtraModels(UserResponseDto)
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all users' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
    isArray: true, // <-- Vì đây là một danh sách
  })
  async findAll() {
    const users = await this.userService.findAll();
    return { data: users, message: MESSAGES.successMessage.userFetchSuccess };
  }

  // Get user and email
  @Get('username-email-list')
  @ApiOperation({ summary: 'Get full list of usernames and emails' })
  @ApiResponseData({
    type: UsernameEmailListDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  async getUsernameEmailList() {
    const data = await this.userService.getUserEmailList();
    return {
      message: 'Successfully get the list of usernames and emails',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by their ID' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findOne(id);
    return { data: user, message: MESSAGES.successMessage.userFetchSuccess };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.created,
    message: MESSAGES.successMessage.userCreateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Conflict. Email already exists.' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { data: user, message: MESSAGES.successMessage.userCreateSuccess };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile information' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.created,
    message: MESSAGES.successMessage.userCreateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Conflict. Email already exists.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(id, updateUserDto);
    return { data: user, message: MESSAGES.successMessage.userUpdateSuccess };
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Update the password' })
  @ApiResponse({ status: 204, description: 'Password successfully updated.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    await this.userService.updatePassword(id, updatePasswordDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: MESSAGES.successMessage.userDeleteSuccess,
  })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.delete(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }
}
