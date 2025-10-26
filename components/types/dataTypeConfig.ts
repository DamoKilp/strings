/**
 * Data Type Configuration
 * Created: July 8, 2025
 * 
 * Configuration definitions for all supported column data types.
 * Provides type-specific input components, validation rules, and default values.
 * 
 * Key Features:
 * - Type-specific UI component mapping
 * - Default values and constraints for each type
 * - Validation rules per data type
 * - Input component configuration
 * - Type-aware form generation
 */

// ✅ Import from canonical sources - NO DUPLICATION
import type { ColumnDefinition } from '../../../../types/DynamicTable';
import type { ValidationRule } from '../services/ColumnValidationService';
import React from 'react';

/**
 * Configuration for each supported data type
 */
export interface DataTypeConfig {
  label: string;
  description: string;
  category: 'text' | 'numeric' | 'logical' | 'temporal' | 'identifier' | 'media';
  defaultValue: any;
  nullableByDefault: boolean;
  
  // Input component configurations
  hasLengthLimit: boolean;
  hasMinMax: boolean;
  hasPattern: boolean;
  hasPrecisionScale: boolean;
  hasEnumValues: boolean;
  hasFormat: boolean;
  
  // UI component specifications
  inputComponent: string; // Component name for dynamic loading
  configComponent?: string; // Advanced configuration component
  previewComponent?: string; // Preview/display component
  
  // Validation and constraints
  validationRules: ValidationRule[];
  constraints: DataTypeConstraints;
  
  // Examples and help
  examples: string[];
  helpText: string;
  warningText?: string;
  
  // Database-specific settings
  postgresType: string;
  indexRecommended: boolean;
  performanceNotes?: string;
}

/**
 * Type-specific constraints and limits
 */
export interface DataTypeConstraints {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  precision?: { min: number; max: number; default: number };
  scale?: { min: number; max: number; default: number };
  pattern?: RegExp;
  allowedFormats?: string[];
  requiredFormat?: string;
}

/**
 * Input component props for type-specific inputs
 */
