import { ApiProperty } from '@nestjs/swagger';

/**
 * Consultation Form Template DTO
 * Template for CONSULTATION type ERM form
 */
export class ConsultationFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'CONSULTATION' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      visitType: {
        type: 'enum',
        required: true,
        options: ['FIRST_VISIT', 'FOLLOW_UP', 'POST_PROCEDURE', 'ROUTINE', 'ONLINE', 'EMERGENCY'],
        label: 'Loại khám',
      },
      mainServiceCode: {
        type: 'text',
        required: false,
        label: 'Mã dịch vụ chính',
      },
      // Section 1: Thông tin khám
      chiefComplaint: {
        type: 'textarea',
        required: false,
        label: 'Lý do khám chính',
        section: 'Thông tin khám',
      },
      onsetDuration: {
        type: 'text',
        required: false,
        label: 'Thời gian khởi phát',
        section: 'Thông tin khám',
      },
      painLocation: {
        type: 'text',
        required: false,
        label: 'Vị trí đau',
        section: 'Thông tin khám',
      },
      painCharacter: {
        type: 'text',
        required: false,
        label: 'Đặc điểm đau',
        section: 'Thông tin khám',
      },
      painIntensity: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Mức độ đau (0-10)',
        section: 'Thông tin khám',
      },
      aggravatingFactors: {
        type: 'textarea',
        required: false,
        label: 'Yếu tố làm nặng',
        section: 'Thông tin khám',
      },
      relievingFactors: {
        type: 'textarea',
        required: false,
        label: 'Yếu tố làm giảm',
        section: 'Thông tin khám',
      },
      functionalLimitations: {
        type: 'textarea',
        required: false,
        label: 'Hạn chế chức năng',
        section: 'Thông tin khám',
      },
      // Section 2: Tiền sử
      pastMskHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử cơ xương khớp',
        section: 'Tiền sử',
      },
      pastMedicalHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử bệnh',
        section: 'Tiền sử',
      },
      medicationHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử dùng thuốc',
        section: 'Tiền sử',
      },
      familyHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử gia đình',
        section: 'Tiền sử',
      },
      redFlags: {
        type: 'json',
        required: false,
        label: 'Dấu hiệu cảnh báo',
        section: 'Tiền sử',
      },
      // Section 3: Khám lâm sàng
      vitalSigns: {
        type: 'json',
        required: false,
        label: 'Sinh hiệu',
        section: 'Khám lâm sàng',
        fields: {
          bloodPressure: 'Huyết áp',
          heartRate: 'Nhịp tim',
          temperature: 'Nhiệt độ',
          respiratoryRate: 'Nhịp thở',
        },
      },
      inspectionFindings: {
        type: 'textarea',
        required: false,
        label: 'Kết quả quan sát',
        section: 'Khám lâm sàng',
      },
      palpationFindings: {
        type: 'textarea',
        required: false,
        label: 'Kết quả sờ nắn',
        section: 'Khám lâm sàng',
      },
      rangeOfMotion: {
        type: 'json',
        required: false,
        label: 'Biên độ vận động',
        section: 'Khám lâm sàng',
      },
      specialTests: {
        type: 'json',
        required: false,
        label: 'Các test đặc biệt',
        section: 'Khám lâm sàng',
      },
      neuroExam: {
        type: 'textarea',
        required: false,
        label: 'Khám thần kinh',
        section: 'Khám lâm sàng',
      },
      gaitAssessment: {
        type: 'textarea',
        required: false,
        label: 'Đánh giá dáng đi',
        section: 'Khám lâm sàng',
      },
      // Section 4: Chẩn đoán và kế hoạch
      workingDiagnosis: {
        type: 'json',
        required: false,
        label: 'Chẩn đoán làm việc',
        section: 'Chẩn đoán và kế hoạch',
      },
      severity: {
        type: 'enum',
        required: false,
        options: ['MILD', 'MODERATE', 'SEVERE'],
        label: 'Mức độ nghiêm trọng',
        section: 'Chẩn đoán và kế hoạch',
      },
      comorbidImpact: {
        type: 'textarea',
        required: false,
        label: 'Ảnh hưởng bệnh kèm theo',
        section: 'Chẩn đoán và kế hoạch',
      },
      riskFactors: {
        type: 'textarea',
        required: false,
        label: 'Các yếu tố nguy cơ',
        section: 'Chẩn đoán và kế hoạch',
      },
      physiotherapyPlan: {
        type: 'json',
        required: false,
        label: 'Kế hoạch vật lý trị liệu',
        section: 'Chẩn đoán và kế hoạch',
      },
      educationAdvice: {
        type: 'textarea',
        required: false,
        label: 'Tư vấn giáo dục',
        section: 'Chẩn đoán và kế hoạch',
      },
      followUpDate: {
        type: 'text',
        required: false,
        label: 'Ngày tái khám',
        section: 'Chẩn đoán và kế hoạch',
      },
      followUpCondition: {
        type: 'textarea',
        required: false,
        label: 'Điều kiện tái khám',
        section: 'Chẩn đoán và kế hoạch',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
