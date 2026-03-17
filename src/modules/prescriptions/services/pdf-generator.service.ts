import { Injectable } from '@nestjs/common';
import * as PdfPrinter from 'pdfmake';
import {
  TDocumentDefinitions,
  Content,
  TFontDictionary,
} from 'pdfmake/interfaces';
import { PatientEPrescriptionDetailResponseDto } from '../dto';

/**
 * PDF Generator Service
 *
 * Generates PDF documents for E-Prescriptions with medical/legal compliance
 * Supports Vietnamese characters using UTF-8 fonts
 */
@Injectable()
export class PdfGeneratorService {
  /**
   * Font definitions for PDF generation
   * Using default Roboto font family which supports Vietnamese characters
   */
  private readonly fonts: TFontDictionary = {
    Roboto: {
      normal: Buffer.from(
        require('pdfmake/build/vfs_fonts.js')['Roboto-Regular.ttf'],
        'base64',
      ),
      bold: Buffer.from(
        require('pdfmake/build/vfs_fonts.js')['Roboto-Medium.ttf'],
        'base64',
      ),
      italics: Buffer.from(
        require('pdfmake/build/vfs_fonts.js')['Roboto-Italic.ttf'],
        'base64',
      ),
      bolditalics: Buffer.from(
        require('pdfmake/build/vfs_fonts.js')['Roboto-MediumItalic.ttf'],
        'base64',
      ),
    },
  };