export interface TypeSpecificInputProps {
  value: any;
  onChange: (value: any) => void;
  config: DataTypeConfig;
  validation?: any;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Complete data type configuration registry
 */
export const DATA_TYPE_CONFIGS: Record<ColumnDefinition['type'], DataTypeConfig> = {
  text: {
    label: 'Text',
    description: 'Variable length text content for names, descriptions, and general text data',
    category: 'text',
    defaultValue: null,
    nullableByDefault: true,
    
    hasLengthLimit: true,
    hasMinMax: false,
    hasPattern: true,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: false,
    
    inputComponent: 'TextInput',
    configComponent: 'TextConfigPanel',
    previewComponent: 'TextPreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'type',
          message: 'Default value must be text',
          critical: true
        },
        condition: (col) => col.defaultValue !== null && col.defaultValue !== undefined
      }
    ],
    
    constraints: {
      minLength: 0,
      maxLength: 65535, // PostgreSQL TEXT limit
      pattern: undefined // No default pattern
    },
    
    examples: [
      'Product Name',
      'Customer Address', 
      'John Doe',
      'Lorem ipsum dolor sit amet...'
    ],
    helpText: 'Use for names, descriptions, comments, and any textual content',
    
    postgresType: 'TEXT',
    indexRecommended: true,
    performanceNotes: 'Consider using VARCHAR with length limit for better performance on large datasets'
  },

  integer: {
    label: 'Integer',
    description: 'Whole numbers without decimal places',
    category: 'numeric',
    defaultValue: 0, // ✅ CRITICAL FIX: Set default to 0 to prevent type detection issues
    nullableByDefault: true,
    
    hasLengthLimit: false,
    hasMinMax: true,
    hasPattern: false,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: false,
    
    inputComponent: 'IntegerInput',
    configComponent: 'IntegerConfigPanel',
    previewComponent: 'NumericPreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'type',
          message: 'Default value must be a whole number',
          critical: true
        },
        condition: (col) => col.defaultValue !== null && col.defaultValue !== undefined
      }
    ],
    
    constraints: {
      min: -2147483648, // 32-bit signed integer minimum
      max: 2147483647   // 32-bit signed integer maximum
    },
    
    examples: [
      '42',
      '1000',
      '-5',
      '0'
    ],
    helpText: 'Use for counts, quantities, IDs, and whole number values',
    warningText: 'Large integers may require BIGINT type for values outside ±2.1 billion',
    
    postgresType: 'INTEGER',
    indexRecommended: true,
    performanceNotes: 'Integers are highly optimized for sorting and mathematical operations'
  },

  decimal: {
    label: 'Decimal',
    description: 'Numbers with decimal places for precise calculations',
    category: 'numeric',
    defaultValue: 0.0, // ✅ CRITICAL FIX: Set default to 0.0 to prevent type detection issues
    nullableByDefault: true,
    
    hasLengthLimit: false,
    hasMinMax: true,
    hasPattern: false,
    hasPrecisionScale: true,
    hasEnumValues: false,
    hasFormat: false,
    
    inputComponent: 'DecimalInput',
    configComponent: 'DecimalConfigPanel',
    previewComponent: 'NumericPreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'type',
          message: 'Default value must be a number',
          critical: true
        },
        condition: (col) => col.defaultValue !== null && col.defaultValue !== undefined
      }
    ],
    
    constraints: {
      min: -999999999999.9999,
      max: 999999999999.9999,
      precision: { min: 1, max: 15, default: 10 },
      scale: { min: 0, max: 4, default: 2 }
    },
    
    examples: [
      '99.99',
      '1234.56',
      '0.001',
      '-500.25'
    ],
    helpText: 'Use for prices, measurements, percentages, and financial calculations',
    warningText: 'Consider precision and scale requirements for financial data',
    
    postgresType: 'DECIMAL(10,2)',
    indexRecommended: true,
    performanceNotes: 'DECIMAL provides exact precision but is slower than FLOAT for approximations'
  },

  boolean: {
    label: 'Boolean',
    description: 'True/false values for yes/no, enabled/disabled states',
    category: 'logical',
    defaultValue: false,
    nullableByDefault: true,
    
    hasLengthLimit: false,
    hasMinMax: false,
    hasPattern: false,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: false,
    
    inputComponent: 'BooleanInput',
    configComponent: 'BooleanConfigPanel',
    previewComponent: 'BooleanPreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'type',
          message: 'Default value must be true or false',
          critical: true
        },
        condition: (col) => col.defaultValue !== null && col.defaultValue !== undefined
      }
    ],
    
    constraints: {},
    
    examples: [
      'true',
      'false',
      'Is Active',
      'Is Published'
    ],
    helpText: 'Use for flags, toggles, and yes/no questions',
    
    postgresType: 'BOOLEAN',
    indexRecommended: false,
    performanceNotes: 'Boolean columns are not typically indexed due to low selectivity'
  },

  date: {
    label: 'Date',
    description: 'Calendar dates without time information',
    category: 'temporal',
    defaultValue: null,
    nullableByDefault: true,
    
    hasLengthLimit: false,
    hasMinMax: true,
    hasPattern: false,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: true,
    
    inputComponent: 'DateInput',
    configComponent: 'DateConfigPanel',
    previewComponent: 'DatePreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'pattern',
          value: /^\d{4}-\d{2}-\d{2}$/,
          message: 'Default value must be in YYYY-MM-DD format',
          critical: true
        },
        condition: (col) => typeof col.defaultValue === 'string' && col.defaultValue.length > 0
      }
    ],
    
    constraints: {
      min: new Date('1900-01-01').getTime(),
      max: new Date('2100-12-31').getTime(),
      allowedFormats: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
      requiredFormat: 'YYYY-MM-DD'
    },
    
    examples: [
      '2025-07-08',
      '1990-12-25',
      '2030-01-01',
      'Birth Date'
    ],
    helpText: 'Use for birth dates, deadlines, event dates, and scheduling',
    warningText: 'Dates are stored in YYYY-MM-DD format regardless of display format',
    
    postgresType: 'DATE',
    indexRecommended: true,
    performanceNotes: 'Date columns are excellent for range queries and sorting'
  },

  timestamp: {
    label: 'Timestamp',
    description: 'Date and time with timezone information',
    category: 'temporal',
    defaultValue: null,
    nullableByDefault: true,
    
    hasLengthLimit: false,
    hasMinMax: true,
    hasPattern: false,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: true,
    
    inputComponent: 'TimestampInput',
    configComponent: 'TimestampConfigPanel',
    previewComponent: 'TimestampPreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'pattern',
          value: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
          message: 'Default value must be a valid ISO timestamp',
          critical: true
        },
        condition: (col) => typeof col.defaultValue === 'string' && col.defaultValue.length > 0
      }
    ],
    
    constraints: {
      min: new Date('1900-01-01T00:00:00Z').getTime(),
      max: new Date('2100-12-31T23:59:59Z').getTime(),
      allowedFormats: ['ISO 8601', 'RFC 3339'],
      requiredFormat: 'ISO 8601'
    },
    
    examples: [
      '2025-07-08T10:30:00Z',
      '2023-12-25T18:00:00.000Z',
      'Created At',
      'Last Modified'
    ],
    helpText: 'Use for precise time tracking, logs, and audit trails',
    warningText: 'Always includes timezone information for consistency across regions',
    
    postgresType: 'TIMESTAMPTZ',
    indexRecommended: true,
    performanceNotes: 'TIMESTAMPTZ automatically handles timezone conversions'
  },

  uuid: {
    label: 'UUID',
    description: 'Universally unique identifiers for primary keys and references',
    category: 'identifier',
    defaultValue: null,
    nullableByDefault: false,
    
    hasLengthLimit: false,
    hasMinMax: false,
    hasPattern: true,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: false,
    
    inputComponent: 'UuidInput',
    configComponent: 'UuidConfigPanel',
    previewComponent: 'UuidPreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'pattern',
          value: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          message: 'Default value must be a valid UUID',
          critical: true
        },
        condition: (col) => typeof col.defaultValue === 'string' && col.defaultValue.length > 0
      }
    ],
    
    constraints: {
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    },
    
    examples: [
      '123e4567-e89b-12d3-a456-426614174000',
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      'User ID',
      'Reference Key'
    ],
    helpText: 'Use for unique identifiers that need to be globally unique',
    warningText: 'UUIDs are 128-bit values and take more storage than integers',
    
    postgresType: 'UUID',
    indexRecommended: true,
    performanceNotes: 'UUIDs prevent ID collision but are larger and less sequential than integers'
  },
  
  image: {
    label: 'Image',
    description: 'Image files with upload, thumbnail, and optimization capabilities',
    category: 'media',
    defaultValue: null,
    nullableByDefault: true,
    
    hasLengthLimit: false,
    hasMinMax: false,
    hasPattern: false,
    hasPrecisionScale: false,
    hasEnumValues: false,
    hasFormat: true,
    
    inputComponent: 'ImageInput',
    configComponent: 'ImageConfigPanel', 
    previewComponent: 'ImagePreview',
    
    validationRules: [
      {
        field: 'defaultValue',
        constraint: {
          type: 'type',
          message: 'Default value must be a valid image URL or null',
          critical: false
        },
        condition: (col) => col.defaultValue !== null && col.defaultValue !== undefined
      }
    ],
    
    constraints: {
      // Image-specific constraints handled by ImageStorageService
    },
    
    examples: [
      'https://example.com/photo.jpg',
      '/uploads/image123.png',
      'Profile Picture',
      'Product Image'
    ],
    helpText: 'Store image files with drag & drop upload, thumbnails, and optimization',
    warningText: 'Images can consume significant storage space',
    
    postgresType: 'TEXT',
    indexRecommended: false,
    performanceNotes: 'Image URLs stored as text, actual files stored separately in blob storage'
  }
};

