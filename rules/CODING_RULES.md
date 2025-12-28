# Medicare Backend - Coding Rules & Standards

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Folder Structure](#folder-structure)
4. [Naming Conventions](#naming-conventions)
5. [TypeScript/NestJS Conventions](#typescriptnestjs-conventions)
6. [Entity Guidelines](#entity-guidelines)
7. [DTO Guidelines](#dto-guidelines)
8. [Controller Guidelines](#controller-guidelines)
9. [Service Guidelines](#service-guidelines)
10. [Repository Pattern](#repository-pattern)
11. [Error Handling](#error-handling)
12. [Code Documentation](#code-documentation)
13. [Import Organization](#import-organization)
14. [Formatting Rules](#formatting-rules)
15. [Database Conventions](#database-conventions)

---

## Project Overview

Medicare Backend is a comprehensive healthcare management system built with NestJS, TypeORM, and PostgreSQL. The system manages accounts, appointments, prescriptions, medical records, and more.

**Core Principles:**
- Clean Architecture
- Separation of Concerns
- Type Safety
- Comprehensive Documentation
- RESTful API Design

---

## Technology Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

---

## Folder Structure

```
src/
├── common/                 # Shared utilities, guards, decorators
│   ├── decorators/        # Custom decorators
│   ├── guards/            # Auth guards, role guards
│   ├── message/           # Standardized messages
│   ├── utils/             # Helper functions
│   └── seeders/           # Database seeders
├── config/                # Configuration files
├── modules/               # Feature modules
│   ├── accounts/          # Account management
│   │   ├── dto/          # Data Transfer Objects
│   │   ├── entities/     # Database entities
│   │   ├── enums/        # Enumerations
│   │   ├── repositories/ # Data access layer
│   │   ├── accounts.controller.ts
│   │   ├── accounts.service.ts
│   │   └── accounts.module.ts
│   ├── auth/             # Authentication
│   ├── appointments/     # Appointment management
│   ├── prescriptions/    # Medical prescriptions
│   └── ...               # Other feature modules
├── app.module.ts         # Root module
└── main.ts              # Application entry point
```

**Module Structure Rules:**
- Each module follows the same structure: entities, dto, enums, repositories, controller, service, module
- Related functionality must be grouped in the same module
- Cross-module dependencies should use proper injection

---

## Naming Conventions

### Files
```typescript
// Entities
account.entity.ts
clinic_information.entity.ts

// DTOs
create-account.dto.ts
update-password.dto.ts
account-response.dto.ts

// Controllers
accounts.controller.ts
auth.controller.ts

// Services
accounts.service.ts
mailer.service.ts

// Modules
accounts.module.ts

// Repositories
account.repository.ts
general-account.repository.ts

// Enums
account-role.enum.ts
account-status.enum.ts

// Guards
jwt.guard.ts
roles.guard.ts

// Decorators
roles.decorator.ts
api-response.decorator.ts
```

### Classes, Interfaces, Types
```typescript
// Classes - PascalCase
export class Account { }
export class AccountsController { }
export class AccountsService { }

// DTOs - PascalCase with Dto suffix
export class CreateAccountDto { }
export class UpdatePasswordDto { }
export class AccountResponseDto { }

// Enums - PascalCase
export enum AccountRole { }
export enum AccountStatus { }

// Interfaces - PascalCase with I prefix (optional)
export interface IAccountRepository { }
```

### Variables, Functions, Properties
```typescript
// camelCase for variables, functions, properties
const accountId = '123';
const isEmailVerified = true;
const userAccount = await this.accountRepository.findOne();

function createAccount(dto: CreateAccountDto) { }
async findAccountById(id: string) { }

// Constants - UPPER_SNAKE_CASE
const MAX_LOGIN_ATTEMPTS = 5;
const DEFAULT_PAGE_SIZE = 10;
```

### Database Naming
```typescript
// Table names - snake_case (plural or descriptive)
@Entity('accounts')
@Entity('general_accounts')
@Entity('clinic_information')
@Entity('doctor_schedule')

// Column names - snake_case
@Column({ name: 'full_name' })
@Column({ name: 'created_at' })
@Column({ name: 'is_email_verified' })
@Column({ name: 'parent_id' })

// TypeScript property names - camelCase
fullName: string;
createdAt: Date;
isEmailVerified: boolean;
parentId: string;
```

---

## TypeScript/NestJS Conventions

### Type Safety
```typescript
// ✅ ALWAYS use explicit types
const accountId: string = '123';
function findAccount(id: string): Promise<Account> { }

// ❌ AVOID 'any' unless absolutely necessary (already disabled in ESLint)
// const data: any = {}; // Avoid

// ✅ Use proper typing
const data: AccountResponseDto = {};
```

### Async/Await
```typescript
// ✅ ALWAYS use async/await (not .then/.catch)
async createAccount(dto: CreateAccountDto): Promise<Account> {
  const account = await this.accountRepository.save(dto);
  return account;
}

// ❌ AVOID promises with .then
// this.repository.save(dto).then(result => { });
```

### Dependency Injection
```typescript
// ✅ Use constructor injection
@Injectable()
export class AccountsService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly dataSource: DataSource,
  ) {}
}

// ✅ Use @Inject for circular dependencies
constructor(
  @Inject(forwardRef(() => AuthService))
  private readonly authService: AuthService,
) {}
```

---

## Entity Guidelines

### Basic Entity Structure
```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

/**
 * Entity Description
 *
 * Detailed description of what this entity represents
 * and its purpose in the system
 */
@Entity('table_name')
export class EntityName {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'column_name', type: 'varchar', length: 100 })
  propertyName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
```

### Entity Rules
1. **ALWAYS use UUID for primary keys**
   ```typescript
   @PrimaryGeneratedColumn('uuid', { name: '_id' })
   id: string;
   ```

2. **Column naming: snake_case in DB, camelCase in TypeScript**
   ```typescript
   @Column({ name: 'full_name', type: 'text' })
   fullName: string;
   ```

3. **ALWAYS specify column type explicitly**
   ```typescript
   @Column({ name: 'email', type: 'varchar', length: 255 })
   @Column({ name: 'age', type: 'integer' })
   @Column({ name: 'is_active', type: 'boolean' })
   @Column({ name: 'price', type: 'numeric', precision: 10, scale: 2 })
   @Column({ name: 'created_at', type: 'timestamptz' })
   ```

4. **Use nullable: true for optional fields**
   ```typescript
   @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
   phone?: string;
   ```

5. **Enum fields**
   ```typescript
   @Column({
     name: 'role',
     type: 'enum',
     enum: AccountRole,
     default: AccountRole.PATIENT,
   })
   role: AccountRole;
   ```

6. **Relations - Always include both property and ID**
   ```typescript
   // Many-to-One
   @Column({ name: 'parent_id', type: 'uuid', nullable: true })
   parentId?: string;

   @ManyToOne(() => Account, (account) => account.children, {
     nullable: true,
     onDelete: 'SET NULL',
   })
   @JoinColumn({ name: 'parent_id' })
   parent?: Account;

   // One-to-Many
   @OneToMany(() => Account, (account) => account.parent)
   children?: Account[];
   ```

7. **Timestamps**
   ```typescript
   @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
   createdAt: Date;

   @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
   updatedAt: Date;

   @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
   deletedAt?: Date;
   ```

8. **JSONB columns**
   ```typescript
   @Column({ name: 'metadata', type: 'jsonb', nullable: true })
   metadata?: any;

   @Column({ name: 'tags', type: 'text', array: true, nullable: true })
   tags?: string[];
   ```

### Entity Documentation
```typescript
/**
 * Account Entity
 *
 * Core user account model supporting multiple authentication methods
 *
 * Features:
 * - Standard email/password authentication
 * - Google OAuth authentication
 * - Email verification system
 * - Role-based access control
 * - Parent-Child account relationship
 * - Account ban management
 */
@Entity('accounts')
export class Account {
  // ...
}
```

---

## DTO Guidelines

### Basic DTO Structure
```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsDateString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO Description
 * 
 * Detailed description of the DTO's purpose
 * and when it should be used
 */
export class CreateSomethingDto {
  @ApiProperty({
    description: 'Field description',
    example: 'example value',
    required: false, // if optional
  })
  @IsNotEmpty({ message: 'Field is required' })
  @IsString({ message: 'Field must be a string' })
  @MinLength(3, { message: 'Field must be at least 3 characters' })
  @MaxLength(100, { message: 'Field must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  fieldName: string;
}
```

### DTO Rules

1. **ALWAYS use class-validator decorators**
   ```typescript
   @IsNotEmpty({ message: 'Username is required' })
   @IsString({ message: 'Username must be a string' })
   username: string;
   ```

2. **ALWAYS use @ApiProperty for Swagger documentation**
   ```typescript
   @ApiProperty({
     description: 'User email address',
     example: 'user@example.com',
   })
   @IsEmail({}, { message: 'Invalid email format' })
   email: string;
   ```

3. **Use @Transform for data transformation**
   ```typescript
   @Transform(({ value }) => value?.trim())
   username: string;

   @Transform(({ value }) => value?.toLowerCase().trim())
   email: string;
   ```

4. **Optional fields with @IsOptional**
   ```typescript
   @ApiProperty({ required: false })
   @IsOptional()
   @IsString()
   phone?: string;
   ```

5. **Validation decorators**
   ```typescript
   // String validation
   @IsString()
   @MinLength(3)
   @MaxLength(100)
   @Matches(/^[a-zA-Z0-9]+$/)
   username: string;

   // Email validation
   @IsEmail({}, { message: 'Invalid email format' })
   email: string;

   // UUID validation
   @IsUUID('4', { message: 'Invalid UUID format' })
   id: string;

   // Enum validation
   @IsEnum(AccountRole, { message: 'Invalid role' })
   role: AccountRole;

   // Number validation
   @IsNumber()
   @Min(0)
   @Max(100)
   age: number;

   // Boolean validation
   @IsBoolean()
   isActive: boolean;

   // Date validation
   @IsDateString()
   birthDate: string;
   ```

6. **Response DTOs**
   ```typescript
   export class AccountResponseDto {
     @ApiProperty()
     id: string;

     @ApiProperty()
     username: string;

     @ApiProperty()
     email: string;

     // Exclude sensitive data like passwords
   }
   ```

7. **DTO Exports in index.ts**
   ```typescript
   // dto/index.ts
   export * from './create-account.dto';
   export * from './update-account.dto';
   export * from './account-response.dto';
   ```

---

## Controller Guidelines

### Basic Controller Structure
```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from './enums';

/**
 * Controller Description
 *
 * Detailed description of the controller's responsibility
 */
@ApiTags('Controller Name')
@Controller('api-path')
export class SomeController {
  constructor(private readonly someService: SomeService) {}

  @Get()
  @ApiOperation({ summary: 'Get all items' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll() {
    return this.someService.findAll();
  }
}
```

### Controller Rules

1. **Use @ApiTags for grouping**
   ```typescript
   @ApiTags('Accounts')
   @Controller('accounts')
   export class AccountsController { }
   ```

2. **Document every endpoint**
   ```typescript
   @Get(':id')
   @ApiOperation({ summary: 'Get account by ID' })
   @ApiResponse({ status: 200, description: 'Account found' })
   @ApiResponse({ status: 404, description: 'Account not found' })
   @ApiParam({ name: 'id', type: 'string', description: 'Account UUID' })
   async findOne(@Param('id', ParseUUIDPipe) id: string) {
     return this.service.findOne(id);
   }
   ```

3. **Use guards for authentication and authorization**
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(AccountRole.ADMIN)
   @ApiBearerAuth()
   @Delete(':id')
   async delete(@Param('id') id: string) {
     return this.service.delete(id);
   }
   ```

4. **Use proper HTTP status codes**
   ```typescript
   @Post()
   @HttpCode(HttpStatus.CREATED)
   async create(@Body() dto: CreateDto) { }

   @Delete(':id')
   @HttpCode(HttpStatus.NO_CONTENT)
   async remove(@Param('id') id: string) { }
   ```

5. **Use ParseUUIDPipe for UUID validation**
   ```typescript
   @Get(':id')
   async findOne(@Param('id', ParseUUIDPipe) id: string) { }
   ```

6. **Extract user from request in protected routes**
   ```typescript
   @UseGuards(JwtAuthGuard)
   @Get('profile')
   async getProfile(@Request() req) {
     const userId = req.user.id;
     return this.service.findOne(userId);
   }
   ```

7. **Query parameters**
   ```typescript
   @Get()
   @ApiQuery({ name: 'page', required: false, type: Number })
   @ApiQuery({ name: 'limit', required: false, type: Number })
   async findAll(
     @Query('page') page: number = 1,
     @Query('limit') limit: number = 10,
   ) { }
   ```

---

## Service Guidelines

### Basic Service Structure
```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Service Description
 *
 * Detailed description of service responsibilities
 * and business logic
 */
@Injectable()
export class SomeService {
  constructor(
    private readonly repository: SomeRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findOne(id: string): Promise<Entity> {
    const entity = await this.repository.findOne({ where: { id } });
    
    if (!entity) {
      throw new NotFoundException(`Entity with ID ${id} not found`);
    }
    
    return entity;
  }
}
```

### Service Rules

1. **Use dependency injection**
   ```typescript
   @Injectable()
   export class AccountsService {
     constructor(
       private readonly accountRepository: AccountRepository,
       private readonly dataSource: DataSource,
     ) {}
   }
   ```

2. **Transaction management**
   ```typescript
   async createAccountWithProfile(dto: CreateAccountDto): Promise<Account> {
     const queryRunner = this.dataSource.createQueryRunner();
     await queryRunner.connect();
     await queryRunner.startTransaction();

     try {
       const account = await queryRunner.manager.save(Account, accountData);
       const profile = await queryRunner.manager.save(Profile, profileData);
       
       await queryRunner.commitTransaction();
       return account;
     } catch (error) {
       await queryRunner.rollbackTransaction();
       throw error;
     } finally {
       await queryRunner.release();
     }
   }
   ```

3. **Proper error handling**
   ```typescript
   async findOne(id: string): Promise<Account> {
     const account = await this.repository.findOne({ where: { id } });
     
     if (!account) {
       throw new NotFoundException(MESSAGES.ACCOUNT.NOT_FOUND);
     }
     
     return account;
   }

   async create(dto: CreateDto): Promise<Entity> {
     const exists = await this.repository.findOne({ where: { email: dto.email } });
     
     if (exists) {
       throw new ConflictException(MESSAGES.ACCOUNT.EMAIL_EXISTS);
     }
     
     return this.repository.save(dto);
   }
   ```

4. **Use constants for messages**
   ```typescript
   // common/message/index.ts
   export const MESSAGES = {
     ACCOUNT: {
       NOT_FOUND: 'Account not found',
       EMAIL_EXISTS: 'Email already exists',
       CREATED: 'Account created successfully',
     },
   };

   // In service
   throw new NotFoundException(MESSAGES.ACCOUNT.NOT_FOUND);
   ```

5. **Separate business logic from data access**
   ```typescript
   // ✅ Good - Business logic in service
   async createAccount(dto: CreateAccountDto): Promise<Account> {
     // Validation
     await this.validateEmail(dto.email);
     
     // Business logic
     const hashedPassword = await bcrypt.hash(dto.password, 10);
     
     // Data access through repository
     return this.repository.createAccount({
       ...dto,
       password: hashedPassword,
     });
   }

   // ❌ Bad - Direct TypeORM queries in service
   // Use repositories instead
   ```

---

## Repository Pattern

### Basic Repository Structure
```typescript
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Entity } from '../entities/entity.entity';

@Injectable()
export class EntityRepository extends Repository<Entity> {
  constructor(private dataSource: DataSource) {
    super(Entity, dataSource.createEntityManager());
  }

  async findByCustomCriteria(param: string): Promise<Entity[]> {
    return this.createQueryBuilder('entity')
      .where('entity.field = :param', { param })
      .getMany();
  }
}
```

### Repository Rules

1. **Extend TypeORM Repository**
   ```typescript
   @Injectable()
   export class AccountRepository extends Repository<Account> {
     constructor(private dataSource: DataSource) {
       super(Account, dataSource.createEntityManager());
     }
   }
   ```

2. **Custom query methods**
   ```typescript
   async findActiveAccounts(): Promise<Account[]> {
     return this.find({
       where: { status: AccountStatus.ACTIVE },
     });
   }

   async findByEmailWithRelations(email: string): Promise<Account | null> {
     return this.findOne({
       where: { email },
       relations: ['profile', 'clinic'],
     });
   }
   ```

3. **Use QueryBuilder for complex queries**
   ```typescript
   async searchAccounts(searchTerm: string): Promise<Account[]> {
     return this.createQueryBuilder('account')
       .leftJoinAndSelect('account.profile', 'profile')
       .where('account.username ILIKE :search', { search: `%${searchTerm}%` })
       .orWhere('account.email ILIKE :search', { search: `%${searchTerm}%` })
       .orderBy('account.createdAt', 'DESC')
       .getMany();
   }
   ```

4. **Register in module providers**
   ```typescript
   @Module({
     providers: [
       AccountsService,
       AccountRepository,
       GeneralAccountRepository,
     ],
     exports: [AccountsService],
   })
   export class AccountsModule {}
   ```

---

## Error Handling

### Exception Types
```typescript
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

// 400 - Bad Request
throw new BadRequestException('Invalid input data');

// 401 - Unauthorized
throw new UnauthorizedException('Invalid credentials');

// 403 - Forbidden
throw new ForbiddenException('Access denied');

// 404 - Not Found
throw new NotFoundException('Resource not found');

// 409 - Conflict
throw new ConflictException('Email already exists');

// 500 - Internal Server Error
throw new InternalServerErrorException('Something went wrong');
```

### Error Handling Best Practices
```typescript
// ✅ Use descriptive error messages
throw new NotFoundException(`Account with ID ${id} not found`);

// ✅ Use message constants
throw new NotFoundException(MESSAGES.ACCOUNT.NOT_FOUND);

// ✅ Handle specific errors
try {
  await this.repository.save(data);
} catch (error) {
  if (error.code === '23505') { // Unique violation
    throw new ConflictException('Email already exists');
  }
  throw error;
}

// ✅ Validate before operations
if (!account) {
  throw new NotFoundException(MESSAGES.ACCOUNT.NOT_FOUND);
}

// ✅ Transaction error handling
try {
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw new BadRequestException('Transaction failed');
} finally {
  await queryRunner.release();
}
```

---

## Code Documentation

### File-Level Documentation
```typescript
/**
 * Accounts Service
 *
 * Centralized service layer for managing all account-related operations.
 *
 * Core Responsibilities:
 * - Account lifecycle management (CRUD operations)
 * - Patient registration with two-step save process
 * - Email verification management
 * - Password management (update, reset)
 * - Role-based account creation (clinic manager, staff, doctor)
 * - Account soft delete and restoration
 *
 * Related Entities:
 * - Account (accounts table) - Main account data
 * - GeneralAccount (general_accounts) - Patient/Admin specific data
 * - ClinicInformation (clinic_information) - Clinic manager data
 * - ClinicStaffInformation (clinic_staff_information) - Staff data
 * - DoctorInformation (doctor_information) - Doctor data
 */
@Injectable()
export class AccountsService {
  // Implementation
}
```

### Method Documentation
```typescript
/**
 * Create a new patient account (Single-Step Registration)
 *
 * Saves data to two tables in one transaction:
 * 1. Account (accounts) - Common account data
 * 2. GeneralAccount (general_accounts) - Patient-specific data
 *
 * @param createAccountDto - Patient registration data
 * @returns Created account with general account information
 * @throws ConflictException if email already exists
 * @throws BadRequestException if validation fails
 *
 * @example
 * const account = await this.accountsService.createAccount({
 *   username: 'johndoe',
 *   email: 'john@example.com',
 *   password: 'SecurePass123',
 *   fullName: 'John Doe',
 * });
 */
async createAccount(createAccountDto: CreateAccountDto): Promise<Account> {
  // Implementation
}
```

### Inline Comments
```typescript
// ✅ Good comments - explain WHY, not WHAT
// Hash password before storing for security
const hashedPassword = await bcrypt.hash(password, 10);

// Send verification email asynchronously to avoid blocking
this.mailerService.sendVerificationEmail(email, code);

// Use transaction to ensure atomic operation across multiple tables
const queryRunner = this.dataSource.createQueryRunner();

// ❌ Bad comments - state the obvious
// Create a variable
const account = new Account();

// Call the save method
await this.repository.save(account);
```

---

## Import Organization

### Import Order
```typescript
// 1. External dependencies (NestJS, TypeORM, etc.)
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

// 2. Internal modules (other feature modules)
import { Account } from './entities/accounts.entity';
import { MailerService } from '../mailer/mailer.service';

// 3. Current module files
import { AccountRole, AccountStatus } from './enums';
import { CreateAccountDto, UpdateAccountDto } from './dto';
import { AccountRepository } from './repositories/account.repository';

// 4. Common/shared utilities
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';
```

### Import Rules
```typescript
// ✅ Use barrel exports (index.ts)
export * from './create-account.dto';
export * from './update-account.dto';

// Then import
import { CreateAccountDto, UpdateAccountDto } from './dto';

// ✅ Group related imports
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

// ❌ Avoid wildcard imports except for specific cases
// import * from './something'; // Avoid
```

---

## Formatting Rules

### Prettier Configuration
```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

### Code Style
```typescript
// ✅ Use single quotes
const message = 'Hello World';

// ✅ Trailing commas
const obj = {
  name: 'John',
  age: 30,
};

const arr = [
  'item1',
  'item2',
];

// ✅ Semicolons at end of statements
const value = 10;

// ✅ 2-space indentation (handled by Prettier)
if (condition) {
  doSomething();
}

// ✅ Arrow functions
const add = (a: number, b: number) => a + b;

// ✅ Async/await instead of promises
async function fetchData() {
  const result = await getData();
  return result;
}
```

---

## Database Conventions

### Table Naming
```typescript
// ✅ Use snake_case, descriptive names
@Entity('accounts')
@Entity('general_accounts')
@Entity('clinic_information')
@Entity('doctor_schedule')
@Entity('subscription_services')

// ❌ Avoid abbreviations unless very common
// @Entity('acc')  // Bad
// @Entity('usr')  // Bad
```

### Column Naming
```typescript
// ✅ snake_case for column names
@Column({ name: 'full_name' })
@Column({ name: 'created_at' })
@Column({ name: 'is_active' })
@Column({ name: 'parent_id' })

// Boolean columns - prefix with 'is_'
@Column({ name: 'is_email_verified' })
@Column({ name: 'is_OAuth_user' })

// Foreign keys - suffix with '_id'
@Column({ name: 'parent_id' })
@Column({ name: 'clinic_id' })
@Column({ name: 'doctor_id' })

// Date/time columns
@Column({ name: 'created_at', type: 'timestamptz' })
@Column({ name: 'updated_at', type: 'timestamptz' })
@Column({ name: 'deleted_at', type: 'timestamptz' })
@Column({ name: 'dob', type: 'date' })
```

### Primary Keys
```typescript
// ✅ Always use UUID
@PrimaryGeneratedColumn('uuid', { name: '_id' })
id: string;
```

### Timestamps
```typescript
// ✅ Use timestamptz for timezone-aware timestamps
@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
createdAt: Date;

@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
updatedAt: Date;

@DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
deletedAt?: Date;

// ✅ Use date for date-only fields
@Column({ name: 'dob', type: 'date', nullable: true })
dob?: Date;
```

### Enums
```typescript
// Database enum
@Column({
  name: 'role',
  type: 'enum',
  enum: AccountRole,
  default: AccountRole.PATIENT,
})
role: AccountRole;

// TypeScript enum
export enum AccountRole {
  PATIENT = 'PATIENT',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  DOCTOR = 'DOCTOR',
}
```

### Relations
```typescript
// ✅ Specify onDelete behavior
@ManyToOne(() => Account, {
  onDelete: 'CASCADE',  // Delete children when parent is deleted
})

@ManyToOne(() => Account, {
  nullable: true,
  onDelete: 'SET NULL',  // Set to null when parent is deleted
})

// ✅ Always specify JoinColumn
@JoinColumn({ name: 'parent_id' })
parent?: Account;
```

---

## Additional Best Practices

### 1. Environment Variables
```typescript
// Use @nestjs/config for configuration
import { ConfigService } from '@nestjs/config';

constructor(private configService: ConfigService) {}

const dbHost = this.configService.get<string>('DATABASE_HOST');
```

### 2. Validation Pipes
```typescript
// Enable global validation in main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,  // Strip properties that don't have decorators
    forbidNonWhitelisted: true,  // Throw error for extra properties
    transform: true,  // Auto-transform payloads to DTO instances
  }),
);
```

### 3. Guards Order
```typescript
// Authentication first, then authorization
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountRole.ADMIN)
```

### 4. Testing
```typescript
// Unit tests
describe('AccountsService', () => {
  it('should create an account', async () => {
    // Arrange
    const dto = { /* ... */ };
    
    // Act
    const result = await service.create(dto);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

### 5. Security
```typescript
// ✅ Always hash passwords
const hashedPassword = await bcrypt.hash(password, 10);

// ✅ Never return passwords in responses
export class AccountResponseDto {
  id: string;
  username: string;
  email: string;
  // No password field
}

// ✅ Use JwtAuthGuard for protected routes
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) { }
```

---

## Summary Checklist

When writing code for this project, ensure:

- [ ] File names follow snake_case or kebab-case conventions
- [ ] Class names use PascalCase
- [ ] Variables and functions use camelCase
- [ ] Database table and column names use snake_case
- [ ] All entities have proper TypeORM decorators
- [ ] All DTOs have validation decorators and Swagger documentation
- [ ] All endpoints have Swagger documentation
- [ ] Proper error handling with specific exception types
- [ ] Use dependency injection for all services and repositories
- [ ] Transactions for multi-table operations
- [ ] Comprehensive JSDoc comments for complex logic
- [ ] Imports are organized properly
- [ ] Code is formatted with Prettier
- [ ] Type safety (no 'any' unless necessary)
- [ ] Async/await pattern used consistently
- [ ] Sensitive data excluded from responses

---

## Contact & References

For questions or clarifications about these coding standards, refer to:
- NestJS Documentation: https://docs.nestjs.com/
- TypeORM Documentation: https://typeorm.io/
- Project README.md
- Project documentation folder (/document)

**Last Updated**: December 28, 2025
