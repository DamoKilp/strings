// /lib/ai-services/client.ts

/**
 * Client-side utility functions for calling the AI Services API
 * This allows components to use AI features server-side where API keys are available
 */

export interface VectorSearchOptions {
  threshold?: number;
  count?: number;
  useProgressive?: boolean;
  targetResults?: number;
}

export interface ProjectAnalysisData {
  ProjectName: string;
  display_name: string;
  description?: string;
  is_system_project: boolean;
}

export interface CSVData {
  filename?: string;
  headers: string[];
  rows: string[][];
}

export interface AIAnalysisResult {
  suggestedTableName: string;
  suggestedDescription: string;
  confidence: number;
  reasoning: string;
  suggestedProject: string;
  projectContext?: Array<{
    content: string;
    similarity: number;
  }>;
  dataQuality?: {
    headerCount: number;
    rowCount: number;
    hasEmptyHeaders: boolean;
    estimatedDataTypes: Array<{
      header: string;
      estimatedType: string;
      confidence: number;
      uniqueValues: number;
      nullCount: number;
      sampleValues: string[];
      patterns: string[];
    }>;
    dataQualityScore: number;
    potentialKeys: string[];
    potentialRelationships: string[];
  };
  columnOptimizations?: Array<{
    column: string;
    currentType: string;
    suggestedType: string;
    reasoning: string;
    action: string;
  }>;
  namingImprovements?: Array<{
    current: string;
    suggested: string;
    reasoning: string;
  }>;
  dataQualityIssues?: Array<{
    issue: string;
    columns: string[];
    severity: 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  performanceOptimizations?: Array<{
    type: 'index' | 'constraint' | 'relationship';
    target: string;
    recommendation: string;
    benefit: string;
  }>;
  securityConsiderations?: Array<{
    concern: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Perform vector search using the server-side AI services API
 */
export async function performVectorSearch(
  query: string, 
  options: VectorSearchOptions = {}
): Promise<unknown[]> {
  const response = await fetch('/api/ai-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'vector_search',
      query,
      ...options
    }),
  });

  if (!response.ok) {
    throw new Error(`Vector search failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Vector search failed');
  }

  return data.results || [];
}

/**
 * Analyze CSV data for project association using AI
 */
export async function analyzeCSVForProject(
  projectData: ProjectAnalysisData,
  csvData: CSVData
): Promise<AIAnalysisResult> {
  const response = await fetch('/api/ai-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'project_analysis',
      projectData,
      csvData
    }),
  });

  if (!response.ok) {
    throw new Error(`Project analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Project analysis failed');
  }

  return data.analysis;
}

/**
 * Generate embeddings for text using the server-side API
 */
export async function generateEmbedding(
  text: string, 
  dimensions?: number
): Promise<number[]> {
  const response = await fetch('/api/ai-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'generate_embedding',
      text,
      dimensions
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Embedding generation failed');
  }

  return data.embedding || [];
}

/**
 * Analyze table optimization opportunities
 */
export async function analyzeTableOptimization(
  tableName: string,
  tableSchema: unknown,
  sampleData?: unknown[]
): Promise<unknown> {
  const response = await fetch('/api/ai-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'table_optimization',
      tableName,
      tableSchema,
      sampleData
    }),
  });

  if (!response.ok) {
    throw new Error(`Table optimization analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Table optimization analysis failed');
  }

  return data;
}

/**
 * Analyze CSV schema and provide recommendations
 */
export async function analyzeCSVSchema(
  headers: string[],
  sampleRows: string[][],
  projectContext?: string
): Promise<unknown> {
  const response = await fetch('/api/ai-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'schema_analysis',
      headers,
      sampleRows,
      projectContext
    }),
  });

  if (!response.ok) {
    throw new Error(`Schema analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Schema analysis failed');
  }

  return data;
}

/**
 * Generate AI-powered description for CSV table
 */
export async function generateTableDescription(
  csvData: CSVData,
  projectData: ProjectAnalysisData,
  tableName?: string
): Promise<string> {
  try {
    const response = await fetch('/api/ai-services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'generate_description',
        csvData,
        projectData,
        tableName
      }),
    });

    if (!response.ok) {
      throw new Error(`Description generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Description generation failed');
    }

    return data.description || '';
  } catch {

    
    // Fallback description
    const recordCount = csvData.rows.length;
    const columnCount = csvData.headers.length;
    return `Data table with ${recordCount} records and ${columnCount} columns. Imported from ${csvData.filename || 'CSV file'} for ${projectData.display_name} project.`;
  }
}