  /**
   * Generate E-Prescription PDF
   *
   * Creates a professionally formatted medical prescription document
   * with clinic, doctor, patient information and medicine details
   *
   * @param {Object} payload - Data payload for PDF generation
   * @param {PatientEPrescriptionDetailResponseDto} payload.ePrescription - E-Prescription details
   * @param {Object} payload.aggregatedData - Clinic, doctor, patient metadata
   * @returns {Promise<Buffer>} PDF binary data
   */
  async generateEPrescriptionPdf(payload: {
    ePrescription: PatientEPrescriptionDetailResponseDto;
    aggregatedData: {
      clinic_id?: string;
      clinic_name?: string;
      clinic_address?: string;
      clinic_phone?: string;
      clinic_logo?: string;
      doctor_id?: string;
      doctor_name?: string;
      doctor_degree?: string;
      doctor_position?: string;
      patient_name?: string;
      patient_dob?: Date;
      patient_gender?: string;
      patient_phone?: string;
      appointment_date?: Date;
      appointment_id?: string;
    };
  }): Promise<Buffer> {
    const { ePrescription, aggregatedData } = payload;

    // Build PDF document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
      content: [
        // Header Section
        ...this.buildHeader(aggregatedData),

        // Divider
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 },
          ],
          margin: [0, 10, 0, 10],
        },

        // Document Title
        {
          text: 'ĐỚN THUỐC ĐIỆN TỬ',
          style: 'title',
          alignment: 'center',
          margin: [0, 10, 0, 5],
        },
        {
          text: 'ELECTRONIC PRESCRIPTION',
          style: 'subtitle',
          alignment: 'center',
          margin: [0, 0, 0, 15],
        },

        // Patient Information Section
        ...this.buildPatientInfo(aggregatedData),

        // Prescription Details Section
        ...this.buildPrescriptionDetails(ePrescription),

        // Doctor Note Section (if exists)
        ...this.buildDoctorNote(ePrescription.doctor_note),

        // Signature Section
        ...this.buildSignatureSection(aggregatedData, ePrescription.created_at),

        // Footer/Legal Disclaimer
        ...this.buildFooter(),
      ],
      styles: {
        title: {
          fontSize: 18,
          bold: true,
          color: '#2c3e50',
        },
        subtitle: {
          fontSize: 12,
          italics: true,
          color: '#7f8c8d',
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          color: '#34495e',
          margin: [0, 10, 0, 5],
        },
        infoText: {
          fontSize: 10,
          margin: [0, 2, 0, 2],
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#3498db',
        },
        footer: {
          fontSize: 8,
          italics: true,
          color: '#95a5a6',
          alignment: 'center',
        },
      },
    };

    // Generate PDF
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const printer = new (PdfPrinter as any)(this.fonts);
        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build PDF Header with Clinic Information
   */
  private buildHeader(data: any): Content[] {
    const header: Content[] = [
      {
        columns: [
          // Clinic Logo (if available)
          data.clinic_logo
            ? {
                image: data.clinic_logo,
                width: 60,
                height: 60,
              }
            : { text: '', width: 60 },
          // Clinic Information
          {
            stack: [
              {
                text: data.clinic_name || 'Clinic Name',
                style: 'sectionHeader',
                fontSize: 14,
                bold: true,
              },
              {
                text: data.clinic_address || '',
                fontSize: 9,
                margin: [0, 2, 0, 2] as [number, number, number, number],
              },
              {
                text: `Điện thoại: ${data.clinic_phone || 'N/A'}`,
                fontSize: 9,
              },
            ],
            width: '*',
          },
        ],
      },
    ];

    return header;
  }

  /**
   * Build Patient Information Section
   */
  private buildPatientInfo(data: any): Content[] {
    const patientGender =
      data.patient_gender === 'Male'
        ? 'Nam'
        : data.patient_gender === 'Female'
          ? 'Nữ'
          : 'Khác';
    const patientDob = data.patient_dob
      ? new Date(data.patient_dob).toLocaleDateString('vi-VN')
      : 'N/A';

    return [
      { text: 'THÔNG TIN BỆNH NHÂN', style: 'sectionHeader' },
      {
        columns: [
          {
            width: '50%',
            stack: [
              {
                text: `Họ và tên: ${data.patient_name || 'N/A'}`,
                style: 'infoText',
              },
              { text: `Ngày sinh: ${patientDob}`, style: 'infoText' },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: `Giới tính: ${patientGender}`, style: 'infoText' },
              {
                text: `Điện thoại: ${data.patient_phone || 'N/A'}`,
                style: 'infoText',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
    ];
  }

  /**
   * Build Prescription Details Table
   */
  private buildPrescriptionDetails(
    ePrescription: PatientEPrescriptionDetailResponseDto,
  ): Content[] {
    // Prepare table rows
    const tableBody: any[][] = [
      // Header row
      [
        { text: 'STT', style: 'tableHeader', alignment: 'center' },
        { text: 'Tên thuốc', style: 'tableHeader' },
        { text: 'Liều lượng', style: 'tableHeader' },
        { text: 'Số lượng', style: 'tableHeader', alignment: 'center' },
        { text: 'Cách dùng', style: 'tableHeader' },
      ],
    ];

    // Data rows
    ePrescription.detail_e_prescriptions.forEach((detail, index) => {
      tableBody.push([
        { text: (index + 1).toString(), alignment: 'center' },
        {
          stack: [
            { text: detail.medicine.name || 'N/A', bold: true },
            ...(detail.medicine.subtitle_0
              ? [
                  {
                    text: detail.medicine.subtitle_0,
                    fontSize: 8,
                    italics: true,
                  },
                ]
              : []),
          ],
        },
        { text: detail.medicine.subtitle_0 || 'N/A', fontSize: 9 },
        { text: detail.quantity?.toString() || 'N/A', alignment: 'center' },
        {
          stack: [
            {
              text: detail.check_out || detail.medicine.usage || 'N/A',
              fontSize: 9,
            },
            ...(detail.note
              ? [
                  {
                    text: `Ghi chú: ${detail.note}`,
                    fontSize: 8,
                    italics: true,
                    margin: [0, 2, 0, 0] as [number, number, number, number],
                  },
                ]
              : []),
          ],
        },
      ]);
    });

    return [
      { text: 'CHI TIẾT ĐƠN THUỐC', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: [30, '*', 80, 60, 120],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => {
            return rowIndex === 0
              ? '#3498db'
              : rowIndex % 2 === 0
                ? '#ecf0f1'
                : null;
          },
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#bdc3c7',
          vLineColor: () => '#bdc3c7',
        },
        margin: [0, 0, 0, 15],
      },
    ];
  }

  /**
   * Build Doctor Note Section
   */
  private buildDoctorNote(doctorNote?: string): Content[] {
    if (!doctorNote) {
      return [];
    }

    return [
      { text: 'LỜI DẶN CỦA BÁC SĨ', style: 'sectionHeader' },
      {
        text: doctorNote,
        margin: [10, 5, 10, 15],
        italics: true,
        fontSize: 10,
      },
    ];
  }

  /**
   * Build Signature Section
   */
  private buildSignatureSection(data: any, createdAt: Date): Content[] {
    const formattedDate = new Date(createdAt).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const doctorTitle = data.doctor_degree
      ? `${data.doctor_degree} ${data.doctor_name || ''}`
      : data.doctor_name || 'Bác sĩ';

    const signatureStack: Content[] = [
      {
        text: `Ngày kê đơn: ${formattedDate}`,
        alignment: 'center',
        fontSize: 9,
        italics: true,
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      {
        text: 'BÁC SĨ KÊ ĐƠN',
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 50] as [number, number, number, number],
      },
      {
        text: doctorTitle,
        alignment: 'center',
        bold: true,
      },
    ];

    if (data.doctor_position) {
      signatureStack.push({
        text: data.doctor_position,
        alignment: 'center',
        fontSize: 9,
        italics: true,
      });
    }

    return [
      {
        columns: [
          { text: '', width: '50%' },
          {
            stack: signatureStack,
            width: '50%',
          },
        ],
        margin: [0, 20, 0, 0] as [number, number, number, number],
      },
    ];
  }

  /**
   * Build Footer with Legal Disclaimer
   */
  private buildFooter(): Content[] {
    return [
      {
        text: [
          'Đơn thuốc này chỉ có giá trị sử dụng một lần. ',
          'Không tự ý thay đổi liều lượng hoặc ngừng dùng thuốc khi chưa có ý kiến của bác sĩ. ',
          'Bảo quản thuốc ở nơi khô ráo, thoáng mát.',
        ],
        style: 'footer',
        margin: [0, 30, 0, 0],
      },
      {
        text: `Tài liệu được tạo tự động bởi hệ thống Bonix - ${new Date().toLocaleDateString('vi-VN')}`,
        style: 'footer',
        margin: [0, 10, 0, 0],
      },
    ];
  }
}
