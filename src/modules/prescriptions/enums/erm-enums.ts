/**
 * ERM Record Type Enum
 */
export enum ERMRecordType {
  CONSULTATION = 'CONSULTATION',
  ULTRASOUND = 'ULTRASOUND',
  XRAY = 'XRAY',
  LAB = 'LAB',
  BONE_DENSITY = 'BONE_DENSITY',
  PROCEDURE = 'PROCEDURE',
}

/**
 * ERM Status Enum
 */
export enum ERMStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SIGNED = 'SIGNED',
  CANCELLED = 'CANCELLED',
}

/**
 * Panel Name Enum
 */
export enum PanelName {
  INFLAMMATION = 'INFLAMMATION',
  GOUT = 'GOUT',
  METABOLIC = 'METABOLIC',
  AUTOIMMUNE = 'AUTOIMMUNE',
}

/**
 * Bone Site Enum
 */
export enum BoneSite {
  LUMBAR_SPINE = 'LUMBAR_SPINE',
  TOTAL_HIP = 'TOTAL_HIP',
  FEMORAL_NECK = 'FEMORAL_NECK',
  FOREARM = 'FOREARM',
}

/**
 * WHO Category Enum
 */
export enum WHOCategory {
  NORMAL = 'NORMAL',
  OSTEOPENIA = 'OSTEOPENIA',
  OSTEOPOROSIS = 'OSTEOPOROSIS',
}

/**
 * Body Side Enum
 */
export enum BodySide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  BILATERAL = 'BILATERAL',
}

/**
 * Immediate Outcome Enum
 */
export enum ImmediateOutcome {
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

/**
 * Visit Type Enum
 */
export enum VisitType {
  FIRST_VISIT = 'FIRST_VISIT',
  FOLLOW_UP = 'FOLLOW_UP',
  POST_PROCEDURE = 'POST_PROCEDURE',
  ROUTINE = 'ROUTINE',
  ONLINE = 'ONLINE',
  EMERGENCY = 'EMERGENCY',
}

/**
 * Severity Enum
 */
export enum Severity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}
