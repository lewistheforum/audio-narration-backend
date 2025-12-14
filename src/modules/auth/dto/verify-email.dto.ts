import { ApiProperty, ApiResponse } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class VerifyEmailDto {
    @ApiProperty({
        description: 'Email dùng để đăng ký',
        example: 'user@gmail.com',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Mã xác thực 6 số được gửi qua email đăng ký',
        example: '123456',
    })
    @IsString()
    @Length(6, 6)
    code: string;
}