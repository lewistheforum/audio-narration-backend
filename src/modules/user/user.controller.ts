import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CreateUserDto, UpdateUserDto } from './dto';
import { MESSAGES } from 'src/common/message';

@ApiTags('users')
@Controller('users')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: 'Return all users.',
  })
  async findAll() {
    const users = await this.userService.findAll();
    return { data: users, message: MESSAGES.successMessage.userFetchSuccess };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: 'Return user.',
  })
  async findOne(@Param('id') id: string) {
    const user = await this.userService.findOne(id);
    return { data: user, message: MESSAGES.successMessage.userFetchSuccess };
  }

  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({
    status: MESSAGES.statusCode.created,
    description: 'User created successfully.',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { data: user, message: MESSAGES.successMessage.userCreateSuccess };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: 'User updated successfully.',
  })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.userService.update(id, updateUserDto);
    return { data: user, message: MESSAGES.successMessage.userUpdateSuccess };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: 'User deleted successfully.',
  })
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }
}
