import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { KnowledgeBaseRepository } from '../../modules/ai-rag-chat-bot/repositories/knowledge-base.repository';

@Injectable()
export class KnowledgeBaseSeederService {
  private readonly logger = new Logger(KnowledgeBaseSeederService.name);

  constructor(
    private readonly knowledgeBaseRepository: KnowledgeBaseRepository,
    private readonly dataSource: DataSource,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed Knowledge Base...');

      // Clear existing knowledge base data to avoid duplicates
      await this.dataSource.query('DELETE FROM knowledge_base');
      this.logger.log('Cleared existing knowledge base data.');

      // 1. Seed Clinic Services
      await this.seedClinicServices();

      // 2. Seed Doctor Information
      await this.seedDoctorInfo();

      // 3. Seed Clinic Information
      await this.seedClinicInfo();

      // 4. Seed Staff Information
      await this.seedStaffInfo();

      // 5. Seed Blog Information
      await this.seedBlogInfo();

      // 6. Seed Schedule Information
      await this.seedScheduleInfo();

      // 7. Seed Feedback Information
      await this.seedFeedbackInfo();

      // 8. Seed User Information
      await this.seedUserInfo();

      this.logger.log('✅ Knowledge Base seeding completed.');
    } catch (error) {
      this.logger.error('Failed to seed Knowledge Base', error.stack);
    }
  }

  /**
   * Query 1: Clinic services with clinic admin and manager information
   */
  private async seedClinicServices(): Promise<void> {
    const query = `
      SELECT 
        csca.category_name,
        csca."type" as category_type,
        csca.is_active as category_is_active,
        cs.service_name,
        cs.service_code,
        cs.description as service_description,
        cs.service_functions,
        cs.is_active as service_is_active,
        csc.price,
        (csc.price * (csc.discount / 100)) as discount,
        csc.duration_min,
        csc.note_for_patient,
        csc.is_active as config_is_active,
        a."role",
        a.username,
        a.email,
        a.phone,
        a.status,
        cmi.clinic_branch_name,
        cmi.full_name as full_name_clinic_branch,
        cmi.dob as clinic_branch_dob,
        cai.clinic_name as clinic_main_name,
        cai.description as clinic_description,
        cai.specialized_in,
        cai.pros,
        cai.paraclinical,
        cai.dob as clinic_main_dob,
        adr.address,
        adr.ward_name,
        adr.district_name,
        adr.province_name,
        csc._id as config_id,
        cs._id as service_id,
        a._id as clinic_id
      FROM clinic_service_config csc 
      JOIN clinic_services cs ON csc.service_id = cs._id 
      JOIN clinic_service_category csca ON cs.category_id = csca._id 
      JOIN accounts a ON csc.clinic_id = a._id 
      JOIN clinic_manager_information cmi ON cmi.account_id = a._id 
      JOIN clinic_admin_information cai ON cai.account_id = a.parent_id 
      JOIN addresses adr ON adr.account_id = a._id
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatClinicServiceContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'clinic_services',
          configId: row.config_id,
          serviceId: row.service_id,
          clinicId: row.clinic_id,
          serviceName: row.service_name,
          clinicName: row.clinic_main_name,
          branchName: row.clinic_branch_name,
          categoryName: row.category_name,
          price: row.price,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} clinic service entries.`);
  }

  private formatClinicServiceContent(row: any): string {
    const parts = [
      `Service: ${row.service_name} (Code: ${row.service_code || 'N/A'})`,
      `Category: ${row.category_name} (${row.category_type || 'N/A'})`,
      `Price: ${row.price?.toLocaleString('vi-VN')} VNĐ`,
      row.discount > 0
        ? `Discount: ${row.discount?.toLocaleString('vi-VN')} VNĐ`
        : null,
      `Duration: ${row.duration_min} minutes`,
      row.service_description
        ? `Description: ${row.service_description}`
        : null,
      row.service_functions
        ? `Functions: ${JSON.stringify(row.service_functions)}`
        : null,
      row.note_for_patient ? `Note for patient: ${row.note_for_patient}` : null,
      `Main clinic: ${row.clinic_main_name}`,
      `Branch: ${row.clinic_branch_name}`,
      row.specialized_in
        ? `Specialized in: ${JSON.stringify(row.specialized_in)}`
        : null,
      `Address: ${row.address}, ${row.ward_name}, ${row.district_name}, ${row.province_name}`,
      `Contact: ${row.phone || 'N/A'}, Email: ${row.email || 'N/A'}`,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 2: Doctor's information with clinic details
   */
  private async seedDoctorInfo(): Promise<void> {
    const query = `
      SELECT 
        di.full_name,
        di.gender,
        di.academic_degree,
        di.experience,
        di."position",
        di.introduction_1,
        di.work_process_2,
        di.study_process_3,
        di.members_4,
        di.scientific_work_5,
        di.papers_6,
        di.dob as doctor_dob,
        a2.username,
        a2.email,
        a2.phone,
        a2.status,
        cmi.clinic_branch_name,
        cmi.full_name as full_name_clinic_branch,
        cmi.dob as clinic_branch_dob,
        cai.clinic_name as clinic_main_name,
        cai.description as clinic_description,
        cai.specialized_in,
        cai.pros,
        cai.paraclinical,
        cai.dob as clinic_main_dob,
        adr.address,
        adr.ward_name,
        adr.district_name,
        adr.province_name,
        di._id as doctor_info_id,
        di.account_id as doctor_account_id
      FROM doctor_information di 
      JOIN accounts a1 ON a1._id = di.account_id 
      JOIN clinic_manager_information cmi ON cmi.account_id = a1.parent_id 
      JOIN accounts a2 ON a2._id = cmi.account_id 
      JOIN clinic_admin_information cai ON cai.account_id = a2.parent_id 
      JOIN addresses adr ON adr.account_id = a2._id
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatDoctorContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'doctor_profile',
          doctorInfoId: row.doctor_info_id,
          doctorAccountId: row.doctor_account_id,
          doctorName: row.full_name,
          clinicName: row.clinic_main_name,
          branchName: row.clinic_branch_name,
          academicDegree: row.academic_degree,
          position: row.position,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} doctor entries.`);
  }

  private formatDoctorContent(row: any): string {
    const parts = [
      `Doctor: ${row.full_name}`,
      row.gender ? `Gender: ${row.gender}` : null,
      row.academic_degree ? `Academic degree: ${row.academic_degree}` : null,
      row.experience ? `Experience: ${row.experience}` : null,
      row.position ? `Position: ${row.position}` : null,
      row.introduction_1 ? `Introduction: ${row.introduction_1}` : null,
      row.work_process_2
        ? `Work process: ${JSON.stringify(row.work_process_2)}`
        : null,
      row.study_process_3
        ? `Study process: ${JSON.stringify(row.study_process_3)}`
        : null,
      row.scientific_work_5
        ? `Scientific work: ${JSON.stringify(row.scientific_work_5)}`
        : null,
      row.papers_6 ? `Papers: ${JSON.stringify(row.papers_6)}` : null,
      `Main clinic: ${row.clinic_main_name}`,
      `Branch: ${row.clinic_branch_name}`,
      row.specialized_in
        ? `Specialized in: ${JSON.stringify(row.specialized_in)}`
        : null,
      `Address: ${row.address}, ${row.ward_name}, ${row.district_name}, ${row.province_name}`,
      `Contact: ${row.phone || 'N/A'}, Email: ${row.email || 'N/A'}`,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 3: Clinic information from admin perspective
   */
  private async seedClinicInfo(): Promise<void> {
    const query = `
      SELECT 
                    a._id as clinic_id,
                    a.username,
                    a.role,
                    a.email,
                    a.phone,
                    a.status,
                    cai.clinic_name,
                    cmi.clinic_branch_name,
                    cmi.full_name,
                    cmi.dob as clinic_branch_dob,
                    cai.description,
                    cai.specialized_in,
                    cai.pros,
                    cai.paraclinical,
                    cai.dob as clinic_main_dob,
                    adr.address,
                    adr.ward_name,
                    adr.district_name,
                    adr.province_name
                FROM clinic_manager_information cmi
                JOIN accounts a ON a._id = cmi.account_id
                JOIN clinic_admin_information cai ON cai.account_id = a.parent_id
                LEFT JOIN addresses adr ON adr.account_id = a._id
                WHERE a.deleted_at IS NULL
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatClinicContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'clinic_info',
          clinicAccountId: row.clinic_id,
          clinicManagerId: row.clinic_manager_id,
          clinicAdminId: row.clinic_admin_id,
          clinicName: row.clinic_main_name,
          branchName: row.clinic_branch_name,
          specializedIn: row.specialized_in,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} clinic entries.`);
  }

  private formatClinicContent(row: any): string {
    const parts = [
      `Clinic: ${row.clinic_name}`,
      `Branch: ${row.clinic_branch_name}`,
      `Manager: ${row.full_name_clinic_branch}`,
      row.description ? `Description: ${row.description}` : null,
      row.specialized_in
        ? `Specialized in: ${JSON.stringify(row.specialized_in)}`
        : null,
      row.pros ? `Pros: ${JSON.stringify(row.pros)}` : null,
      row.paraclinical
        ? `Paraclinical: ${JSON.stringify(row.paraclinical)}`
        : null,
      `Address: ${row.address}, ${row.ward_name}, ${row.district_name}, ${row.province_name}`,
      `Contact: ${row.phone || 'N/A'}, Email: ${row.email || 'N/A'}`,
      `Status: ${row.status}`,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 4: Staff information for contact purposes
   */
  private async seedStaffInfo(): Promise<void> {
    const query = `
      SELECT 
        csi.full_name,
        csi.gender,
        csi.clinic_role,
        csi.dob as staff_dob,
        a2.username,
        a1.email,
        a1.phone,
        a2.status,
        cmi.clinic_branch_name,
        cmi.full_name as full_name_clinic_branch,
        cmi.dob as clinic_branch_dob,
        cai.clinic_name as clinic_main_name,
        cai.description,
        cai.specialized_in,
        cai.pros,
        cai.paraclinical,
        cai.dob as clinic_main_dob,
        adr.address,
        adr.ward_name,
        adr.district_name,
        adr.province_name,
        csi._id as staff_info_id,
        csi.account_id as staff_account_id
      FROM clinic_staff_information csi 
      JOIN accounts a1 ON a1._id = csi.account_id 
      JOIN clinic_manager_information cmi ON cmi.account_id = a1.parent_id 
      JOIN accounts a2 ON a2._id = cmi.account_id 
      JOIN clinic_admin_information cai ON cai.account_id = a2.parent_id 
      JOIN addresses adr ON adr.account_id = a2._id
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatStaffContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'staff_info',
          staffInfoId: row.staff_info_id,
          staffAccountId: row.staff_account_id,
          staffName: row.full_name,
          clinicRole: row.clinic_role,
          clinicName: row.clinic_main_name,
          branchName: row.clinic_branch_name,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} staff entries.`);
  }

  private formatStaffContent(row: any): string {
    const parts = [
      `Staff: ${row.full_name}`,
      row.gender ? `Gender: ${row.gender}` : null,
      row.clinic_role ? `Clinic role: ${row.clinic_role}` : null,
      `Clinic: ${row.clinic_main_name}`,
      `Branch: ${row.clinic_branch_name}`,
      `Address: ${row.address}, ${row.ward_name}, ${row.district_name}, ${row.province_name}`,
      `Contact: ${row.phone || 'N/A'}, Email: ${row.email || 'N/A'}`,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 5: Blog information for informational purposes
   */
  private async seedBlogInfo(): Promise<void> {
    const query = `
      SELECT 
        _id,
        clinic_id,
        title,
        content,
        thumbnail,
        "type"
      FROM blogs
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatBlogContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'blog_info',
          blogId: row._id,
          clinicId: row.clinic_id,
          blogTitle: row.title,
          blogType: row.type,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} blog entries.`);
  }

  private formatBlogContent(row: any): string {
    const parts = [
      `Blog: ${row.title}`,
      row.type ? `Type: ${row.type}` : null,
      `Content: ${row.content}`,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 6 & 6.1: Clinic and doctor schedules with appointment availability
   */
  private async seedScheduleInfo(): Promise<void> {
    // Query 6.1: General clinic working hours
    const query = `
      WITH RankedSchedule AS (
        SELECT 
          es.clinic_id,
          cai.clinic_name as main_clinic_name,
          cmi.clinic_branch_name,
          cmi.full_name,
          adr.address,
          adr.ward_name,
          adr.district_name,
          adr.province_name,
          di.full_name as doctor_name,
          a0."role",
          di.gender,
          csh.start_hour,
          csh.end_hour,
          cs.shift AS shift_name,
          es.work_date,
          cr.room_name,
          es._id as schedule_id,
          di.account_id as doctor_account_id
        FROM clinic_shift_hour csh
        JOIN clinic_shift cs ON csh.shift_id = cs._id
        JOIN employee_schedule es ON es.clinic_shift_id = cs._id
        JOIN clinic_room_employee_schedule cres ON cres.employee_schedule_id = es._id
        JOIN clinic_room cr ON cr._id = cres.clinic_room_id
        JOIN accounts a0 ON a0._id = es.employee_id   
        JOIN doctor_information di ON di.account_id = a0._id 
        JOIN accounts a1 ON a1._id = es.clinic_id  
        JOIN clinic_manager_information cmi ON cmi.account_id = a1._id 
        JOIN accounts a2 ON a2._id = cmi.account_id 
        JOIN clinic_admin_information cai ON cai.account_id = a2.parent_id 
        JOIN addresses adr ON adr.account_id = a2._id
      )
      SELECT 
        clinic_id,
        main_clinic_name,
        clinic_branch_name,
        full_name,
        address,
        ward_name,
        district_name,
        province_name,
        doctor_name,
        "role",
        gender,
        work_date,
        room_name,
        shift_name,
        start_hour,
        end_hour,
        schedule_id,
        doctor_account_id
      FROM RankedSchedule
      ORDER BY clinic_id ASC
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatScheduleContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'schedule_info',
          scheduleId: row.schedule_id,
          clinicId: row.clinic_id,
          doctorAccountId: row.doctor_account_id,
          clinicName: row.main_clinic_name,
          branchName: row.clinic_branch_name,
          doctorName: row.doctor_name,
          workDate: row.work_date,
          shiftName: row.shift_name,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} schedule entries.`);
  }

  private formatScheduleContent(row: any): string {
    const workDate = row.work_date
      ? new Date(row.work_date).toLocaleDateString('vi-VN')
      : 'N/A';

    const parts = [
      `Schedule: Doctor ${row.doctor_name}`,
      row.gender ? `Gender: ${row.gender}` : null,
      `Clinic: ${row.main_clinic_name}`,
      `Branch: ${row.clinic_branch_name}`,
      `Work date: ${workDate}`,
      `Shift: ${row.shift_name}`,
      `Working hours: ${row.start_hour} - ${row.end_hour}`,
      `Room: ${row.room_name}`,
      `Address: ${row.address}, ${row.ward_name}, ${row.district_name}, ${row.province_name}`,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 7: Feedback information for recommendations
   */
  private async seedFeedbackInfo(): Promise<void> {
    const query = `
      SELECT 
        f.appointment_id,
        f.clinic_id,
        f.doctor_id,
        f.rating,
        f.description as feedback_description,
        f."type" as feedback_type,
        di.full_name,
        di.gender,
        di.dob,
        a2.username,
        a2.email,
        a2.phone,
        a2."role",
        cmi.clinic_branch_name,
        cmi.full_name as full_name_clinic_branch,
        cmi.dob as clinic_branch_dob,
        cai.clinic_name as clinic_main_name,
        cai.description as clinic_description,
        cai.specialized_in,
        cai.pros,
        cai.paraclinical,
        cai.dob as clinic_main_dob,
        adr.address,
        adr.ward_name,
        adr.district_name,
        adr.province_name,
        f._id as feedback_id
      FROM feedbacks f
      LEFT JOIN doctor_information di ON di.account_id = f.doctor_id  
      LEFT JOIN accounts a2 ON a2._id = di.account_id    
      LEFT JOIN clinic_manager_information cmi ON cmi.account_id = f.clinic_id 
      LEFT JOIN accounts a3 ON a3._id = f.clinic_id 
      LEFT JOIN clinic_admin_information cai ON cai.account_id = a3.parent_id 
      LEFT JOIN addresses adr ON adr.account_id = a3._id
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatFeedbackContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'feedback',
          feedbackId: row.feedback_id,
          appointmentId: row.appointment_id,
          clinicId: row.clinic_id,
          doctorId: row.doctor_id,
          rating: row.rating,
          feedbackType: row.feedback_type,
          clinicName: row.clinic_main_name,
          doctorName: row.full_name,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} feedback entries.`);
  }

  private formatFeedbackContent(row: any): string {
    const parts = [
      `Rating: ${row.rating}/5 sao`,
      row.feedback_type ? `Feedback type: ${row.feedback_type}` : null,
      row.feedback_description
        ? `Feedback description: ${row.feedback_description}`
        : null,
      row.full_name ? `Doctor: ${row.full_name}` : null,
      row.clinic_main_name ? `Clinic: ${row.clinic_main_name}` : null,
      row.clinic_branch_name ? `Branch: ${row.clinic_branch_name}` : null,
      row.specialized_in
        ? `Specialized in: ${JSON.stringify(row.specialized_in)}`
        : null,
      row.address
        ? `Address: ${row.address}, ${row.ward_name}, ${row.district_name}, ${row.province_name}`
        : null,
    ];

    return parts.filter(Boolean).join('. ');
  }

  /**
   * Query 8: User/Patient information
   */
  private async seedUserInfo(): Promise<void> {
    const query = `
      SELECT 
        ga.full_name,
        ga.gender,
        ga.dob,
        a.username,
        a.email,
        a.phone,
        a."role",
        a.ban_counts,
        a.ban_description,
        ga._id as general_account_id,
        a._id as account_id
      FROM general_accounts ga 
      JOIN accounts a ON ga.account_id = a._id AND a."role" = 'PATIENT'
    `;

    const results = await this.dataSource.query(query);

    for (const row of results) {
      const content = this.formatUserContent(row);

      await this.knowledgeBaseRepository.createKnowledge({
        content,
        metadata: {
          type: 'user_info',
          generalAccountId: row.general_account_id,
          accountId: row.account_id,
          userName: row.full_name,
          role: row.role,
        },
      });
    }

    this.logger.log(`Seeded ${results.length} user entries.`);
  }

  private formatUserContent(row: any): string {
    const dob = row.dob ? new Date(row.dob).toLocaleDateString('vi-VN') : 'N/A';

    const parts = [
      `Patient: ${row.full_name || row.username}`,
      row.gender ? `Gender: ${row.gender}` : null,
      `Birthday: ${dob}`,
      `Email: ${row.email || 'N/A'}`,
      `Phone: ${row.phone || 'N/A'}`,
      row.ban_counts > 0 ? `Ban counts: ${row.ban_counts}` : null,
      row.ban_description ? `Ban description: ${row.ban_description}` : null,
    ];

    return parts.filter(Boolean).join('. ');
  }
}
