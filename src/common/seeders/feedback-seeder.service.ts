import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Feedback } from '../../modules/reports/entities/feedback.entity';
import { FeedbackType } from '../../modules/reports/enums';
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { AppointmentStatus } from '../../modules/appointments/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { FeedbackRepository } from '../../modules/reports/repositories/feedback.repository';
import { DOCTOR_NAMES } from '../constants/names';

/**
 * Interface for CSV row data
 */
interface CsvRow {
  review_id: string;
  review_text: string;
  labels: string;
  rating: string;
}

/**
 * Feedback Seeder Service
 * - Runs on application startup
 * - Seeds 150 feedback records (50 per clinic) for 3 clinics
 * - Uses data from test.csv file
 * - Dynamically retrieves clinic and patient IDs from database
 */
@Injectable()
export class FeedbackSeederService {
  private readonly logger = new Logger(FeedbackSeederService.name);

  // Number of feedbacks to create per clinic
  private readonly FEEDBACKS_PER_CLINIC = 50;

  // Number of feedbacks with images per clinic (random between 6 and 7)
  private readonly MIN_IMAGES_PER_CLINIC = 6;
  private readonly MAX_IMAGES_PER_CLINIC = 7;

  // Image URLs for feedbacks
  private readonly IMAGE_URLS = [
    'https://ecopharma.com.vn/wp-content/uploads/2024/09/giuong-benh-phong-kham-da-khoa-tam-anh-quan-7.jpg',
    'https://suckhoedoisong.qltns.mediacdn.vn/324455921873985536/2024/8/20/anh-chup-man-hinh-2024-08-20-luc-18-57-06-1724155044465198930131.png',
    'https://i-law.vn/uploads/articles/66037/mo_phong_kham_tu_nhan_ngoai_gio_hanh_chinh_can_co_nhung_thu_tuc_gi.jpg',
    'https://tapchidongy.net/wp-content/uploads/2024/04/Phong-kham-da-khoa-Ykao-2.jpg',
    'https://hp.medcare.vn/wp-content/uploads/sites/5/2019/10/tang4_medcareHp.jpg',
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly feedbackRepository: FeedbackRepository,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  /**
   * Seed feedbacks for all clinics
   *
   * Process:
   * 1. Retrieve CLINIC_MANAGER accounts (clinics)
   * 2. Retrieve PATIENT accounts
   * 3. Read data from test.csv
   * 4. Create 50 feedbacks per clinic
   * 5. Randomly assign patients, images
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed feedbacks...');

      // Check if feedbacks already exist
      const existingFeedbacks =
        await this.feedbackRepository.findAllFeedbacks();
      if (existingFeedbacks.length > 0) {
        this.logger.log(
          `Feedbacks already exist (${existingFeedbacks.length} records). Skipping seeding.`,
        );
        return;
      }

      // Retrieve CLINIC_MANAGER accounts (clinics)
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinics = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_MANAGER,
      );

      if (clinics.length === 0) {
        this.logger.warn(
          'No clinic manager accounts found. Skipping feedback seeding.',
        );
        return;
      }

      // Retrieve PATIENT accounts
      const patients = allAccounts.filter(
        (acc) => acc.role === AccountRole.PATIENT,
      );

      if (patients.length === 0) {
        this.logger.warn(
          'No patient accounts found. Skipping feedback seeding.',
        );
        return;
      }

      this.logger.log(
        `Found ${clinics.length} clinics and ${patients.length} patients`,
      );

      // Read CSV data
      const csvData = await this.readCsvFile();
      if (csvData.length === 0) {
        this.logger.warn(
          'No data found in test.csv. Skipping feedback seeding.',
        );
        return;
      }

      this.logger.log(`Loaded ${csvData.length} rows from test.csv`);

      // Create feedbacks for each clinic
      const allFeedbacks: Feedback[] = [];

      for (const clinic of clinics) {
        const clinicFeedbacks = await this.createFeedbacksForClinic(
          clinic._id,
          csvData,
          patients.map((p) => p._id),
        );
        allFeedbacks.push(...clinicFeedbacks);
      }

      // Save all feedbacks to database
      await this.feedbackRepository.saveFeedbacks(allFeedbacks);

      this.logger.log(
        `✅ Successfully seeded ${allFeedbacks.length} feedbacks for ${clinics.length} clinics`,
      );
    } catch (error) {
      this.logger.error('Failed to seed feedbacks', error.stack);
    }
  }

  /**
   * Create feedbacks for a single clinic
   *
   * @param {string} clinicId - Clinic UUID
   * @param {CsvRow[]} csvData - Data from CSV file
   * @param {string[]} patientIds - Array of patient UUIDs
   * @returns {Promise<Feedback[]>} Array of feedback entities
   */
  private async createFeedbacksForClinic(
    clinicId: string,
    csvData: CsvRow[],
    patientIds: string[],
  ): Promise<Feedback[]> {
    const feedbacks: Feedback[] = [];

    // Get actual appointments for this clinic
    const clinicAppointments = await this.appointmentRepository.find({
      where: {
        clinicId,
        status: AppointmentStatus.COMPLETED,
      },
      relations: ['doctor'],
    });

    if (clinicAppointments.length === 0) {
      this.logger.warn(
        `No completed appointments found for clinic ${clinicId}. Skipping feedback seeding.`,
      );
      return [];
    }

    // Determine how many feedbacks to create based on available appointments
    const feedbacksToCreate = Math.min(
      this.FEEDBACKS_PER_CLINIC,
      clinicAppointments.length,
    );

    // Pick random appointments
    const shuffledAppointments = [...clinicAppointments].sort(
      () => 0.5 - Math.random(),
    );
    const selectedAppointments = shuffledAppointments.slice(
      0,
      feedbacksToCreate,
    );

    // Randomly select isolated unique rows from CSV data
    const selectedRows = this.getRandomRows(csvData, feedbacksToCreate);

    // Determine how many feedbacks will have images (6 or 7)
    const numWithImages = this.getRandomInt(
      Math.min(this.MIN_IMAGES_PER_CLINIC, feedbacksToCreate),
      Math.min(this.MAX_IMAGES_PER_CLINIC, feedbacksToCreate),
    );

    // Randomly select indices for feedbacks with images
    const imageIndices = this.getRandomIndices(
      feedbacksToCreate,
      numWithImages,
    );

    // Get available doctor IDs for this clinic (for doctor-level feedbacks)
    const allAccounts = await this.accountRepository.findAllAccounts();
    const doctors = allAccounts.filter(
      (acc) => acc.role === AccountRole.DOCTOR,
    );

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      const appointment = selectedAppointments[i];
      const hasImages = imageIndices.includes(i);

      // Randomly select a patient ID
      const patientId =
        patientIds[Math.floor(Math.random() * patientIds.length)];

      // Every 3rd feedback is for a doctor
      const isDoctorFeedback = i % 3 === 0;

      let doctorId = null;
      if (isDoctorFeedback) {
        doctorId =
          appointment.doctorId ||
          (doctors.length > 0 ? doctors[i % doctors.length]._id : null);
      }

      // Prepare feedback data
      const feedbackData = {
        appointmentId: appointment._id,
        clinicId: clinicId,
        doctorId: doctorId,
        rating: parseInt(row.rating, 10),
        description: row.review_text,
        descriptionLabel: null,
        feedbackImages: hasImages ? this.getRandomImages() : null,
        feedbackImagesLabel: null,
        type: isDoctorFeedback ? FeedbackType.DOCTOR : FeedbackType.CLINIC,
      };

      const feedback = this.feedbackRepository.createFeedback(feedbackData);
      feedbacks.push(feedback);
    }

    return feedbacks;
  }

