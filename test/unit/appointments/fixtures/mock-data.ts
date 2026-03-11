/**
 * Mock Data Fixtures for Appointments Unit Tests
 * 
 * Reusable mock data factories for:
 * - Redis booking sessions
 * - Raw schedule data (QueryBuilder results)
 * - Transaction entities
 */

/**
 * Create a mock Redis booking session
 * @param step Current step (1-4)
 * @param overrides Optional fields to override defaults
 * @returns JSON string for Redis storage
 */
export function mockRedisSession(
  step: 1 | 2 | 3 | 4,
  overrides: Record<string, any> = {}
): string {
  const baseSession = {
    sessionId: '550e8400-e29b-41d4-a716-446655440002',
    patientId: '550e8400-e29b-41d4-a716-446655440001',
    bookingOption: 'service',
    clinicId: '550e8400-e29b-41d4-a716-446655440003',
    clinicServiceConfigId: '550e8400-e29b-41d4-a716-446655440004',
    currentStep: step,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    ...overrides,
  };

  // Add fields based on step
  if (step >= 2) {
    Object.assign(baseSession, {
      appointmentDate: '2026-03-09',
      clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440006',
      doctorId: '550e8400-e29b-41d4-a716-446655440005',
    });
  }

  if (step >= 3) {
    Object.assign(baseSession, {
      paymentMethod: 'cod',
    });
  }

  if (step >= 4) {
    Object.assign(baseSession, {
      patientNote: '',
    });
  }

  // Apply overrides
  return JSON.stringify({ ...baseSession, ...overrides });
}

/**
 * Create mock raw schedule data (from QueryBuilder JOIN)
 * Simulates data from: employee_schedule JOIN clinic_shift JOIN clinic_shift_hour
 */
export function mockRawScheduleData(overrides: Partial<any>[] = []) {
  const defaultData = [
    {
      work_date: new Date('2026-03-09'),
      week_day: 'Monday',
      clinic_id: '550e8400-e29b-41d4-a716-446655440003',
      clinic_name: 'Phòng khám ABC',
      shift_type: 'MORNING',
      clinic_shift_hour_id: 'uuid-slot-1',
      doctor_id: '550e8400-e29b-41d4-a716-446655440005',
      doctor_name: 'BS. Nguyễn Văn A',
      doctor_specialty: 'Bác sĩ Xương Khớp',
      start_time: '08:00:00',
      end_time: '08:30:00',
      limit: 5,
      booked_count: 2,
      clinic_room: 'Phòng 101',
    },
    {
      work_date: new Date('2026-03-09'),
      week_day: 'Monday',
      clinic_id: '550e8400-e29b-41d4-a716-446655440003',
      clinic_name: 'Phòng khám ABC',
      shift_type: 'AFTERNOON',
      clinic_shift_hour_id: 'uuid-slot-2',
      doctor_id: '550e8400-e29b-41d4-a716-446655440005',
      doctor_name: 'BS. Nguyễn Văn A',
      doctor_specialty: 'Bác sĩ Xương Khớp',
      start_time: '14:00:00',
      end_time: '14:30:00',
      limit: 4,
      booked_count: 1,
      clinic_room: 'Phòng 102',
    },
    {
      work_date: new Date('2026-03-10'),
      week_day: 'Tuesday',
      clinic_id: '550e8400-e29b-41d4-a716-446655440003',
      clinic_name: 'Phòng khám ABC',
      shift_type: 'MORNING',
      clinic_shift_hour_id: 'uuid-slot-3',
      doctor_id: 'uuid-doctor-2',
      doctor_name: 'BS. Trần Thị B',
      doctor_specialty: 'Bác sĩ Tim Mạch',
      start_time: '09:00:00',
      end_time: '09:30:00',
      limit: 3,
      booked_count: 0,
      clinic_room: 'Phòng 103',
    },
  ];

  if (overrides.length === 0) {
    return defaultData;
  }

  return overrides.map((override, index) => ({
    ...defaultData[index] || defaultData[0],
    ...override,
  }));
}

/**
 * Create mock clinic entity
 */
export function mockClinicEntity(overrides: Record<string, any> = {}) {
  return {
    _id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Phòng khám ABC',
    address: '123 Đường ABC',
    isActive: true,
    ...overrides,
  };
}

/**
 * Create mock service config entity
 */
export function mockServiceConfigEntity(overrides: Record<string, any> = {}) {
  return {
    _id: '550e8400-e29b-41d4-a716-446655440004',
    serviceName: 'Khám Xương Khớp',
    price: 300000,
    isActive: true,
    ...overrides,
  };
}

/**
 * Create mock doctor entity
 */
export function mockDoctorEntity(overrides: Record<string, any> = {}) {
  return {
    _id: '550e8400-e29b-41d4-a716-446655440005',
    fullName: 'BS. Nguyễn Văn A',
    specialty: 'Bác sĩ Xương Khớp',
    isActive: true,
    ...overrides,
  };
}

/**
 * Create mock clinic shift hour (slot) entity
 */
export function mockSlotEntity(overrides: Record<string, any> = {}) {
  return {
    _id: '550e8400-e29b-41d4-a716-446655440006',
    limit: 10,
    booked_count: 5,
    start_time: '08:00:00',
    end_time: '08:30:00',
    date: '2026-03-09',
    ...overrides,
  };
}

/**
 * Create mock appointment entity
 */
export function mockAppointmentEntity(overrides: Record<string, any> = {}) {
  return {
    _id: 'appointment-id-1',
    patient_id: '550e8400-e29b-41d4-a716-446655440001',
    doctor_id: '550e8400-e29b-41d4-a716-446655440005',
    clinic_id: '550e8400-e29b-41d4-a716-446655440003',
    clinic_service_config_id: '550e8400-e29b-41d4-a716-446655440004',
    clinic_shift_hour_id: '550e8400-e29b-41d4-a716-446655440006',
    appointment_date: '2026-03-09',
    payment_method: 'cod',
    status: 'pending_confirmation',
    patient_note: '',
    created_at: new Date(),
    ...overrides,
  };
}

/**
 * Create mock services list (for doctor schedules)
 */
export function mockServicesList(overrides: Partial<any>[] = []) {
  const defaultServices = [
    {
      clinic_service_config_id: 'uuid-service-1',
      service_id: 'uuid-s1',
      service_name: 'Khám Xương Khớp',
      category_name: 'Khám Chuyên Khoa',
      price: '300000',
      discount: '10',
      final_price: '270000',
      description: 'Khám và tư vấn',
    },
    {
      clinic_service_config_id: 'uuid-service-2',
      service_id: 'uuid-s2',
      service_name: 'Khám Tổng Quát',
      category_name: 'Khám Tổng Quát',
      price: '200000',
      discount: '0',
      final_price: '200000',
      description: 'Khám sức khỏe tổng quát',
    },
  ];

  if (overrides.length === 0) {
    return defaultServices;
  }

  return overrides.map((override, index) => ({
    ...defaultServices[index] || defaultServices[0],
    ...override,
  }));
}
