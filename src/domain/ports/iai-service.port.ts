/**
 * Puerto de Dominio — Motor de IA.
 *
 * Define el contrato de alto nivel que consume la capa de Aplicación
 * (Principio de Inversión de Dependencias). La implementación concreta
 * (DeepSeekService, OpenAIService, etc.) vive en Infraestructura.
 */

export interface IAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface IAIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface IAIResponse {
  /** Texto generado por el modelo */
  content: string;
  /** Identificador del modelo usado (ej. "deepseek-chat") */
  model: string;
  /** Razón por la que el modelo terminó de generar */
  finishReason: 'stop' | 'length' | 'content_filter' | string;
  usage: IAIUsage;
}

export interface IAIRequestOptions {
  /** Sobreescribe el modelo configurado por defecto */
  model?: string;
  maxTokens?: number;
  /** 0 = determinístico, 2 = máxima creatividad */
  temperature?: number;
}

export interface IAIRequest {
  /**
   * Plantilla Handlebars del system prompt.
   * Las expresiones {{variable}} y {{#each items}} se interpolan
   * con el campo `context` antes de enviarlas al modelo.
   *
   * @example "Eres un asesor de {{facultad}}. El programa {{nombre}} dura {{duracion}}."
   */
  systemPromptTemplate: string;

  /** Mensaje del usuario tal como llegó del canal (WhatsApp, etc.) */
  userMessage: string;

  /**
   * Variables dinámicas para compilar el systemPromptTemplate.
   * Soporta objetos anidados y arreglos para iteraciones Handlebars.
   *
   * @example
   * {
   *   facultad: "Ingeniería",
   *   program: { full_text_content: "...", nombre: "Sistemas" },
   *   programs: [{ nombre: "A" }, { nombre: "B" }]
   * }
   */
  context?: Record<string, unknown>;

  /**
   * Historial reciente de la conversación (sin incluir el mensaje actual).
   * El DeepSeekService lo inserta entre el system prompt y el mensaje actual.
   */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;

  options?: IAIRequestOptions;
}

export interface IIAService {
  /**
   * Genera una respuesta del LLM a partir de un prompt template compilado
   * con contexto dinámico e historial de conversación.
   */
  generateResponse(request: IAIRequest): Promise<IAIResponse>;
}
