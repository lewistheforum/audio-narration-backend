import { Injectable, OnModuleInit, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.seedAdminUser();
  }

  private async seedAdminUser() {
    try {
      const email = 'hieu@gmail.com';
      const existingUser = await this.userModel.findOne({ email });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash('audio123@', 10);
        await this.userModel.create({
          username: 'admin',
          email,
          password: hashedPassword,
        });
        this.logger.log(`Seed user created: ${email}`);
      } else {
        this.logger.log(`Seed user already exists: ${email}`);
      }
    } catch (error) {
      this.logger.error('Failed to seed admin user', error);
    }
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = await this.userModel.findOne({ username });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user._id, username: user.username, email: user.email };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    };
  }
}
