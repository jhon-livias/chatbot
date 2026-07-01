import { z } from 'zod';

const DeepSeekConfigSchema = z.object({
  apiKey: z.string().min(1, 'DEEPSEEK_API_KEY es requerida'),
  baseUrl: z.string().url().default('https://api.deepseek.com/v1'),
  model: z.string().default('deepseek-chat'),
  maxTokens: z.coerce.number().positive().default(2048),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  timeoutMs: z.coerce.number().positive().default(30_000),
});

export type DeepSeekConfig = z.infer<typeof DeepSeekConfigSchema>;

export function loadDeepSeekConfig(): DeepSeekConfig {
  return DeepSeekConfigSchema.parse({
    apiKey: process.env['DEEPSEEK_API_KEY'],
    baseUrl: process.env['DEEPSEEK_BASE_URL'],
    model: process.env['DEEPSEEK_MODEL'],
    maxTokens: process.env['DEEPSEEK_MAX_TOKENS'],
    temperature: process.env['DEEPSEEK_TEMPERATURE'],
    timeoutMs: process.env['DEEPSEEK_REQUEST_TIMEOUT_MS'],
  });
}