/**
 * Type category groupings for UI organization
 */
export const TYPE_CATEGORIES = {
  text: {
    label: 'Text & Content',
    description: 'Text, descriptions, and content fields',
    types: ['text'] as ColumnDefinition['type'][]
  },
  numeric: {
    label: 'Numbers',
    description: 'Numerical values and calculations',
    types: ['integer', 'decimal'] as ColumnDefinition['type'][]
  },
  logical: {
    label: 'Boolean',
    description: 'True/false and yes/no values',
    types: ['boolean'] as ColumnDefinition['type'][]
  },
  temporal: {
    label: 'Dates & Time',
    description: 'Date and time information',
    types: ['date', 'timestamp'] as ColumnDefinition['type'][]
  },
  identifier: {
    label: 'Identifiers',
    description: 'Unique identifiers and keys',
    types: ['uuid'] as ColumnDefinition['type'][]
  },
  media: {
    label: 'Media & Files',
    description: 'Images, files, and media content',
    types: ['image'] as ColumnDefinition['type'][]
  }
};

/**
 * Get data type configuration by type
 */
export function getDataTypeConfig(type: ColumnDefinition['type']): DataTypeConfig {
  return DATA_TYPE_CONFIGS[type];
}

/**
 * Get all types in a specific category
 */
export function getTypesByCategory(category: keyof typeof TYPE_CATEGORIES): ColumnDefinition['type'][] {
  return TYPE_CATEGORIES[category].types;
}

