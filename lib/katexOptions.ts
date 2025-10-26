// lib/katexOptions.ts
// Centralized KaTeX options and extensions (mhchem, macros)
// Imported by markdown renderers (MessageItem, DocumentPreview)

// Enable mhchem (\ce{}) syntaxes
import 'katex/contrib/mhchem';

export const katexMacros: Record<string, string> = {
  // Sets and fields
  "\\RR": "\\mathbb{R}",
  "\\NN": "\\mathbb{N}",
  "\\ZZ": "\\mathbb{Z}",
  "\\QQ": "\\mathbb{Q}",
  "\\CC": "\\mathbb{C}",
  // Probability & statistics
  "\\EE": "\\mathbb{E}",
  "\\Var": "\\operatorname{Var}",
  "\\Cov": "\\operatorname{Cov}",
  // Optimization
  "\\argmin": "\\mathop{\\mathrm{arg\\,min}}\\limits",
  "\\argmax": "\\mathop{\\mathrm{arg\\,max}}\\limits",
  // Vectors and norms
  "\\vect": "{\\boldsymbol{#1}}",
  "\\norm": "{\\left\\lVert #1 \\right\\rVert}",
  // SI (lightweight helpers)
  "\\SI": "{#1\\,\\mathrm{#2}}",
  "\\si": "{\\mathrm{#1}}",
};

export const katexOptions = {
  throwOnError: false,
  errorColor: '#cc0000',
  // Suppress noisy console warnings for benign unicode in math (e.g., en dashes)
  // while preserving other warnings. KaTeX will still render with throwOnError=false.
  strict: (errorCode: string) => {
    // Common benign cases we want to ignore in chat content
    if (errorCode === 'unknownSymbol' || errorCode === 'unicodeTextInMathMode') {
      return 'ignore';
    }
    return 'warn';
  },
  macros: katexMacros,
};


