// /lib/codeUtils.ts
"use client"; // Keep if needed by logger or other parts, remove if purely server-side utils

/**
 * Interface representing a code block extracted from the assistant's message.
 */
export interface CodeBlock {
  filename: string;
  language: string;
  code: string;
  contentType?: string; // Optional: MIME type or specific identifier like 'json'
  isValid: boolean;     // Flag to indicate if the code block seems valid
  validationWarnings?: string[]; // Array to store validation warnings
  isPartial?: boolean;  // Added: Flag to indicate if this is a partial streaming block
}

/**
 * Logger utility to help with debugging extraction issues
 */
export class CodeExtractionLogger {
  private static logs: Array<{level: 'info'|'warn'|'error', message: string, timestamp: Date}> = [];
  private static debugging = false; // Set to true locally for verbose logs

  public static enableDebugging(enable: boolean = true) {
    this.debugging = enable;
  }

  public static info(message: string) {
    const entry = { level: 'info' as const, message, timestamp: new Date() };
    this.logs.push(entry);
   
  }

  public static warn(message: string) {
    const entry = { level: 'warn' as const, message, timestamp: new Date() };
    this.logs.push(entry);
    if (this.debugging) console.warn(`[CodeExtraction WARN] ${message}`);
  }

  public static error(message: string) {
    const entry = { level: 'error' as const, message, timestamp: new Date() };
    this.logs.push(entry);
    if (this.debugging) console.error(`[CodeExtraction ERROR] ${message}`);
  }

  public static getLogs() {
    return [...this.logs];
  }

  public static clearLogs() {
    this.logs = [];
  }
}

/**
 * Attempts to extract a filename from code content using various comment patterns.
 *
 * @param code - The complete code content to search for filename.
 * @param language - The programming language to help determine comment style.
 * @returns The extracted filename if found, otherwise a generated default name.
 */
