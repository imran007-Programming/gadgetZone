import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'imran@example.com' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    example: 'StrongPass1',
    description:
      'At least 8 characters, with one uppercase letter, one lowercase letter and one digit',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must include at least one uppercase letter, one lowercase letter and one digit',
  })
  password: string;

  @ApiProperty({ example: 'Imran Hasan' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;
}
