import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private toResponse(user: UserDocument) {
    const plain = user.toObject ? user.toObject() : user;
    const { password, ...safeUser } = plain as any;
    return safeUser;
  }

  private async assertUnique(username?: string, email?: string, excludeId?: string) {
    const checks = [username ? { username } : null, email ? { email } : null].filter(Boolean);
    if (!checks.length) return;

    const existingUser = await this.userModel.findOne({
      _id: { $ne: excludeId },
      deletedAt: { $exists: false },
      $or: checks,
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }
  }

  async findAll() {
    const users = await this.userModel
      .find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 });
    return users.map((user) => this.toResponse(user));
  }

  async findOne(id: string) {
    const user = await this.userModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponse(user);
  }

  async create(createUserDto: CreateUserDto) {
    const { username, email, phone, password } = createUserDto;
    await this.assertUnique(username, email);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({
      username,
      email,
      phone,
      password: hashedPassword,
    });

    return this.toResponse(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.assertUnique(updateUserDto.username, updateUserDto.email, id);

    if (updateUserDto.username !== undefined) user.username = updateUserDto.username;
    if (updateUserDto.email !== undefined) user.email = updateUserDto.email;
    if (updateUserDto.phone !== undefined) user.phone = updateUserDto.phone;
    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    await user.save();
    return this.toResponse(user);
  }

  async remove(id: string) {
    const user = await this.userModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.deletedAt = new Date();
    await user.save();
    return this.toResponse(user);
  }
}
