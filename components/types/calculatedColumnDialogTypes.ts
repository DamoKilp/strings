/**
 * Calculated Column Dialog Types
 * Created: July 9, 2025
 * 
 * Dialog-specific type extensions for Add Calculated Column functionality.
 * Follows TYPE DISCOVERY HIERARCHY - imports from existing types, never duplicates.
 * 
 * Architecture Compliance:
 * - Extends existing types from dataWorkbench/types hierarchy
 * - Dialog-specific enums and interfaces only
 * - NO component props (those go in component files)
 * - Full TypeScript coverage for dialog state management
 */

// CRITICAL: Import from existing type hierarchy (RULE 1 & 2 from AI_RULES.md)
import type { CalculatedColumnDefinition, FormulaValidationResult } from '@/app/Projects/dataWorkbench/types/calculatedTypes';
import type { GridColumnDefinition } from '@/app/Projects/dataWorkbench/types/gridTypes';
import type { RelationshipDefinition } from '@/types/DynamicTable';

// =============================================================================
// DIALOG STEP MANAGEMENT
// =============================================================================

/**
 * Dialog Step Enumeration
 * 3-step wizard flow for Excel-like formula creation experience
 */
export enum CalculatedColumnStep {
  IDENTITY = 'identity',       // Column name, display name, description
  FORMULA = 'formula',         // Formula input with template library
  DEPENDENCIES = 'dependencies' // Dependency analysis, validation, and confirmation
}

// =============================================================================
// DIALOG STATE MANAGEMENT
// =============================================================================

/**
 * Dialog Props Interface
 * Props passed to main AddCalculatedColumnDialog component
 */
export interface CalculatedColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  existingColumns: GridColumnDefinition[];
  editingColumn?: CalculatedColumnDefinition; // NEW: Optional column to edit
}

/**
 * Dialog Form State
 * Complete state for dialog form data and validation
 * Extends existing types without duplication
 */
export interface CalculatedColumnFormState {
  base: Pick<CalculatedColumnDefinition, 'name' | 'display_name' | 'formula'> & {
    description?: string; // Optional description field
  };
  currentStep: CalculatedColumnStep;
  selectedTemplate?: FormulaTemplate;
  validationState: CrossTableValidationResult;
  dependencyAnalysis: DependencyAnalysisResult;
  previewResults: any[];
  isValid: boolean;
}

// =============================================================================
// FORMULA TEMPLATE SYSTEM
// =============================================================================

/**
 * Formula Template Category
 * Categories for organizing formula templates
 */
export type FormulaCategory = 'math' | 'text' | 'lookup' | 'logic' | 'date' | 'aggregate';

/**
 * Parameter Guide for Template Help
 * Provides parameter documentation for formula templates
 */
export interface ParameterGuide {
  name: string;
  type: 'column' | 'value' | 'condition' | 'range';
  description: string;
  required: boolean;
  example?: string;
}

/**
 * Formula Template Definition
 * Template for Excel-like formula functions with cross-table support
 */
export interface FormulaTemplate {
  id: string;
  name: string;
  category: FormulaCategory;
  description: string;
  syntax: string;
  example: string;
  parameterHelp: ParameterGuide[];
  crossTable?: boolean;           // Indicates cross-table capability
  performanceWarning?: string;    // Warning for resource-intensive formulas
  compatibilityLevel: 'basic' | 'advanced' | 'experimental';
}

// =============================================================================
// CROSS-TABLE VALIDATION
// =============================================================================

/**
 * Table Reference in Formula
 * Represents a reference to another table in cross-table formulas
 */
export interface TableReference {
  tableName: string;
  columnName: string;
  fullReference: string;         // Full reference text (e.g., "Components[Value]")
  isValid?: boolean;
  validationMessage?: string;
}

/**
 * Cross-Table Validation Result
 * Extends base FormulaValidationResult with cross-table specific validation
 */
