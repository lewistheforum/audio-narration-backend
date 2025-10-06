import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User as MongoUser,
  type UserDocument,
} from '../../modules/user/schemas/user.schemas';
import { User as PostgresUser } from '../../modules/user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(MongoUser.name) private mongoUserModel: Model<UserDocument>,
    @InjectRepository(PostgresUser)
    private postgresUserRepository: Repository<PostgresUser>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const mongoUser = await this.mongoUserModel.findOne({ email }).exec();
    if (mongoUser && (await bcrypt.compare(password, mongoUser.password))) {
      const payload = { sub: mongoUser._id, email: mongoUser.email };
      return { access_token: this.jwtService.sign(payload) };
    }

    const postgresUser = await this.postgresUserRepository.findOne({
      where: { email },
    });
    if (
      postgresUser &&
      (await bcrypt.compare(password, postgresUser.password))
    ) {
      const payload = { sub: postgresUser.id, email: postgresUser.email };
      return { access_token: this.jwtService.sign(payload) };
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}
