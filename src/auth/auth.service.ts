import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable({})
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService
  ) {}
  async signin(dto: AuthDto) {
    //check if user exist in database
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });
    //if not throw exception
    if (!user) {
      throw new ForbiddenException('Credential incorrect!');
    }

    //check the password
    const pwMatches = await argon.verify(user.hash, dto.password);
    //if not matched throw exception
    if (!pwMatches) {
      throw new ForbiddenException('Credentials incorrect!');
    }

    //send back the user

    return this.signToken(user.id, user.email);
  }

  async signup(dto: AuthDto) {
    //generate the password hash
    const hash = await argon.hash(dto.password);

    //save new user in the db
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash
        }
      });

      //send jwt
      return this.signToken(user.id, user.email);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code == 'P2002') {
          throw new ForbiddenException('Credentials Taken');
        }
      } else {
        console.error(error);
      }
    }
  }

  async signToken(
    userId: number,
    email: string
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email
    };

    const secret = this.config.get('JWT_SECRET');
    const token = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
      secret: secret
    });

    return {
      access_token: token
    };
  }
}
