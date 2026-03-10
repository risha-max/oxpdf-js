import { OxPDFError } from "./errors.js";
import type {
  AnalyticsResult,
  ClientOptions,
  CreateSchemaOptions,
  ExtractImagesOptions,
  FileInfo,
  FileListResult,
  GenerateSchemaOptions,
  GenerateSchemaResult,
  ImageListResult,
  ImageUrlResult,
  JobStatus,
  ParseOptions,
  ParseResult,
  ParseStreamOptions,
  SchemaInfo,
  SchemaTemplate,
  StreamEvent,
  UpdateSchemaOptions,
  UploadOptions,
  UploadResult,
  ValidateOptions,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.0xpdf.io/api/v1";
const DEFAULT_TIMEOUT = 120_000;

export class OxPDFClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeout: number;

  constructor(options: ClientOptions) {
    if (!options.apiKey) {
      throw new OxPDFError("apiKey is required");
    }
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  // ── internal helpers ─────────────────────────────────────────────

  #url(path: string): string {
    return `${this.#baseUrl}/${path.replace(/^\/+/, "")}`;
  }

  async #request<T = Record<string, unknown>>(
    method: string,
    path: string,
    init?: {
      params?: Record<string, string>;
      body?: FormData | string;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    const url = new URL(this.#url(path));
    if (init?.params) {
      for (const [k, v] of Object.entries(init.params)) {
        url.searchParams.set(k, v);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeout);

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        method,
        headers: {
          "X-API-Key": this.#apiKey,
          ...init?.headers,
        },
        body: init?.body,
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new OxPDFError(`Request failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (resp.status === 204) return {} as T;

    if (!resp.ok) {
      const text = await resp.text();
      let detail: string;
      try {
        const body = JSON.parse(text);
        const raw = body.detail ?? body.error ?? text;
        if (Array.isArray(raw)) {
          detail = raw.map((d: Record<string, unknown>) => d.msg ?? JSON.stringify(d)).join("; ");
        } else {
          detail = typeof raw === "string" ? raw : JSON.stringify(raw);
        }
      } catch {
        detail = text || resp.statusText || `HTTP ${resp.status}`;
      }
      throw new OxPDFError(detail, resp.status, text);
    }

    const text = await resp.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  #buildPdfForm(
    file: Blob | Buffer | Uint8Array,
    filename: string,
    fields?: Record<string, string>,
  ): FormData {
    if (!filename.toLowerCase().endsWith(".pdf")) {
      throw new OxPDFError("File must be a PDF");
    }

    const form = new FormData();
    let blob: Blob;
    if (file instanceof Blob) {
      blob = file;
    } else {
      const arr = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
      blob = new Blob([arr as unknown as Uint8Array<ArrayBuffer>], {
        type: "application/pdf",
      });
    }
    form.append("file", blob, filename);
    if (fields) {
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
    }
    return form;
  }

  // ── PDF parsing ──────────────────────────────────────────────────

  /** Parse a PDF and return structured JSON. */
  async parse(
    file: Blob | Buffer | Uint8Array,
    filename: string,
    options: ParseOptions = {},
  ): Promise<ParseResult> {
    const formFields: Record<string, string> = {
      use_ocr: String(options.useOcr ?? false),
    };
    if (options.ocrEngine) formFields.ocr_engine = options.ocrEngine;
    if (options.schema) formFields.schema_json = JSON.stringify(options.schema);

    const params: Record<string, string> = {};
    if (options.schemaTemplate) params.schema_template = options.schemaTemplate;
    if (options.schemaId) params.schema_id = options.schemaId;
    if (options.pages) params.pages = options.pages.join(",");

    const form = this.#buildPdfForm(file, filename, formFields);

    return this.#request<ParseResult>("POST", "pdf/parse", {
      params: Object.keys(params).length ? params : undefined,
      body: form,
    });
  }

  /** Parse a PDF from a file path (Node.js only). */
  async parseFile(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const buf = await readFile(filePath);
    return this.parse(buf, basename(filePath), options);
  }

  /**
   * Streaming parse via Server-Sent Events.
   * Returns an async generator that yields ``StreamEvent`` objects.
   */
  async *parseStream(
    file: Blob | Buffer | Uint8Array,
    filename: string,
    options: ParseStreamOptions = {},
  ): AsyncGenerator<StreamEvent> {
    const formFields: Record<string, string> = {
      use_ocr: String(options.useOcr ?? false),
    };
    if (options.ocrEngine) formFields.ocr_engine = options.ocrEngine;
    if (options.schema) formFields.schema_json = JSON.stringify(options.schema);

    const params: Record<string, string> = {
      batch_size: String(options.batchSize ?? 5),
    };
    if (options.schemaTemplate) params.schema_template = options.schemaTemplate;
    if (options.schemaId) params.schema_id = options.schemaId;
    if (options.pages) params.pages = options.pages.join(",");

    const form = this.#buildPdfForm(file, filename, formFields);

    const url = new URL(this.#url("pdf/parse-stream"));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300_000);

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "X-API-Key": this.#apiKey },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new OxPDFError(`Stream request failed: ${msg}`);
    }

    if (!resp.ok) {
      clearTimeout(timer);
      const text = await resp.text();
      throw new OxPDFError(text, resp.status, text);
    }

    try {
      const reader = resp.body?.getReader();
      if (!reader) throw new OxPDFError("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(raw);
            } catch {
              data = { raw };
            }
            yield { event: eventType, data };
            eventType = "message";
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Streaming parse from a file path (Node.js only). */
  async *parseFileStream(
    filePath: string,
    options: ParseStreamOptions = {},
  ): AsyncGenerator<StreamEvent> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const buf = await readFile(filePath);
    yield* this.parseStream(buf, basename(filePath), options);
  }

  // ── Async upload (job queue) ─────────────────────────────────────

  /** Upload a PDF for async background processing. Returns a job_id. */
  async upload(
    file: Blob | Buffer | Uint8Array,
    filename: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const params: Record<string, string> = {
      use_ocr: String(options.useOcr ?? false),
      ocr_engine: options.ocrEngine ?? "surya",
    };
    if (options.schemaId) params.schema_id = options.schemaId;
    if (options.schemaName) params.schema_name = options.schemaName;

    const form = this.#buildPdfForm(file, filename);

    return this.#request<UploadResult>("POST", "pdf/upload", {
      params,
      body: form,
    });
  }

  /** Poll the status of an async PDF processing job. */
  async jobStatus(jobId: string): Promise<JobStatus> {
    return this.#request<JobStatus>("GET", `pdf/status/${jobId}`);
  }

  // ── PDF validation ───────────────────────────────────────────────

  /** Validate a PDF without full processing (dry-run). */
  async validate(
    file: Blob | Buffer | Uint8Array,
    filename: string,
    options: ValidateOptions = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = { dry_run: "true" };
    if (options.schemaId) params.schema_id = options.schemaId;
    if (options.schemaName) params.schema_name = options.schemaName;

    const form = this.#buildPdfForm(file, filename);
    return this.#request("POST", "pdf/validate", { params, body: form });
  }

  // ── Image extraction ─────────────────────────────────────────────

  /** Extract images from a PDF. */
  async extractImages(
    file: Blob | Buffer | Uint8Array,
    filename: string,
    options: ExtractImagesOptions = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {
      min_width: String(options.minWidth ?? 50),
      min_height: String(options.minHeight ?? 50),
      use_ocr: String(options.useOcr ?? false),
      ocr_engine: options.ocrEngine ?? "surya",
    };
    if (options.pages) params.pages = options.pages.join(",");

    const form = this.#buildPdfForm(file, filename);
    return this.#request("POST", "pdf/parse-images", { params, body: form });
  }

  // ── Image management ─────────────────────────────────────────────

  /** List extracted images. */
  async listImages(limit = 100, offset = 0): Promise<ImageListResult> {
    return this.#request<ImageListResult>("GET", "pdf/images", {
      params: { limit: String(limit), offset: String(offset) },
    });
  }

  /** Get or refresh a presigned URL for an image. */
  async getImageUrl(imageId: string, expirationSeconds = 3600): Promise<ImageUrlResult> {
    return this.#request<ImageUrlResult>("GET", `pdf/images/${imageId}/url`, {
      params: { expiration_seconds: String(expirationSeconds) },
    });
  }

  /** Delete a specific image. */
  async deleteImage(imageId: string): Promise<void> {
    await this.#request("DELETE", `pdf/images/${imageId}`);
  }

  /** Delete all extracted images. */
  async deleteAllImages(): Promise<Record<string, unknown>> {
    return this.#request("DELETE", "pdf/images");
  }

  // ── File management ──────────────────────────────────────────────

  /** List previously uploaded PDFs. */
  async listFiles(): Promise<FileListResult> {
    return this.#request<FileListResult>("GET", "pdf/files");
  }

  /** Get metadata and download URL for an uploaded PDF. */
  async getFile(pdfId: string): Promise<FileInfo> {
    return this.#request<FileInfo>("GET", `pdf/files/${pdfId}`);
  }

  /** Delete an uploaded PDF. */
  async deleteFile(pdfId: string): Promise<void> {
    await this.#request("DELETE", `pdf/files/${pdfId}`);
  }

  // ── Schema templates ─────────────────────────────────────────────

  /** List pre-built schema templates (pdf route). */
  async listTemplates(): Promise<SchemaTemplate[]> {
    const res = await this.#request<{ templates: SchemaTemplate[] }>("GET", "pdf/templates");
    return res.templates ?? [];
  }

  /** List schema templates from /schemas/templates/list. */
  async listSchemaTemplates(): Promise<SchemaTemplate[]> {
    const res = await this.#request<{ templates: SchemaTemplate[] }>(
      "GET",
      "schemas/templates/list",
    );
    return res.templates ?? [];
  }

  /** Get a specific schema template with full definition. */
  async getSchemaTemplate(templateId: string): Promise<SchemaTemplate> {
    return this.#request<SchemaTemplate>("GET", `schemas/templates/${templateId}`);
  }

  // ── Schema CRUD ──────────────────────────────────────────────────

  /** List user's saved schemas. */
  async listSchemas(): Promise<SchemaInfo[]> {
    const res = await this.#request<{ schemas: SchemaInfo[] }>("GET", "schemas");
    return res.schemas ?? [];
  }

  /** Get a specific schema by ID. */
  async getSchema(schemaId: string): Promise<SchemaInfo> {
    return this.#request<SchemaInfo>("GET", `schemas/${schemaId}`);
  }

  /** Create a new JSON schema. */
  async createSchema(options: CreateSchemaOptions): Promise<SchemaInfo> {
    return this.#request<SchemaInfo>("POST", "schemas", {
      body: JSON.stringify({
        name: options.name,
        schema: options.schema,
        is_default: options.isDefault ?? false,
      }),
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Update an existing schema. */
  async updateSchema(schemaId: string, options: UpdateSchemaOptions): Promise<SchemaInfo> {
    return this.#request<SchemaInfo>("PUT", `schemas/${schemaId}`, {
      body: JSON.stringify({
        name: options.name,
        schema: options.schema,
        is_default: options.isDefault ?? false,
      }),
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Delete a schema. */
  async deleteSchema(schemaId: string): Promise<void> {
    await this.#request("DELETE", `schemas/${schemaId}`);
  }

  /** Set a schema as the default. */
  async setDefaultSchema(schemaId: string): Promise<SchemaInfo> {
    return this.#request<SchemaInfo>("PATCH", `schemas/${schemaId}/set-default`);
  }

  /** Generate a schema using AI from a natural-language description. */
  async generateSchema(options: GenerateSchemaOptions): Promise<GenerateSchemaResult> {
    const body: Record<string, unknown> = { description: options.description };
    if (options.refinement) body.refinement = options.refinement;
    if (options.currentSchema) body.current_schema = options.currentSchema;
    if (options.selectedText) body.selected_text = options.selectedText;

    return this.#request<GenerateSchemaResult>("POST", "schemas/generate", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Analytics ────────────────────────────────────────────────────

  /** Get usage analytics for the current user/org. */
  async getAnalytics(): Promise<AnalyticsResult> {
    return this.#request<AnalyticsResult>("GET", "analytics/user");
  }

  /** Submit in-app feedback. */
  async submitFeedback(feedback: string): Promise<{ success: boolean }> {
    return this.#request<{ success: boolean }>("POST", "analytics/feedback", {
      body: JSON.stringify({ feedback }),
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Pricing ──────────────────────────────────────────────────────

  /** Get available pricing tiers. */
  async getPricing(billingCycle = "monthly"): Promise<Record<string, unknown>> {
    return this.#request("GET", "pricing", {
      params: { billing_cycle: billingCycle },
    });
  }

  /** Get the current user's tier and quota. */
  async getCurrentTier(): Promise<Record<string, unknown>> {
    return this.#request("GET", "pricing/current");
  }
}
