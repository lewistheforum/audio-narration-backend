import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
  CreateUserDto,
  UpdatePasswordDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';
import { In } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find();
    return users.map((user) => new UserResponseDto(user));
  }

  public async findUserEntityById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
    return user;
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.findUserEntityById(id);
    return new UserResponseDto(user);
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if user with email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const salt = await bcrypt.genSalt(10); //Standard cost factor
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);
    createUserDto.password = hashedPassword;

    const user = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);
    return new UserResponseDto(savedUser);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.findUserEntityById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUserWithEmail = await this.findByEmail(updateUserDto.email);
      if (existingUserWithEmail && existingUserWithEmail.id !== id) {
        throw new ConflictException(MESSAGES.failMessage.emailAlreadyExists);
      }
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    return new UserResponseDto(updatedUser);
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { oldPassword, newPassword } = updatePasswordDto;

    const user = await this.findUserEntityById(userId);

    const isPasswordMatching = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException(MESSAGES.failMessage.incorrectPassword);
    }
    if (oldPassword === newPassword) {
      throw new ConflictException(MESSAGES.failMessage.newPasswordSameAsOld);
    }

    const salt = await bcrypt.genSalt(10); //Standard cost factor
    user.password = await bcrypt.hash(newPassword, salt);

    await this.userRepository.save(user);
  }

  async delete(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.userRepository.find({
      where: { id: In(ids) },
    });
  }
}
