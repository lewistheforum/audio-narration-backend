import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Gender } from 'src/common/enum/gender.erum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  name: string;

  @Column({default: false})
  isOAuthUser: boolean;

  @Column({nullable: true}) 
  googleId: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({
    nullable: true,
    default:
      'https://cdn-icons-png.flaticon.com/512/847/847969.png',
  })
  profilePicture: string;

  @Column({type: 'enum', enum: Gender, nullable: true})
  gender: Gender;

  @Column({type: 'date', nullable: true})
  dateOfBirth: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
