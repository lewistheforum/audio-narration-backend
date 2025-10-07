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
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CreateUserDto, 
  UpdateUserDto, 
  UserResponseDto,
  UserSuccessResponseDto,
  UsersSuccessResponseDto,
  DeleteSuccessResponseDto, } from './dto';
import { MESSAGES } from 'src/common/message';

@ApiTags('users')
@Controller('users')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all users' })
  @ApiResponse({
    status: 200,
    description: 'A list of users has been successfully retrieved.',
    type: UsersSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll() {
    const users = await this.userService.findAll();
    return { data: users, message: MESSAGES.successMessage.userFetchSuccess };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by their ID' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the user (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully found.',
    type: UserSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not Found. A user with the specified ID does not exist.' })
  async findOne(@Param('id') id: string) {
    const user = await this.userService.findOne(id);
    return { data: user, message: MESSAGES.successMessage.userFetchSuccess };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'The user has been successfully created.',
    type: UserSuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Input data validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Conflict. A user with this email already exists.' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { data: user, message: MESSAGES.successMessage.userCreateSuccess };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing user by their ID' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the user (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully updated.',
    type: UserSuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Input data validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not Found. A user with the specified ID does not exist.' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.userService.update(id, updateUserDto);
    return { data: user, message: MESSAGES.successMessage.userUpdateSuccess };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user by their ID' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the user (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully deleted.',
    type: DeleteSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not Found. A user with the specified ID does not exist.' })
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }
}
