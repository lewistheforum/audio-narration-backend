import { ApiProperty } from "@nestjs/swagger";

export class UsernameEmailListDto {
    @ApiProperty({
        description: 'List of all usernames',
        example: ['user1', 'user2'],
        type: [String]
    })
    username: String[]

    @ApiProperty({
      description: 'List of all user emails',
      example: ["user1@gmail.com", "user2@gmail.com"],
      type: [String]
    })
    email: String[]
}
