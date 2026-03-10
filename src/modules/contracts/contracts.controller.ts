import { Controller, Post, Get, Param, UseGuards, Req, Body, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth, ApiResponse, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SignContractDto } from './dto/sign-contract.dto';
import { CreateContractPackageDto } from './dto/create-contract-package.dto';
import { CreateContractInfoDto } from './dto/create-contract-info.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums/account-role.enum';

@ApiTags('Contracts')
@Controller('contracts')
export class ContractsController {
    constructor(private readonly contractsService: ContractsService) { }


    @Get('packages/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AccountRole.ADMIN, AccountRole.CLINIC_MANAGER, AccountRole.DOCTOR, AccountRole.CLINIC_STAFF)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get contract package by ID' })
    async getPackageById(@Param('id') id: string) {
        return this.contractsService.getPackageById(id);
    }

    /**
     * Get Contract Packages
     * 
     * Retrieves a paginated list of contract packages for the clinic.
     * Supports filtering by employee name.
     */
    @Get('packages')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AccountRole.ADMIN, AccountRole.CLINIC_MANAGER, AccountRole.DOCTOR, AccountRole.CLINIC_STAFF)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get all contract packages for the logged-in clinic' })
    @ApiQuery({ name: 'employeeName', required: false, description: 'Search by employee name' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getPackages(
        @Req() req,
        @Query('employeeName') employeeName?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const clinicManagerId = req.user._id;
        return this.contractsService.getPackagesByManager(clinicManagerId, employeeName, page, limit);
    }

    /**
     * Get Contract Packages for Employee
     *
     * Retrieves a paginated list of contract packages for the logged-in employee.
     * Supports filtering by clinic name.
     */
    @Get('employee/packages')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AccountRole.DOCTOR, AccountRole.CLINIC_STAFF)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get all contract packages for the logged-in employee' })
    @ApiQuery({ name: 'clinicName', required: false, description: 'Search by clinic name' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getPackagesByEmployee(
        @Req() req,
        @Query('clinicName') clinicName?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const employeeId = req.user._id;
        return this.contractsService.getPackagesByEmployee(employeeId, clinicName, page, limit);
    }

    /**
     * Get Contract Package by ID for Employee
     *
     * Retrieves contract package details specifically for the employee.
     */
    @Get('employee/packages/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AccountRole.DOCTOR, AccountRole.CLINIC_STAFF)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get contract package by ID for the logged-in employee' })
    async getMyContractById(
        @Req() req,
        @Param('id') id: string
    ) {
        const employeeId = req.user._id;
        return this.contractsService.getMyContract(employeeId, id);
    }

    /**
     * Create Contract Package (Step 1)
     * 
     * Initiates the contract creation process by creating a package.
     */
    @Post('packages')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AccountRole.ADMIN, AccountRole.CLINIC_MANAGER)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Create a new contract package (Step 1)' })
    @ApiResponse({ status: 201, description: 'Contract package created successfully' })
    async createPackage(@Body() dto: CreateContractPackageDto, @Req() req) {
        const clinicManagerId = req.user._id;
        return this.contractsService.createPackage(dto, clinicManagerId);
    }

    /**
     * Create Contract Information (Step 2)
     * 
     * Adds detailed terms and information to the contract package.
     */
    @Post('packages/:id/info')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AccountRole.ADMIN, AccountRole.CLINIC_MANAGER, AccountRole.DOCTOR, AccountRole.CLINIC_STAFF)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Create contract terms/information (Step 2)' })
    @ApiResponse({ status: 201, description: 'Contract information created successfully' })
    async createContractInfo(@Param('id') id: string, @Body() dto: CreateContractInfoDto) {
        return this.contractsService.createContractInfo(id, dto);
    }

    /**
     * Send Signing OTP
     * 
     * Sends an OTP to the user's email to authorize signing.
     */
    @Post(':id/send-otp')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Send OTP for contract signing' })
    async sendOtp(@Param('id') id: string, @Req() req) {
        return this.contractsService.sendSigningOtp(id, req.user._id);
    }

    /**
     * Sign Contract
     * 
     * Signs the contract using the user's private key and provided OTP.
     */
    @Post(':id/sign')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Sign a contract with digital signature' })
    @ApiBody({ type: SignContractDto })
    async signContract(@Param('id') id: string, @Body() dto: SignContractDto, @Req() req) {
        return this.contractsService.signContract(id, req.user._id, dto.otp);
    }

    /**
     * Verify Contract
     * 
     * Verifies the digital signatures and integrity of the contract file.
     */
    @Get(':id/verify')
    @ApiOperation({ summary: 'Verify contract signatures and integrity' })
    async verifyContract(@Param('id') id: string) {
        return this.contractsService.verifyContract(id);
    }

    /**
     * Upload Contract File
     * 
     * Uploads the PDF file generated by the frontend to Cloudinary.
     */
    @Post(':id/upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
    }))
    @ApiOperation({ summary: 'Upload contract PDF file (generated by Frontend)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    async uploadContractFile(
        @Param('id') id: string,
        @UploadedFile() file: any
    ) {
        return this.contractsService.uploadContractFile(id, file);
    }
}