export interface CrossTableValidationResult extends FormulaValidationResult {
  requiredRelationships: RelationshipDefinition[];
  tableReferences: TableReference[];
  performanceWarnings: string[];
  crossTableComplexity: number;  // Complexity score for cross-table operations
  estimatedRowsAffected: number;
}

/**
 * Dependency Analysis Result
 * Analysis of formula dependencies and circular reference detection
 */
export interface DependencyAnalysisResult {
  directDependencies: string[];
  indirectDependencies: string[];
  circularReferences: CircularReferenceInfo[];
  dependencyDepth: number;
  isCircular: boolean;
  calculationOrder: number;
}

/**
 * Circular Reference Information
 * Details about detected circular references
 */
export interface CircularReferenceInfo {
  columnName: string;
  referenceChain: string[];
  message: string;
  severity: 'error' | 'warning';
}

// =============================================================================
// VALIDATION PROGRESS TRACKING
// =============================================================================

/**
 * Validation Progress Status
 * Progress tracking for async validation operations
 */
export type ValidationStatus = 'starting' | 'syntax' | 'relationships' | 'dependencies' | 'performance' | 'complete' | 'error';

/**
 * Validation Progress Information
 * Real-time progress updates during validation
 */
export interface ValidationProgress {
  status: ValidationStatus;
  progress: number;               // 0-100 percentage
  step: string;                   // Current validation step description
  details?: string;               // Additional progress details
}

// =============================================================================
// TEMPLATE CACHING
// =============================================================================

/**
 * Template Cache Entry
 * Cache structure for formula templates by category
 */
export interface TemplateCacheEntry {
  templates: FormulaTemplate[];
  timestamp: number;
  category: FormulaCategory;
}

/**
 * Template Cache Map
 * Map of category to cached templates
 */
export type TemplateCacheMap = Record<FormulaCategory, TemplateCacheEntry>;

// =============================================================================
// DIALOG SECTION PROPS
// =============================================================================

/**
 * Identity Section Props
 * Props for the column identity configuration step
 */
export interface IdentitySectionProps {
  formData: CalculatedColumnFormState | null;
  onUpdate: (data: Partial<CalculatedColumnFormState>) => void;
  existingColumns: GridColumnDefinition[];
  editingColumn?: CalculatedColumnDefinition; // NEW: Add editing column for validation exclusion
}

/**
 * Formula Input Section Props
 * Props for the formula input and template selection step
 */
export interface FormulaInputSectionProps {
  formula: string;
  onChange: (formula: string) => void;
  validationState: CrossTableValidationResult | null;
  templates: FormulaTemplate[];
  isValidating?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * Dependency Analysis Section Props
 * Props for the dependency analysis and validation step
 */
export interface DependencyAnalysisSectionProps {
  validationResult: CrossTableValidationResult | null;
  tableName: string;
  onAnalysisComplete?: (analysis: DependencyAnalysisResult) => void;
}

/**
 * Preview Results Section Props
 * Props for the preview and performance analysis step
 */
export interface PreviewResultsSectionProps {
  formula: string;
  tableName: string;
  workerStatus: 'idle' | 'initializing' | 'ready' | 'calculating' | 'error';
  onPreviewComplete?: (results: any[]) => void;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for CrossTableValidationResult
 */
export function isCrossTableValidationResult(
  result: FormulaValidationResult | CrossTableValidationResult
): result is CrossTableValidationResult {
  return 'requiredRelationships' in result && 'tableReferences' in result;
}

/**
 * Type guard for FormulaTemplate
 */
export function isFormulaTemplate(obj: any): obj is FormulaTemplate {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' && 
    typeof obj.syntax === 'string' &&
    Array.isArray(obj.parameterHelp);
}

/**
 * Type guard for cross-table template
 */
export function isCrossTableTemplate(template: FormulaTemplate): boolean {
  return template.crossTable === true;
}
