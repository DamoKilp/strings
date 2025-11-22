// /lib/modelUtils.ts
export function openAIImageModelLabel(modelId: string): string {
    switch (modelId) {
      case 'dall-e-2': return 'DALL-E 2';
      case 'dall-e-3': return 'DALL-E 3';
      case 'gpt-4o':   return 'GPT-4o (Image)';
      default:         return modelId;
    }
  }