  /**
   * Read CSV file and parse data
   *
   * @returns {Promise<CsvRow[]>} Array of parsed CSV rows
   */
  private async readCsvFile(): Promise<CsvRow[]> {
    const csvPath = path.join(process.cwd(), 'data', 'test.csv');

    if (!fs.existsSync(csvPath)) {
      this.logger.error(`CSV file not found at: ${csvPath}`);
      return [];
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter((line) => line.trim() !== '');

    if (lines.length <= 1) {
      this.logger.warn('CSV file is empty or only contains headers');
      return [];
    }

    // Parse CSV manually
    const results: CsvRow[] = [];
    const headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || '';
        });
        results.push(row as CsvRow);
      }
    }

    return results;
  }

  /**
   * Parse a single CSV line, handling quoted values
   *
   * @param {string} line - CSV line to parse
   * @returns {string[]} Array of values
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Comma separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Get random rows from CSV data
   *
   * @param {CsvRow[]} data - Array of CSV rows
   * @param {number} count - Number of rows to select
   * @returns {CsvRow[]} Array of randomly selected rows
   */
  private getRandomRows(data: CsvRow[], count: number): CsvRow[] {
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, data.length));
  }

  /**
   * Get random indices for feedbacks with images
   *
   * @param {number} total - Total number of feedbacks
   * @param {number} count - Number of indices to select
   * @returns {number[]} Array of random indices
   */
  private getRandomIndices(total: number, count: number): number[] {
    const indices = Array.from({ length: total }, (_, i) => i);
    const shuffled = indices.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, total));
  }

  /**
   * Get random images
   *
   * @returns {string[]} Array of random image URLs (1-3 images)
   */
  private getRandomImages(): string[] {
    const numImages = this.getRandomInt(1, 3);
    const shuffled = [...this.IMAGE_URLS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numImages);
  }

  /**
   * Get random integer between min and max (inclusive)
   *
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
