import { LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { mistral } from '@ai-sdk/mistral';
import { perplexity } from '@ai-sdk/perplexity';
import { deepseek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getConfig } from './config.js';

// GitHub Models API endpoint
const GITHUB_MODELS_BASE_URL = 'https://models.github.ai/inference';

// GitHub Models provider - uses OpenAI-compatible API at models.github.ai
function createGitHubModels(githubToken: string) {
  return createOpenAICompatible({
    baseURL: GITHUB_MODELS_BASE_URL,
    apiKey: githubToken,
    name: 'github-models',
  });
}

/**
 * Get a list of available GitHub Models model IDs
 * See: https://github.com/marketplace/models
 */
export const GITHUB_MODELS_CATALOG = {
  // OpenAI models
  'openai/gpt-4o': 'General purpose, multimodal',
  'openai/gpt-4.1': 'Latest OpenAI, superior coding',
  'openai/gpt-4.1-mini': 'Balanced performance/cost',
  'openai/gpt-4.1-nano': 'Fastest, lowest cost',
  // Meta models
  'meta/llama-3.3-70b-instruct': 'Open source, high quality',
  'meta/llama-4-scout-17b-16e-instruct': '10M token context',
  // Mistral models
  'mistral-ai/codestral-2501': 'Specialized code generation',
  // DeepSeek models  
  'deepseek/deepseek-r1': 'Reasoning tasks',
} as const;

// Provider configurations with their default models
interface ProviderConfig {
  name: string;
  createModel: () => LanguageModel | null;
  isAvailable: () => boolean;
}

function getProviderConfigs(): ProviderConfig[] {
  const config = getConfig();

  return [
    // GitHub Models is the default provider (enabled by default, uses GITHUB_TOKEN)
    // Note: Claude models are NOT available - use OpenAI, Meta, Mistral, xAI, or DeepSeek models
    {
      name: 'github-models',
      isAvailable: () => !!config.useGitHubModels && !!config.githubToken,
      createModel: () => {
        if (!config.useGitHubModels || !config.githubToken) return null;
        const githubModels = createGitHubModels(config.githubToken);
        // Default to GPT-4o, can be overridden via GITHUB_MODELS_MODEL env var
        return githubModels(config.githubModelsModel || 'openai/gpt-4o');
      },
    },
    {
      name: 'google',
      isAvailable: () => !!config.googleApiKey,
      createModel: () => config.googleApiKey
        ? google(config.modelId || 'gemini-2.0-flash-exp')
        : null,
    },
    {
      name: 'groq',
      isAvailable: () => !!config.groqApiKey,
      createModel: () => config.groqApiKey
        ? groq('llama-3.3-70b-versatile')
        : null,
    },
    {
      name: 'openai',
      isAvailable: () => !!config.openaiApiKey,
      createModel: () => config.openaiApiKey
        ? openai('gpt-4o')
        : null,
    },
    {
      name: 'anthropic',
      isAvailable: () => !!config.anthropicApiKey,
      createModel: () => config.anthropicApiKey
        ? anthropic('claude-sonnet-4-20250514')
        : null,
    },
    {
      name: 'mistral',
      isAvailable: () => !!config.mistralApiKey,
      createModel: () => config.mistralApiKey
        ? mistral('mistral-large-latest')
        : null,
    },
    {
      name: 'perplexity',
      isAvailable: () => !!config.perplexityApiKey,
      createModel: () => config.perplexityApiKey
        ? perplexity('llama-3.1-sonar-huge-128k-online')
        : null,
    },
    {
      name: 'deepseek',
      isAvailable: () => !!config.deepseekApiKey,
      createModel: () => config.deepseekApiKey
        ? deepseek('deepseek-chat')
        : null,
    },
    {
      name: 'openrouter',
      isAvailable: () => !!config.openrouterApiKey,
      createModel: () => {
        if (!config.openrouterApiKey) return null;
        const openrouter = createOpenRouter({ apiKey: config.openrouterApiKey });
        return openrouter('google/gemini-2.0-flash-exp:free');
      },
    },
  ];
}

/**
 * Model router for automatic failover between providers
 */
export class ModelRouter {
  private providers: ProviderConfig[];
  private currentIndex: number = 0;

  constructor() {
    this.providers = getProviderConfigs().filter(p => p.isAvailable());

    if (this.providers.length === 0) {
      throw new Error('No AI providers configured. Set at least one API key.');
    }
  }

  getCurrentModel(): LanguageModel {
    const model = this.providers[this.currentIndex].createModel();
    if (!model) {
      throw new Error(`Failed to create model for provider: ${this.providers[this.currentIndex].name}`);
    }
    return model;
  }

  getCurrentProviderName(): string {
    return this.providers[this.currentIndex].name;
  }

  hasMoreProviders(): boolean {
    return this.currentIndex < this.providers.length - 1;
  }

  switchToNextProvider(): LanguageModel {
    if (!this.hasMoreProviders()) {
      throw new Error('No more providers available');
    }
    this.currentIndex++;
    return this.getCurrentModel();
  }

  getProviderCount(): number {
    return this.providers.length;
  }

  reset(): void {
    this.currentIndex = 0;
  }
}

// Singleton router instance
let modelRouter: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (!modelRouter) {
    modelRouter = new ModelRouter();
  }
  return modelRouter;
}

export function getModel(): LanguageModel {
  return getModelRouter().getCurrentModel();
}
