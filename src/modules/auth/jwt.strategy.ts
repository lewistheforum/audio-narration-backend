import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User as MongoUser,
  type UserDocument,
} from '../user/schemas/user.schemas';
import { User as PostgresUser } from '../user/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(MongoUser.name) private mongoUserModel: Model<UserDocument>,
    @InjectRepository(PostgresUser)
    private postgresUserRepository: Repository<PostgresUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const mongoUser = await this.mongoUserModel
      .findOne({ email: payload.email })
      .exec();
    const postgresUser = await this.postgresUserRepository.findOne({
      where: { email: payload.email },
    });

    if (!mongoUser && !postgresUser) {
      return null;
    }

    return { id: payload.sub, email: payload.email };
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
