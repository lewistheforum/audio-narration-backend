import { ApiProperty } from "@nestjs/swagger";

export class UsernameEmailListDto {
    @ApiProperty({
        description: 'Danh sách username của tất cả user',
        example: ['user1', 'user2'],
        type: [String]
    })
    username: String[]

    @ApiProperty({
      description: 'Danh sách email tất cả user',
      example: ["user1@gmail.com", "user2@gmail.com"],
      type: [String]
    })
    email: String[]
}