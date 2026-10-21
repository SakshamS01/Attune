import { createOpenAI } from '@ai-sdk/openai';

export const AI_MODEL = 'openai/gpt-6-astra';

export const reasoningOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: 'low',
    reasoningSummary: 'auto',
    store: false,
    include: ['reasoning.encrypted_content'],
  },
} as const;

// Created per request; the gateway issues the run id on its response.
export function createGatewayModel() {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error('AI is not configured.');
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    apiKey,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set('X-Lovable-AIG-Run-ID', runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get('X-Lovable-AIG-Run-ID') ?? undefined;
      return res;
    },
  });
  return provider.responses(AI_MODEL);
}