/**
 * Get category for a specific type
 */
export function getCategoryForType(type: ColumnDefinition['type']): keyof typeof TYPE_CATEGORIES {
  for (const [categoryKey, categoryConfig] of Object.entries(TYPE_CATEGORIES)) {
    if (categoryConfig.types.includes(type)) {
      return categoryKey as keyof typeof TYPE_CATEGORIES;
    }
  }
  return 'text'; // Default fallback
}

/**
 * Get recommended types for common use cases
 */
export const COMMON_USE_CASES = {
  'Primary Key': ['uuid', 'integer'],
  'Name/Title': ['text'],
  'Description': ['text'],
  'Price/Amount': ['decimal'],
  'Quantity/Count': ['integer'],
  'Active/Enabled': ['boolean'],
  'Created Date': ['timestamp'],
  'Due Date': ['date'],
  'Email Address': ['text'],
  'Phone Number': ['text'],
  'Website URL': ['text']
} as const;

/**
 * Get type recommendations based on column name
 */
export function getTypeRecommendations(columnName: string): ColumnDefinition['type'][] {
  const lowercaseName = columnName.toLowerCase();
  
  // Email patterns
  if (lowercaseName.includes('email') || lowercaseName.includes('mail')) {
    return ['text'];
  }
  
  // Name patterns
  if (lowercaseName.includes('name') || lowercaseName.includes('title')) {
    return ['text'];
  }
  
  // Description patterns
  if (lowercaseName.includes('description') || lowercaseName.includes('comment') || lowercaseName.includes('note')) {
    return ['text'];
  }
  
  // Date patterns
  if (lowercaseName.includes('date') || lowercaseName.includes('time') || lowercaseName.includes('created') || lowercaseName.includes('updated')) {
    return ['timestamp', 'date'];
  }
  
  // Boolean patterns
  if (lowercaseName.startsWith('is_') || lowercaseName.startsWith('has_') || lowercaseName.includes('enabled') || lowercaseName.includes('active')) {
    return ['boolean'];
  }
  
  // Numeric patterns
  if (lowercaseName.includes('price') || lowercaseName.includes('amount') || lowercaseName.includes('cost') || lowercaseName.includes('rate')) {
    return ['decimal'];
  }
  
  if (lowercaseName.includes('count') || lowercaseName.includes('quantity') || lowercaseName.includes('number') || lowercaseName.includes('qty')) {
    return ['integer'];
  }
  
  // ID patterns (removed image patterns since image columns have their own dialog)
  if (lowercaseName.includes('id') || lowercaseName.includes('key') || lowercaseName.includes('reference')) {
    return ['uuid', 'integer'];
  }
  
  // Default to text for unknown patterns
  return ['text'];
}

