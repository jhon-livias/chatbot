import Handlebars from 'handlebars';
import { logger } from '../../shared/logger.js';

export interface TemplateCompileResult {
  /** String final con todas las variables interpoladas */
  rendered: string;
  /** Variables presentes en el template pero ausentes en el contexto */
  missingVariables: string[];
}

const HANDLEBARS_BUILTINS = new Set([
  'if', 'unless', 'each', 'with', 'log', 'lookup', 'else',
  'blockHelperMissing', 'helperMissing',
]);

/**
 * Recorre el AST de Handlebars y recopila todos los PathExpression
 * que corresponden a variables de usuario (no a built-ins ni helpers registrados).
 */
function collectAstVariables(node: unknown, found: Set<string>): void {
  if (!node || typeof node !== 'object') return;

  const n = node as Record<string, unknown>;

  if (
    (n['type'] === 'MustacheStatement' || n['type'] === 'SubExpression') &&
    typeof n['path'] === 'object'
  ) {
    const path = n['path'] as Record<string, unknown>;
    if (path['type'] === 'PathExpression' && typeof path['original'] === 'string') {
      if (!HANDLEBARS_BUILTINS.has(path['original'])) {
        found.add(path['original']);
      }
    }
  }

  if (n['type'] === 'BlockStatement') {
    // Para {{#each items}} y {{#if cond}} — capturar el argumento (params[0])
    const params = n['params'];
    if (Array.isArray(params)) {
      for (const p of params as Record<string, unknown>[]) {
        if (p['type'] === 'PathExpression' && typeof p['original'] === 'string') {
          found.add(p['original']);
        }
      }
    }
  }

  // Recorrido recursivo en cualquier propiedad array u objeto
  for (const key of Object.keys(n)) {
    const val = n[key];
    if (Array.isArray(val)) {
      for (const item of val) collectAstVariables(item, found);
    } else if (val && typeof val === 'object') {
      collectAstVariables(val, found);
    }
  }
}

/**
 * Verifica (de forma superficial) si una variable está disponible en el contexto.
 * Soporta rutas con punto: "user.careerId", "program.full_text_content".
 */
function isAvailable(path: string, context: Record<string, unknown>): boolean {
  const parts = path.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return false;
    current = (current as Record<string, unknown>)[part];
    if (current === undefined) return false;
  }
  return true;
}

export class TemplateService {
  private readonly hbs: typeof Handlebars;

  constructor() {
    this.hbs = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Compila un template Handlebars con el contexto dado.
   * No lanza error si hay variables faltantes — las reporta en `missingVariables`.
   */
  compile(template: string, context: Record<string, unknown>): TemplateCompileResult {
    const variablesInTemplate = new Set<string>();

    try {
      const ast = Handlebars.parse(template);
      collectAstVariables(ast, variablesInTemplate);
    } catch {
      throw new Error(`Template Handlebars inválido: no se pudo parsear`);
    }

    const missingVariables = [...variablesInTemplate].filter(
      (v) => !HANDLEBARS_BUILTINS.has(v) && !isAvailable(v, context),
    );

    if (missingVariables.length > 0) {
      logger.warn('[TemplateService] Variables faltantes en el contexto', {
        missing: missingVariables,
      });
    }

    const compileFn = this.hbs.compile(template, { strict: false });
    const rendered = compileFn(context);

    return { rendered, missingVariables };
  }

  /**
   * Igual que `compile` pero lanza `Error` si faltan variables requeridas.
   */
  compileStrict(
    template: string,
    context: Record<string, unknown>,
    requiredVariables?: string[],
  ): string {
    const { rendered, missingVariables } = this.compile(template, context);

    if (requiredVariables) {
      const missingRequired = requiredVariables.filter((v) => missingVariables.includes(v));
      if (missingRequired.length > 0) {
        throw new Error(
          `Variables requeridas faltantes en el template: ${missingRequired.join(', ')}`,
        );
      }
    } else if (missingVariables.length > 0) {
      throw new Error(
        `Variables faltantes en el template: ${missingVariables.join(', ')}`,
      );
    }

    return rendered;
  }

  // ── Helpers personalizados ────────────────────────────────────────────────

  private registerHelpers(): void {
    /** {{truncate text 200}} — trunca a N caracteres añadiendo "..." */
    this.hbs.registerHelper('truncate', (str: unknown, len: unknown) => {
      if (typeof str !== 'string') return '';
      const limit = typeof len === 'number' ? len : 200;
      return str.length > limit ? `${str.substring(0, limit)}…` : str;
    });

    /** {{upper text}} — convierte a mayúsculas */
    this.hbs.registerHelper('upper', (str: unknown) =>
      typeof str === 'string' ? str.toUpperCase() : '',
    );

    /** {{lower text}} — convierte a minúsculas */
    this.hbs.registerHelper('lower', (str: unknown) =>
      typeof str === 'string' ? str.toLowerCase() : '',
    );

    /** {{default value "fallback"}} — valor por defecto si value es falsy */
    this.hbs.registerHelper('default', (val: unknown, fallback: unknown) =>
      val ?? fallback ?? '',
    );

    /** {{eq a b}} — igualdad estricta, útil en {{#if (eq role "admin")}} */
    this.hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    /** {{join items ", "}} — une un array con un separador */
    this.hbs.registerHelper('join', (arr: unknown, sep: unknown) => {
      if (!Array.isArray(arr)) return '';
      const separator = typeof sep === 'string' ? sep : ', ';
      return arr.join(separator);
    });

    /** {{nl2br text}} — reemplaza saltos de línea por \n (útil para WhatsApp) */
    this.hbs.registerHelper('nl2br', (str: unknown) =>
      typeof str === 'string' ? str.replace(/\r?\n/g, '\n') : '',
    );
  }
}
