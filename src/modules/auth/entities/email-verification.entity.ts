import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/modules/user/entities/user.entity';
import { VerificationPurpose } from 'src/common/enum/verification-purpose.enum';

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  code: string; 

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @Column({
    type: 'enum',
    enum: VerificationPurpose,
    default: VerificationPurpose.REGISTER,
  })
  purpose: VerificationPurpose;

  @CreateDateColumn()
  createdAt: Date;
}
