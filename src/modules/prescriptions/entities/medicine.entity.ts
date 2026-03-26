import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

/**
 * Medicine Entity
 * 
 * Stores comprehensive information about medicines/drugs in the system
 * Used for Electronic Prescriptions and Electronic Medical Records
 * 
 * Features:
 * - Detailed drug classification (chemical, therapeutic, action classes)
 * - Multiple subtitle fields for comprehensive drug information
 * - Side effects tracking
 * - Habit-forming indicator for controlled substances
 * - Usage instructions
 * - Soft delete support (deletedAt)
 */
@Entity('medicines')
@Index('idx_medicine_name', ['name'])
export class Medicine {
  /**
   * Primary Key - UUID
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Medicine Name
   * 
   * Official name of the medicine (brand or generic)
   * Required field, indexed for fast search
   * 
   * Example: "Paracetamol", "Ibuprofen 400mg"
   */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Subtitle 0 - Primary Description
   * 
   * Primary descriptive information about the medicine
   * Could include: active ingredients, strength, form
   * 
   * Example: "500mg Tablet", "Oral Suspension 250mg/5ml"
   */
  @Column({ type: 'text', nullable: true, name: 'subtitle_0' })
  subtitle0?: string;

  /**
   * Subtitle 1 - Secondary Description
   * 
   * Additional descriptive information
   * Could include: manufacturer, packaging info
   */
  @Column({ type: 'text', nullable: true, name: 'subtitle_1' })
  subtitle1?: string;

  /**
   * Subtitle 2 - Tertiary Description
   * 
   * Further descriptive information
   * Could include: storage conditions, special notes
   */
  @Column({ type: 'text', nullable: true, name: 'subtitle_2' })
  subtitle2?: string;

  /**
   * Subtitle 3 - Quaternary Description
   * 
   * Additional descriptive information
   */
  @Column({ type: 'text', nullable: true, name: 'subtitle_3' })
  subtitle3?: string;

  /**
   * Subtitle 4 - Quinary Description
   * 
   * Additional descriptive information
   */
  @Column({ type: 'text', nullable: true, name: 'subtitle_4' })
  subtitle4?: string;

  /**
   * Side Effects
   * 
   * Known side effects and adverse reactions
   * Important for patient safety and informed consent
   * 
   * Example: "Drowsiness, nausea, headache, dizziness"
   */
  @Column({ type: 'text', nullable: true, name: 'side_effect' })
  sideEffect?: string;

  /**
   * Usage Instructions
   * 
   * How the medicine should be used
   * Includes: dosage, frequency, duration, special instructions
   * 
   * Example: "Take 1 tablet every 6 hours after meals. Do not exceed 4 tablets in 24 hours."
   */
  @Column({ type: 'text', nullable: true })
  used?: string;

  /**
   * Chemical Class
   * 
   * Chemical classification of the drug
   * Groups medicines by their chemical structure
   * 
   * Example: "NSAIDs", "Benzodiazepines", "Beta-lactam antibiotics"
   */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'chemical_class' })
  chemicalClass?: string;

  /**
   * Habit Forming
   * 
   * Indicates if the medicine has potential for dependency or addiction
   * Important for controlled substance tracking
   * 
   * Values:
   * - true: Habit-forming (requires special monitoring)
   * - false: Non-habit-forming
   * 
   * Example: Benzodiazepines, Opioids = true
   */
  @Column({ type: 'boolean', default: false, name: 'habit_forming' })
  habitForming: boolean;

  /**
   * Therapeutic Class
   * 
   * Classification based on therapeutic use/clinical application
   * Groups medicines by their clinical purpose
   * 
   * Example: "Analgesic", "Antibiotic", "Antihypertensive", "Antidiabetic"
   */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'therapeutic_class' })
  therapeuticClass?: string;

  /**
   * Action Class
   * 
   * Classification based on mechanism of action
   * How the drug works in the body
   * 
   * Example: "COX-2 inhibitor", "Calcium channel blocker", "ACE inhibitor"
   */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'action_class' })
  actionClass?: string;

  /**
   * Created At
   * 
   * Timestamp when the medicine record was created
   * Automatically set by TypeORM
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Updated At
   * 
   * Timestamp when the medicine record was last updated
   * Automatically updated by TypeORM
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Deleted At
   * 
   * Soft delete timestamp
   * When set, the record is considered deleted but remains in database
   * Allows for data recovery and audit trails
   */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