export function extractFilename(code: string, language: string): string {
    // Look for explicit path or filename comments at the start of code
    // Adjusted patterns slightly for better matching
    const patterns = [
        // Filename patterns in various comment styles, trying to capture filenames directly
  /^\s*(?:\/\/|#|\/\*|<!--)\s*filename:\s*([\w./-]+)\s*(?:\*\/|-->)?/im, // Explicit filename tag (kept escapes needed for comment tokens)
  /^\s*\/\/\s*([\w./-]+)\s*$/m,    // JS/TS/etc. comment line with only filename/path
  /^\s*#\s*([\w./-]+)\s*$/m,       // Python/Shell comment line with only filename/path
  /^\s*<!--\s*([\w./-]+)\s*-->\s*$/m, // HTML comment line
  /^\s*\/\*\s*([\w./-]+)\s*\*\/\s*$/m, // CSS/Java block comment line
    ];

    for (const pattern of patterns) {
        const match = code.match(pattern);
        // Match[1] should be the captured filename/path
        if (match && match[1]) {
            const potentialFilename = match[1].trim();
            // Basic check if it looks like a filename (contains a dot)
            if (potentialFilename.includes('.')) {
                CodeExtractionLogger.info(`Found filename in code comment: ${potentialFilename}`);
                return potentialFilename;
            }
        }
    }

    // If no comment found, try to infer from first few lines (less reliable)
    // Example: `const MyComponent = () => { ... }` might infer `MyComponent.jsx`
    // This is complex and often inaccurate, sticking to comments is safer.

    // Generate default filename based on language if no filename found
    const defaultFilename = generateDefaultFilename(language);
    CodeExtractionLogger.warn(`No filename found in code, generating default: ${defaultFilename}`);
    return defaultFilename;
}


/**
 * Generates a default filename based on the language.
 *
 * @param language - The programming language.
 * @returns A default filename appropriate for the language.
 */
export function generateDefaultFilename(language: string): string {
  const normalizedLang = language.toLowerCase();

  const languageMap: Record<string, string> = {
    'javascript': 'script.js',
    'typescript': 'index.ts',
    'jsx': 'component.jsx',
    'tsx': 'component.tsx',
    'react': 'component.jsx', // Default React to jsx
    'html': 'index.html',
    'css': 'styles.css',
    'python': 'script.py',
    'java': 'Main.java',
    'c': 'main.c',
    'cpp': 'main.cpp',
    'csharp': 'Program.cs',
    'go': 'main.go',
    'ruby': 'script.rb',
    'php': 'index.php',
    'swift': 'main.swift',
    'kotlin': 'Main.kt',
    'rust': 'main.rs',
    'scala': 'Main.scala',
    'shell': 'script.sh',
    'bash': 'script.sh',
    'sql': 'query.sql',
    'json': 'data.json',
    'yaml': 'config.yaml',
    'xml': 'data.xml',
    'markdown': 'README.md',
    'plaintext': 'file.txt', // Added plaintext default
  };

  // Add timestamp to ensure uniqueness
  const timestamp = Date.now().toString(36);
  const baseFilename = languageMap[normalizedLang] || `file.${normalizedLang || 'txt'}`;
  const ext = baseFilename.split('.').pop() || 'txt';
  const name = baseFilename.substring(0, baseFilename.length - ext.length - 1);

  // Use a simpler default name structure
  return `/${name}-${timestamp}.${ext}`;
}

/**
 * Normalizes the language identifier.
 *
 * @param lang - The language identifier to normalize.
 * @returns A standardized language identifier.
 */
export function normalizeLanguage(lang: string): string {
  // Handle empty language case
  if (!lang || lang.trim() === '') {
    CodeExtractionLogger.warn('Empty language specifier, defaulting to plaintext');
    return 'plaintext';
  }

  // Simple map for common aliases
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'md': 'markdown',
    'sh': 'shell',
    'jsx': 'javascript', // Map jsx to javascript for Monaco, but keep context
    'tsx': 'typescript', // Map tsx to typescript for Monaco
    'c++': 'cpp',
    'c#': 'csharp',
    // Add more mappings as needed
  };

  const normalizedLang = lang.toLowerCase().trim();
  const result = langMap[normalizedLang] || normalizedLang;

  if (normalizedLang !== result) {
    CodeExtractionLogger.info(`Normalized language from '${normalizedLang}' to '${result}'`);
  }

  return result;
}


/**
 * Cleans up code content by removing unnecessary empty lines and formatting issues.
 *
 * @param code - The code to clean.
 * @returns Cleaned code.
 */
