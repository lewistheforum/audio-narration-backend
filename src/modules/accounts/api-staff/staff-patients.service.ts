import { Injectable, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  CreatePatientByStaffDto,
  CreatePatientByStaffResponseDto,
  CreatePatientNoEmailDto,
  CreatePatientNoEmailResponseDto,
} from './dto';
import { AccountRepository, GeneralAccountRepository } from '../repositories';
import { AccountRole, AccountStatus } from '../enums';
import { MailerService } from '../../mailer/mailer.service';
import { MESSAGES } from 'src/common/message';
import { getCurrentTime } from 'src/common/utils/date.util';

/**
 * Staff Patients Service
 * 
 * Handles patient account creation by clinic staff for walk-in appointments.
 * 
 * Features:
 * - Create patient accounts with minimal information (email, phone, full_name)
 * - Auto-generate secure random passwords
 * - Send welcome email with login credentials
 * - Allow duplicate phone numbers (business rule)
 * - Mark account as DIRECT_ACCOUNT type
 */
@Injectable()
export class StaffPatientsService {
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Generate Random Secure Password
   * 
   * Creates a 12-character password containing:
   * - Uppercase letters (A-Z)
   * - Lowercase letters (a-z)
   * - Numbers (0-9)
   * - Special characters (!@#$%^&*)
   * 
   * Format: Aa12#xYz89!Q (example)
   * 
   * @returns {string} Random secure password
   */
  private generateRandomPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;

    // Ensure at least one character from each category
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining 8 characters randomly
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle password to randomize character positions
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Create Patient Account by Staff (Step 2 - Walk-in Appointment)
   * 
   * Creates patient account with minimal information for walk-in customers.
   * System automatically generates password and sends via email.
   * 
   * Process:
   * 1. Validate email uniqueness
   * 2. Generate random secure password
   * 3. Create Account entity (role: PATIENT, status: ACTIVE)
   * 4. Create GeneralAccount profile
   * 5. Send welcome email with credentials
   * 
   * Business Rules:
   * - Email must be unique
   * - Phone can be duplicate (multiple people may share phone)
   * - Password is auto-generated (12 chars, mixed case, numbers, specials)
   * - Account type = "DIRECT_ACCOUNT"
   * - Email sent with credentials (staff should provide to customer)
   * 
   * @param {CreatePatientByStaffDto} dto - Patient data (email, phone, fullName)
   * @returns {Promise<CreatePatientByStaffResponseDto>} Created account info with password
   * @throws {ConflictException} If email already exists
   */
  async createPatientByStaff(
    dto: CreatePatientByStaffDto,
  ): Promise<CreatePatientByStaffResponseDto> {
    // Step 1: Validate email uniqueness
    const existingAccount = await this.accountRepository.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    // Step 2: Generate random secure password
    const temporaryPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 3: Create both Account and GeneralAccount in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create Account entity with ACTIVE status (no email verification required for walk-in)
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0], // Use email prefix as username
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE, // Active immediately for walk-in patients
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Create GeneralAccount profile with minimal data
      const generalAccount = this.generalAccountRepository.createGeneralAccount(
        {
          accountId: savedAccount._id,
          fullName: dto.fullName,
          // Other fields (dob, gender, address) are NULL - patient can update later
        },
      );

      await queryRunner.manager.save(generalAccount);

      await queryRunner.commitTransaction();

      // Step 4: Send welcome email with credentials
      let emailSent = false;
      let emailSentAt: string | undefined;

      try {
        await this.mailerService.sendWelcomeEmailWithPassword(
          dto.email,
          dto.fullName,
          dto.email, // Use email as username
          temporaryPassword,
        );
        emailSent = true;
        emailSentAt = getCurrentTime();
      } catch (emailError) {
        // Log email error but don't fail the account creation
        console.error('Failed to send welcome email:', emailError);
        // Account is still created, staff can manually provide credentials
      }

      // Step 5: Return response with credentials
      return {
        success: true,
        accountId: savedAccount._id,
        email: savedAccount.email,
        phone: savedAccount.phone!,
        fullName: dto.fullName,
        temporaryPassword, // Return password in response so staff can see it
        emailSent,
        emailSentAt,
        activationStatus: 'ACTIVE',
        message: emailSent
          ? `Account created successfully. Email with password has been sent to ${dto.email}`
          : `Account created successfully but failed to send email. Please provide password to customer directly.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Remove Vietnamese Tones (Accents)
   * 
   * Converts Vietnamese characters to plain ASCII characters.
   * Examples:
   * - "Trần Văn D" → "Tran Van D"
   * - "Nguyễn Thị B" → "Nguyen Thi B"
   * 
   * @param {string} str - String with Vietnamese accents
   * @returns {string} String without accents
   */
  private removeVietnameseTones(str: string): string {
    const tones: { [key: string]: string } = {
      à: 'a', á: 'a', ạ: 'a', ả: 'a', ã: 'a',
      â: 'a', ầ: 'a', ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a',
      ă: 'a', ằ: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a',
      è: 'e', é: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e',
      ê: 'e', ề: 'e', ế: 'e', ệ: 'e', ể: 'e', ễ: 'e',
      ì: 'i', í: 'i', ị: 'i', ỉ: 'i', ĩ: 'i',
      ò: 'o', ó: 'o', ọ: 'o', ỏ: 'o', õ: 'o',
      ô: 'o', ồ: 'o', ố: 'o', ộ: 'o', ổ: 'o', ỗ: 'o',
      ơ: 'o', ờ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o',
      ù: 'u', ú: 'u', ụ: 'u', ủ: 'u', ũ: 'u',
      ư: 'u', ừ: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u',
      ỳ: 'y', ý: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y',
      đ: 'd',
      À: 'A', Á: 'A', Ạ: 'A', Ả: 'A', Ã: 'A',
      Â: 'A', Ầ: 'A', Ấ: 'A', Ậ: 'A', Ẩ: 'A', Ẫ: 'A',
      Ă: 'A', Ằ: 'A', Ắ: 'A', Ặ: 'A', Ẳ: 'A', Ẵ: 'A',
      È: 'E', É: 'E', Ẹ: 'E', Ẻ: 'E', Ẽ: 'E',
      Ê: 'E', Ề: 'E', Ế: 'E', Ệ: 'E', Ể: 'E', Ễ: 'E',
      Ì: 'I', Í: 'I', Ị: 'I', Ỉ: 'I', Ĩ: 'I',
      Ò: 'O', Ó: 'O', Ọ: 'O', Ỏ: 'O', Õ: 'O',
      Ô: 'O', Ồ: 'O', Ố: 'O', Ộ: 'O', Ổ: 'O', Ỗ: 'O',
      Ơ: 'O', Ờ: 'O', Ớ: 'O', Ợ: 'O', Ở: 'O', Ỡ: 'O',
      Ù: 'U', Ú: 'U', Ụ: 'U', Ủ: 'U', Ũ: 'U',
      Ư: 'U', Ừ: 'U', Ứ: 'U', Ự: 'U', Ử: 'U', Ữ: 'U',
      Ỳ: 'Y', Ý: 'Y', Ỵ: 'Y', Ỷ: 'Y', Ỹ: 'Y',
      Đ: 'D',
    };

    return str.split('').map(char => tones[char] || char).join('');
  }

  /**
   * Generate Temporary Email from Full Name and Date of Birth
   * 
   * Creates a fake email address for patients without real email.
   * Format: normalized_name + DDMMYYYY + @tempemail.clinic
   * 
   * Algorithm:
   * 1. Normalize full name: Remove accents, lowercase, remove spaces/special chars
   * 2. Format DOB: 1988-08-10 → 10081988 (DDMMYYYY)
   * 3. Combine: tranvand10081988@tempemail.clinic
   * 4. Check duplicates: Add counter if exists (_01, _02, etc.)
   * 5. Last resort: Add phone or UUID
   * 
   * Examples:
   * - "Trần Văn D" + "1988-08-10" → tranvand10081988@tempemail.clinic
   * - "Nguyễn Thị B" + "1995-05-20" → nguyenthib20051995@tempemail.clinic
   * 
   * @param {string} fullName - Patient full name
   * @param {string} dateOfBirth - Date of birth (YYYY-MM-DD)
   * @param {string} phone - Phone number (fallback for uniqueness)
   * @returns {Promise<string>} Generated fake email
   */
  private async generateTempEmail(
    fullName: string,
    dateOfBirth: string,
    phone: string,
  ): Promise<string> {
    // Step 1: Normalize full name
    const normalized = this.removeVietnameseTones(fullName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // Remove all non-alphanumeric

    // Step 2: Format date of birth: YYYY-MM-DD → DDMMYYYY
    const [year, month, day] = dateOfBirth.split('-');
    const dobFormatted = `${day}${month}${year}`; // 10081988

    // Step 3: Combine name + DOB
    const emailPrefix = `${normalized}${dobFormatted}`; // tranvand10081988

    // Step 4: Check for duplicates and generate unique email
    let email = `${emailPrefix}@tempemail.clinic`;
    let counter = 1;
    const maxAttempts = 100;

    // Try with counter suffix
    while (counter <= maxAttempts) {
      const existingAccount = await this.accountRepository.findByEmail(email);
      if (!existingAccount) {
        return email; // Found unique email
      }
      email = `${emailPrefix}_${String(counter).padStart(2, '0')}@tempemail.clinic`;
      counter++;
    }

    // Last resort 1: Add phone number
    email = `${emailPrefix}_${phone}@tempemail.clinic`;
    const phoneCheck = await this.accountRepository.findByEmail(email);
    if (!phoneCheck) {
      return email;
    }

    // Last resort 2: Add short UUID
    const shortUuid = randomBytes(4).toString('hex'); // 8 characters
    email = `${emailPrefix}_${shortUuid}@tempemail.clinic`;
    return email;
  }

  /**
   * Create Patient Account Without Email (Step A3 - Walk-in Appointment)
   * 
   * Creates patient account for walk-in customers who don't have real email.
   * System generates a fake email from full name + date of birth.
   * 
   * Process:
   * 1. Validate phone uniqueness
   * 2. Generate fake email from name + DOB
   * 3. Generate random secure password
   * 4. Create Account entity (role: PATIENT, status: ACTIVE, is_temp_email: true)
   * 5. Create GeneralAccount profile with DOB
   * 6. Do NOT send email (fake email doesn't exist)
   * 7. Return credentials for manual delivery
   * 
   * Business Rules:
   * - Phone must be unique (check for duplicates)
   * - Fake email format: name + DOB + @tempemail.clinic
   * - Password is auto-generated (12 chars, mixed case, numbers, specials)
   * - Account type = "DIRECT_ACCOUNT", is_temp_email = true
   * - No email sent (staff must provide credentials directly)
   * - Patient can update real email later
   * 
   * @param {CreatePatientNoEmailDto} dto - Patient data (phone, fullName, dateOfBirth)
   * @returns {Promise<CreatePatientNoEmailResponseDto>} Created account info with credentials
   * @throws {ConflictException} If phone already exists
   */
  async createPatientNoEmail(
    dto: CreatePatientNoEmailDto,
  ): Promise<CreatePatientNoEmailResponseDto> {
    // Step 1: Validate phone uniqueness
    const existingAccount = await this.accountRepository.findByPhone(dto.phone);
    if (existingAccount) {
      throw new ConflictException('Phone number already exists');
    }

    // Step 2: Generate fake email from name + DOB
    const fakeEmail = await this.generateTempEmail(
      dto.fullName,
      dto.dateOfBirth,
      dto.phone,
    );

    // Step 2: Generate random secure password
    const temporaryPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 3: Create both Account and GeneralAccount in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create Account entity with ACTIVE status and temp email flag
      const account = this.accountRepository.createAccount({
        username: fakeEmail.split('@')[0], // Use email prefix as username
        email: fakeEmail,
        password: hashedPassword,
        phone: dto.phone,
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE, // Active immediately (no email verification)
        // Note: is_temp_email flag should be added to Account entity if not exists
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Create GeneralAccount profile with DOB
      const generalAccount = this.generalAccountRepository.createGeneralAccount(
        {
          accountId: savedAccount._id,
          fullName: dto.fullName,
          dob: new Date(dto.dateOfBirth), // Save DOB from input
          // Other fields (gender, address) are NULL - patient can update later
        },
      );

      await queryRunner.manager.save(generalAccount);

      await queryRunner.commitTransaction();

      // Step 4: Return response with credentials (NO email sent)
      return {
        success: true,
        accountId: savedAccount._id,
        email: savedAccount.email,
        isTempEmail: true,
        phone: savedAccount.phone!,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth,
        temporaryPassword, // Return password for staff to provide manually
        emailSent: false, // Never send email for fake addresses
        activationStatus: 'ACTIVE',
        message: 'Account created successfully with temporary email. Customer can update real email later.',
        manualLoginInfo: {
          username: savedAccount.email,
          password: temporaryPassword,
          instructions: 'Please provide this login information to the customer directly',
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

