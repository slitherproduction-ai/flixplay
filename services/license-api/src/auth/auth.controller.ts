import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: CredentialsDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: CredentialsDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Headers('authorization') authorization: string | undefined) {
    return this.auth.logout(authorization);
  }
}
