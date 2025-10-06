import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as PostgresUser } from '../../modules/user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(PostgresUser)
    private postgresUserRepository: Repository<PostgresUser>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

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
