import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MESSAGES } from '../../common/message';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return {
      message: MESSAGES.successMessage.userFetchSuccess,
      data: await this.usersService.findAll(),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return {
      message: MESSAGES.successMessage.userFetchSuccess,
      data: await this.usersService.findOne(id),
    };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return {
      message: MESSAGES.successMessage.userCreateSuccess,
      data: await this.usersService.create(createUserDto),
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return {
      message: MESSAGES.successMessage.userUpdateSuccess,
      data: await this.usersService.update(id, updateUserDto),
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return {
      message: MESSAGES.successMessage.userDeleteSuccess,
      data: await this.usersService.remove(id),
    };
  }
}