export function cleanCode(code: string): string {
  try {
    // Trim leading/trailing whitespace from the whole block first
    let cleaned = code.trim();

    // Remove potential "use client" directives; we'll add it back if needed.
    // Make this case-insensitive and handle optional semicolon/quotes
    cleaned = cleaned.replace(/^(['"`])use client\1;?\s*/i, '');

    // Ensure code ends with a single newline for consistency
    if (!cleaned.endsWith('\n')) {
      cleaned += '\n';
    }

    return cleaned;
  } catch (error) {
    CodeExtractionLogger.error(`Error cleaning code: ${error instanceof Error ? error.message : String(error)}`);
    return code; // Return original code if cleaning fails
  }
}

/**
 * Determines if code needs the "use client" directive based on filename and language.
 * Note: This logic is specific to Next.js App Router conventions.
 * @param filename - The filename of the code.
 * @param language - The language of the code.
 * @returns Whether "use client" should be added.
 */
export function needsUseClient(filename: string, language: string): boolean {
  // Simple check: Assume components directory or files ending in page/layout/client need it
   const clientPatterns = [
    // Match files directly inside a 'components' directory or subdirectories
    /(^|\/)components\/.*?\.(jsx|tsx)$/i,
    // Match page.jsx/tsx, layout.jsx/tsx, client.jsx/tsx conventions
    /(^|\/)app\/.*?\/(page|layout|client)\.(jsx|tsx)$/i,
     // Match files explicitly named ending with .client.jsx/tsx
     /\.client\.(jsx|tsx)$/i,
   ];

  const normalizedLang = language.toLowerCase();

  // Only consider adding for React component files
  if (!['javascript', 'typescript', 'jsx', 'tsx'].includes(normalizedLang)) {
    return false;
  }

  // Normalize path separators for cross-platform consistency
  const normalizedFilename = filename.replace(/\\/g, '/');

  const needsClient = clientPatterns.some(pattern => pattern.test(normalizedFilename));
  if (needsClient) {
    CodeExtractionLogger.info(`Adding "use client" directive to ${filename}`);
  }
  return needsClient;
}

/**
 * Validates a code block to ensure it's properly formed and complete.
 *
 * @param codeBlock - The code block to validate.
 * @returns The code block with validation information.
 */
export function validateCodeBlock(codeBlock: CodeBlock): CodeBlock {
  const warnings: string[] = [];
  let isValid = true;

  // Check if code is empty or just whitespace
  if (!codeBlock.code || codeBlock.code.trim() === '') {
    warnings.push('Code block is empty');
    isValid = false;
  }

  // Basic check for truncation (simple ellipsis check)
  if (codeBlock.code.includes('...') || codeBlock.code.includes('…')) {
      // Check if it's within a comment or string - less likely to be truncation
      const linesWithEllipsis = codeBlock.code.split('\n').filter(line => line.includes('...') || line.includes('…'));
      const isLikelyCommentOrString = linesWithEllipsis.every(line => /^\s*(\/\/|#|\*|<!--|['"`])/.test(line.trim()));

      if (!isLikelyCommentOrString) {
          warnings.push('Code may be truncated (contains ellipsis outside comments/strings)');
          // Consider setting isValid = false here if truncation is critical
          // isValid = false;
      }
  }


  // Add more language-specific checks if needed (like bracket balance)
  // Example for JS/TS/JSX/TSX bracket balance
  const langToCheckBrackets = ['javascript', 'typescript', 'jsx', 'tsx'];
  if (isValid && langToCheckBrackets.includes(codeBlock.language)) {
    const openBraces = (codeBlock.code.match(/{/g) || []).length;
    const closeBraces = (codeBlock.code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      warnings.push(`Potentially unbalanced braces: ${openBraces} opening vs ${closeBraces} closing`);
      // Decide if this makes it invalid
      // isValid = false;
    }
     const openParens = (codeBlock.code.match(/\(/g) || []).length;
     const closeParens = (codeBlock.code.match(/\)/g) || []).length;
     if (openParens !== closeParens) {
         warnings.push(`Potentially unbalanced parentheses: ${openParens} opening vs ${closeParens} closing`);
         // isValid = false;
     }
  }


  if (warnings.length > 0) {
    CodeExtractionLogger.warn(`Code block validation warnings for ${codeBlock.filename}: ${warnings.join(', ')}`);
  } else {
    CodeExtractionLogger.info(`Validated code block for ${codeBlock.filename}`);
  }

  return {
    ...codeBlock,
    isValid, // Keep the determined validity
    validationWarnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Determines the content type based on file extension.
 *
 * @param filename - The filename to analyze.
 * @returns The appropriate content type string, defaulting to 'text/plain'.
 */
export function determineContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  const contentTypeMap: Record<string, string> = {
    'js': 'application/javascript',
    'jsx': 'application/javascript', // Often treated as JS for content type
    'ts': 'application/typescript',
    'tsx': 'application/typescript',
    'html': 'text/html',
    'css': 'text/css',
    'json': 'application/json',
    'md': 'text/markdown',
    'py': 'text/x-python',
    'java': 'text/x-java-source', // More specific type
    'c': 'text/x-csrc',
    'cpp': 'text/x-c++src',
    'cs': 'text/x-csharp',
    'sh': 'application/x-shellscript',
    'xml': 'application/xml',
    'yaml': 'application/x-yaml',
    'sql': 'application/sql',
    'txt': 'text/plain',
    // Add more mappings for common types
  };

  return contentTypeMap[extension] || 'text/plain'; // Default to plain text
}


/**
 * Safely extracts all code blocks from the provided message content with robust error handling.
 *
 * @param content - The full text from which code blocks should be extracted.
 * @returns An array of CodeBlock objects.
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
    CodeExtractionLogger.clearLogs();
    CodeExtractionLogger.info('Starting code extraction process.');

    const codeBlocks: CodeBlock[] = [];
    const usedFilenames = new Set<string>();

    try {
        if (!content || typeof content !== 'string') {
            CodeExtractionLogger.error(`Invalid content type for extraction: ${typeof content}`);
            return [];
        }

        // Regex to capture language (optional) and code content within triple backticks
        // Allows for optional language specifier right after ```
        const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)\n```/g;
        let match;
        let blockIndex = 0;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            blockIndex++;
            CodeExtractionLogger.info(`Found potential code block #${blockIndex}.`);

            try {
                const language = normalizeLanguage(match[1] || 'plaintext'); // Group 1: language
                const rawCode = match[2] || '';          // Group 2: code content

                // Basic check for empty code block
                if (rawCode.trim() === '') {
                    CodeExtractionLogger.warn(`Skipping empty code block #${blockIndex}.`);
                    continue;
                }

                let code = cleanCode(rawCode);

                // Extract filename - use rawCode to find filename in original context
                let filename = extractFilename(rawCode, language);

                // Ensure filename uniqueness by appending index if needed
                let uniqueFilename = filename;
                let counter = 1;
                while (usedFilenames.has(uniqueFilename)) {
                    const parts = filename.split('.');
                    const ext = parts.pop() || 'txt';
                    const base = parts.join('.');
                    uniqueFilename = `${base}-${counter}.${ext}`;
                    counter++;
                }
                if (uniqueFilename !== filename) {
                    CodeExtractionLogger.warn(`Duplicate filename '${filename}', renamed to '${uniqueFilename}'.`);
                    filename = uniqueFilename;
                }
                usedFilenames.add(filename);


                // Refined: Remove filename comment *only if* it's the very first line
                const filenameLineRegex = new RegExp(`^\\s*(?://|#|/\\*|<!--)\\s*${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\*/|-->)?\\s*\\n?`, 'm');
                 // Check if the first non-empty line matches the filename comment
                 const firstLineMatch = code.trimStart().match(/^.*?\n/);
                 if (firstLineMatch && filenameLineRegex.test(firstLineMatch[0])) {
                    code = code.replace(filenameLineRegex, ''); // Remove it
                    code = code.trimStart(); // Clean up leading whitespace potentially left
                 }


                // Add "use client" if necessary *after* cleaning and filename removal
                 if (needsUseClient(filename, language) && !code.trimStart().startsWith('"use client"')) {
                    code = `"use client";\n\n${code.trimStart()}`; // Ensure only one directive and proper spacing
                 }


                const contentType = determineContentType(filename);

                const validatedBlock = validateCodeBlock({
                    filename,
                    language,
                    code,
                    contentType,
                    isValid: true, // Start assuming valid, validateCodeBlock modifies it
                });

                codeBlocks.push(validatedBlock);
                CodeExtractionLogger.info(`Successfully processed block #${blockIndex} as ${filename} (${language}).`);

            } catch (blockError) {
                CodeExtractionLogger.error(`Error processing block #${blockIndex}: ${blockError instanceof Error ? blockError.message : String(blockError)}`);
                // Optionally add a placeholder error block
                codeBlocks.push({
                    filename: `/error-${blockIndex}.txt`,
                    language: 'plaintext',
                    code: `// Error processing this block: ${blockError instanceof Error ? blockError.message : String(blockError)}\n// Original Content Snippet:\n${match[0].substring(0, 100)}...`,
                    isValid: false,
                    validationWarnings: ['Processing Error'],
                });
            }
        }

        if (blockIndex === 0) {
            CodeExtractionLogger.info('No code blocks found using ``` syntax.');
        } else {
            CodeExtractionLogger.info(`Extraction complete. Found ${codeBlocks.length} processable code blocks.`);
        }

        return codeBlocks;

    } catch (globalError) {
        CodeExtractionLogger.error(`Critical error during code block extraction: ${globalError instanceof Error ? globalError.message : String(globalError)}`);
        return [{ // Return a single error block
            filename: '/extraction-error.txt',
            language: 'plaintext',
            code: `/* Critical Error during extraction: ${globalError instanceof Error ? globalError.message : String(globalError)} */`,
            isValid: false,
            validationWarnings: ['Extraction Failed Critically'],
        }];
    }
}

/**
 * Enhanced code extraction fallback for cases when standard extraction fails.
 * This function attempts alternative approaches to extract code blocks from content.
 * 
 * @param content - The content to extract code blocks from
 * @returns An array of CodeBlock objects
 */
export function enhancedCodeExtraction(content: string): CodeBlock[] {
  CodeExtractionLogger.info("[EnhancedExtraction] Starting enhanced code extraction process");
  
  if (!content) {
    CodeExtractionLogger.warn("[EnhancedExtraction] Empty content provided");
    return [];
  }
  
  // First try the standard extraction
  const standardBlocks = extractCodeBlocks(content);
  if (standardBlocks.length > 0) {
    CodeExtractionLogger.info(`[EnhancedExtraction] Standard extraction successful, found ${standardBlocks.length} blocks`);
    return standardBlocks;
  }
  
  CodeExtractionLogger.info("[EnhancedExtraction] Standard extraction failed, trying alternative approaches");
  
  const blocks: CodeBlock[] = [];
  const usedFilenames = new Set<string>();
  
  try {
    // Alternative regex pattern that might catch slightly malformed code blocks
    const relaxedRegex = /```(\w+)?[\s\n]*([\s\S]*?)```/g;
    let match;
    let blockIndex = 0;
    
    while ((match = relaxedRegex.exec(content)) !== null) {
      blockIndex++;
      CodeExtractionLogger.info(`[EnhancedExtraction] Found potential code block #${blockIndex} with relaxed pattern`);
      
      try {
        const language = normalizeLanguage(match[1] || 'plaintext');
        let code = (match[2] || '').trim();
        
        // Skip empty blocks
        if (!code) {
          CodeExtractionLogger.warn(`[EnhancedExtraction] Skipping empty code block #${blockIndex}`);
          continue;
        }
        
        // Generate a default filename based on language
        let filename = generateDefaultFilename(language);
        
        // Ensure filename uniqueness
        let uniqueFilename = filename;
        let counter = 1;
        while (usedFilenames.has(uniqueFilename)) {
          const parts = filename.split('.');
          const ext = parts.pop() || 'txt';
          const base = parts.join('.');
          uniqueFilename = `${base}-${counter}.${ext}`;
          counter++;
        }
        
        filename = uniqueFilename;
        usedFilenames.add(filename);
        
        // Clean the code
        code = cleanCode(code);
        
        // Add "use client" directive if needed
        if (needsUseClient(filename, language) && !code.trimStart().startsWith('"use client"')) {
          code = `"use client";\n\n${code.trimStart()}`;
        }
        
        const contentType = determineContentType(filename);
        
        const codeBlock = validateCodeBlock({
          filename,
          language,
          code,
          contentType,
          isValid: true,
        });
        
        blocks.push(codeBlock);
        CodeExtractionLogger.info(`[EnhancedExtraction] Successfully processed block #${blockIndex} as ${filename} (${language})`);
        
      } catch (blockError) {
        CodeExtractionLogger.error(`[EnhancedExtraction] Error processing block #${blockIndex}: ${blockError instanceof Error ? blockError.message : String(blockError)}`);
        
        // Add an error block
        blocks.push({
          filename: `/enhanced-error-${blockIndex}.txt`,
          language: 'plaintext',
          code: `// Error during enhanced extraction: ${blockError instanceof Error ? blockError.message : String(blockError)}\n// Original Content Snippet:\n${match[0].substring(0, 100)}...`,
          isValid: false,
          validationWarnings: ['Enhanced Extraction Error'],
        });
      }
    }
    
    if (blockIndex === 0) {
      CodeExtractionLogger.warn("[EnhancedExtraction] No code blocks found even with relaxed pattern");
    } else {
      CodeExtractionLogger.info(`[EnhancedExtraction] Enhanced extraction complete. Found ${blocks.length} processable code blocks`);
    }
    
    return blocks;
    
  } catch (error) {
    CodeExtractionLogger.error(`[EnhancedExtraction] Critical error during enhanced extraction: ${error instanceof Error ? error.message : String(error)}`);
    
    return [{
      filename: '/enhanced-extraction-error.txt',
      language: 'plaintext',
      code: `/* Critical Error during enhanced extraction: ${error instanceof Error ? error.message : String(error)} */`,
      isValid: false,
      validationWarnings: ['Enhanced Extraction Failed Critically'],
    }];
  }
}

// --- UI Helpers ---

/**
 * Gets UI indicators for a code block (e.g., warning icon).
 *
 * @param codeBlock - The code block to check.
 * @returns Object with indicator flags and tooltip text.
 */
export function getCodeBlockUIIndicators(codeBlock: CodeBlock): {
  showWarningIcon: boolean;
  warningTooltip?: string;
  severity: 'none' | 'warning' | 'error';
} {
  if (!codeBlock.isValid) {
    return {
      showWarningIcon: true,
      warningTooltip: codeBlock.validationWarnings?.join('\n') || 'Invalid code block structure.',
      severity: 'error'
    };
  }

  if (codeBlock.validationWarnings && codeBlock.validationWarnings.length > 0) {
    return {
      showWarningIcon: true,
      warningTooltip: codeBlock.validationWarnings.join('\n'),
      severity: 'warning'
    };
  }

  return {
    showWarningIcon: false,
    severity: 'none'
  };
}

/**
 * Gets a diagnostic summary of the last extraction process.
 *
 * @param codeBlocks - The result of the last `extractCodeBlocks` call.
 * @returns A diagnostic summary object.
 */
export function getExtractionDiagnostics(codeBlocks: CodeBlock[]): {
  totalBlocksFound: number; // Total ``` blocks matched by regex
  processedBlocks: number; // Blocks successfully processed into CodeBlock objects
  validBlocks: number;   // Blocks marked as isValid: true
  invalidBlocks: number; // Blocks marked as isValid: false
  logs: ReturnType<typeof CodeExtractionLogger.getLogs>;
} {
    const logs = CodeExtractionLogger.getLogs();
    // Estimate total blocks found from logs or regex matches if possible
    const totalFound = logs.filter(l => l.message.startsWith('Found potential code block')).length;

  return {
    totalBlocksFound: totalFound, // Best guess based on logs
    processedBlocks: codeBlocks.length,
    validBlocks: codeBlocks.filter(block => block.isValid).length,
    invalidBlocks: codeBlocks.filter(block => !block.isValid).length,
    logs: logs // Get current logs
  };
}

/**
 * Ensures the record_id is the correct type for Supabase RPC.
 * - FM_CRS: number or string (text)
 * - All other dynamic tables: UUID string
 */
export function normalizeRecordIdForRpc(tableName: string, id: string | number): string | number {
  if (tableName === 'FM_CRS' || tableName === 'fm_crs') {
    // FM_CRS uses integer or text IDs
    return typeof id === 'number' ? id : String(id);
  }
  // All other dynamic tables use UUIDs (as strings)
  return String(id);
}