/**
 * Validate type-specific constraints
 */
export function validateTypeConstraints(
  type: ColumnDefinition['type'], 
  value: any, 
  constraints?: Partial<DataTypeConstraints>
): { isValid: boolean; error?: string } {
  const config = getDataTypeConfig(type);
  const finalConstraints = { ...config.constraints, ...constraints };
  
  if (value === null || value === undefined) {
    return { isValid: true }; // Null values are handled separately
  }
  
  switch (type) {
    case 'text':
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Value must be text' };
      }
      if (finalConstraints.maxLength && value.length > finalConstraints.maxLength) {
        return { isValid: false, error: `Text exceeds maximum length of ${finalConstraints.maxLength}` };
      }
      if (finalConstraints.minLength && value.length < finalConstraints.minLength) {
        return { isValid: false, error: `Text must be at least ${finalConstraints.minLength} characters` };
      }
      if (finalConstraints.pattern && !finalConstraints.pattern.test(value)) {
        return { isValid: false, error: 'Text does not match required pattern' };
      }
      break;
      
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { isValid: false, error: 'Value must be a whole number' };
      }
      if (finalConstraints.min && value < finalConstraints.min) {
        return { isValid: false, error: `Value must be at least ${finalConstraints.min}` };
      }
      if (finalConstraints.max && value > finalConstraints.max) {
        return { isValid: false, error: `Value must be no more than ${finalConstraints.max}` };
      }
      break;
      
    case 'decimal':
      if (typeof value !== 'number' || !isFinite(value)) {
        return { isValid: false, error: 'Value must be a valid number' };
      }
      if (finalConstraints.min && value < finalConstraints.min) {
        return { isValid: false, error: `Value must be at least ${finalConstraints.min}` };
      }
      if (finalConstraints.max && value > finalConstraints.max) {
        return { isValid: false, error: `Value must be no more than ${finalConstraints.max}` };
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { isValid: false, error: 'Value must be true or false' };
      }
      break;
      
    case 'date':
      if (typeof value === 'string') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          return { isValid: false, error: 'Date must be in YYYY-MM-DD format' };
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { isValid: false, error: 'Invalid date' };
        }
        if (finalConstraints.min && date.getTime() < finalConstraints.min) {
          return { isValid: false, error: 'Date is too early' };
        }
        if (finalConstraints.max && date.getTime() > finalConstraints.max) {
          return { isValid: false, error: 'Date is too late' };
        }
      } else {
        return { isValid: false, error: 'Date must be a string in YYYY-MM-DD format' };
      }
      break;
      
    case 'timestamp':
      if (typeof value === 'string') {
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { isValid: false, error: 'Invalid timestamp' };
          }
        } catch {
          return { isValid: false, error: 'Invalid timestamp format' };
        }
      } else {
        return { isValid: false, error: 'Timestamp must be a string' };
      }
      break;
      
    case 'uuid':
      if (typeof value === 'string') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
          return { isValid: false, error: 'Invalid UUID format' };
        }
      } else {
        return { isValid: false, error: 'UUID must be a string' };
      }
      break;
  }
  
  return { isValid: true };
}

/**
 * Get default form values for a data type
 */
export function getDefaultFormValues(type: ColumnDefinition['type']): Partial<any> {
  const config = getDataTypeConfig(type);
  
  const defaults: any = {
    nullable: config.nullableByDefault,
    defaultValue: config.defaultValue
  };
  
  // Add type-specific defaults
  if (config.hasPrecisionScale && type === 'decimal') {
    defaults.precision = config.constraints.precision?.default;
    defaults.scale = config.constraints.scale?.default;
  }
  
  if (config.hasLengthLimit && config.constraints.maxLength) {
    defaults.maxLength = Math.min(config.constraints.maxLength, 255); // Reasonable default
  }
  
  return defaults;
}
