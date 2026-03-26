import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ERM } from './erm.entity';
import { VisitType, Severity } from '../enums';

/**
 * ERMConsultation Entity
 *
 * Stores consultation records for patient visits
 */
@Entity('erm_consultations')
@Index('idx_erm_consultation_erm_id', ['ermId'])
export class ERMConsultation {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'erm_id', type: 'uuid' })
  ermId: string;

  @ManyToOne(() => ERM, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'erm_id' })
  erm?: ERM;

  @Column({
    name: 'visit_type',
    type: 'enum',
    enum: VisitType,
  })
  visitType: VisitType;

  @Column({ name: 'main_service_code', type: 'varchar', length: 50, nullable: true })
  mainServiceCode?: string;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint?: string;

  @Column({ name: 'onset_duration', type: 'text', nullable: true })
  onsetDuration?: string;

  @Column({ name: 'pain_location', type: 'text', nullable: true })
  painLocation?: string;

  @Column({ name: 'pain_character', type: 'text', nullable: true })
  painCharacter?: string;

  @Column({ name: 'pain_intensity', type: 'smallint', nullable: true })
  painIntensity?: number;

  @Column({ name: 'aggravating_factors', type: 'text', nullable: true })
  aggravatingFactors?: string;

  @Column({ name: 'relieving_factors', type: 'text', nullable: true })
  relievingFactors?: string;

  @Column({ name: 'functional_limitations', type: 'text', nullable: true })
  functionalLimitations?: string;

  @Column({ name: 'pastMsk_history', type: 'text', nullable: true })
  pastMskHistory?: string;

  @Column({ name: 'pastMedical_history', type: 'text', nullable: true })
  pastMedicalHistory?: string;

  @Column({ name: 'medication_history', type: 'text', nullable: true })
  medicationHistory?: string;

  @Column({ name: 'family_history', type: 'text', nullable: true })
  familyHistory?: string;

  @Column({ name: 'red_flags', type: 'jsonb', nullable: true })
  redFlags?: any;

  @Column({ name: 'vital_signs', type: 'jsonb', nullable: true })
  vitalSigns?: any;

  @Column({ name: 'inspection_findings', type: 'text', nullable: true })
  inspectionFindings?: string;

  @Column({ name: 'palpation_findings', type: 'text', nullable: true })
  palpationFindings?: string;

  @Column({ name: 'range_of_motion', type: 'jsonb', nullable: true })
  rangeOfMotion?: any;

  @Column({ name: 'special_tests', type: 'jsonb', nullable: true })
  specialTests?: any;

  @Column({ name: 'neuro_exam', type: 'text', nullable: true })
  neuroExam?: string;

  @Column({ name: 'gait_assessment', type: 'text', nullable: true })
  gaitAssessment?: string;

  @Column({ name: 'working_diagnosis', type: 'jsonb', nullable: true })
  workingDiagnosis?: any;

  @Column({
    name: 'severity',
    type: 'enum',
    enum: Severity,
    nullable: true,
  })
  severity?: Severity;

  @Column({ name: 'comorbid_impact', type: 'text', nullable: true })
  comorbidImpact?: string;

  @Column({ name: 'risk_factors', type: 'text', nullable: true })
  riskFactors?: string;

  @Column({ name: 'physiotherapy_plan', type: 'jsonb', nullable: true })
  physiotherapyPlan?: any;

  @Column({ name: 'education_advice', type: 'text', nullable: true })
  educationAdvice?: string;

  @Column({ name: 'follow_up_date', type: 'text', nullable: true })
  followUpDate?: string;

  @Column({ name: 'follow_up_condition', type: 'text', nullable: true })
  followUpCondition?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
