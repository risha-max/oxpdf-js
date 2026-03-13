export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 120_000) */
  timeout?: number;
  /** Retry settings for transient failures (network, 429, 5xx). */
  retry?: RetryOptions;
}

export interface RetryOptions {
  /** Maximum retries per request (default: 2). */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds (default: 500). */
  initialDelayMs?: number;
  /** Multiplier applied on each retry (default: 2). */
  backoffMultiplier?: number;
  /** HTTP statuses to retry (default: 429, 500, 502, 503, 504). */
  retryableStatusCodes?: number[];
}

export interface WaitForJobOptions {
  /** Poll interval in milliseconds (default: 2000). */
  intervalMs?: number;
  /** Overall timeout in milliseconds (default: 120000). */
  timeoutMs?: number;
}

// ── Parse ──────────────────────────────────────────────────────────

export interface ParseOptions {
  schema?: Record<string, unknown>;
  schemaTemplate?: string;
  schemaId?: string;
  useOcr?: boolean;
  ocrEngine?: "surya" | "groq_vision";
  pages?: number[];
}

export interface ParseStreamOptions extends ParseOptions {
  batchSize?: number;
}

export interface ParseResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  metadata?: ParseMetadata;
  cached?: boolean;
  quota?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SchemaValidationError {
  path: string;
  expected: string[];
  actual: string;
  message: string;
}

export interface FieldConfidence {
  value_present: boolean;
  type_match: boolean;
  confidence: number;
  source?: string;
}

export interface SchemaQualityMetadata {
  required_fields_total?: number;
  required_fields_filled?: number;
  missing_required_fields?: string[];
  required_fields_guaranteed?: boolean;
  required_coverage_pct?: number;
  validation_errors?: SchemaValidationError[];
  schema_adherence_score?: number;
  field_confidence?: Record<string, FieldConfidence>;
}

export interface ParseMetadata {
  pdf?: Record<string, unknown>;
  processing?: Record<string, unknown>;
  structure?: Record<string, unknown>;
  ocr?: Record<string, unknown>;
  schema_quality?: SchemaQualityMetadata;
  [key: string]: unknown;
}

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}

// ── Upload / Jobs ──────────────────────────────────────────────────

export interface UploadOptions {
  schemaId?: string;
  schemaName?: string;
  useOcr?: boolean;
  ocrEngine?: "surya" | "groq_vision";
}

export interface UploadResult {
  job_id: string;
  status: string;
  message: string;
  estimated_time_seconds: number;
  ocr_enabled: boolean;
  quota: Record<string, unknown>;
}

export interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: Record<string, unknown>;
  error?: string;
}

// ── Validate ───────────────────────────────────────────────────────

export interface ValidateOptions {
  schemaId?: string;
  schemaName?: string;
}

// ── Images ─────────────────────────────────────────────────────────

export interface ExtractImagesOptions {
  pages?: number[];
  minWidth?: number;
  minHeight?: number;
  useOcr?: boolean;
  ocrEngine?: "surya" | "groq_vision";
}

export interface ImageInfo {
  id: string;
  pdf_filename: string;
  page_number: number;
  image_index: number;
  format: string;
  width: number;
  height: number;
  file_size: number;
  url: string;
  created_at: string;
  expires_at: string;
  [key: string]: unknown;
}

export interface ImageListResult {
  images: ImageInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface ImageUrlResult {
  url: string;
  expires_in: number;
  image_id: string;
}

// ── Files ──────────────────────────────────────────────────────────

export interface FileInfo {
  id: string;
  filename: string;
  file_size: number;
  page_count: number;
  created_at: string;
  download_url: string;
}

export interface FileListResult {
  pdfs: FileInfo[];
  total: number;
}

// ── Schema templates ───────────────────────────────────────────────

export interface SchemaTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  schema?: Record<string, unknown>;
}

// ── Schema CRUD ────────────────────────────────────────────────────

export interface SchemaInfo {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  schema?: Record<string, unknown>;
}

export interface CreateSchemaOptions {
  name: string;
  schema: Record<string, unknown>;
  isDefault?: boolean;
}

export interface UpdateSchemaOptions {
  name: string;
  schema: Record<string, unknown>;
  isDefault?: boolean;
}

export interface GenerateSchemaOptions {
  description: string;
  refinement?: string;
  currentSchema?: Record<string, unknown>;
  selectedText?: string;
}

export interface GenerateSchemaResult {
  schema: Record<string, unknown>;
  suggested_name: string;
  generations_remaining: number;
  generations_limit: number;
  period_reset_date: string;
}

// ── Analytics ──────────────────────────────────────────────────────

export interface AnalyticsResult {
  context: "personal" | "org";
  recent_events: Array<{
    event_type: string;
    endpoint: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }>;
  statistics: {
    total_requests: number;
    total_pages: number;
    current_month_requests: number;
    current_month_pages: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── Pricing ────────────────────────────────────────────────────────

export interface PricingTier {
  id: string;
  name: string;
  visible: boolean;
  features: Record<string, unknown>;
  [key: string]: unknown;
}
