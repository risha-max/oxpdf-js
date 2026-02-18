# oxpdf

TypeScript/JavaScript SDK for the [0xPdf](https://0xpdf.com) PDF-to-JSON API.

Works in **Node.js 18+**, **Bun**, **Deno**, and the **browser** — zero dependencies, uses native `fetch`.

## Installation

```bash
npm install oxpdf
```

## Quick Start

```typescript
import { OxPDFClient } from "oxpdf";

const client = new OxPDFClient({ apiKey: "your_api_key" });

// Parse with a built-in template
const result = await client.parse(pdfBuffer, "invoice.pdf", {
  schemaTemplate: "invoice",
});
console.log(result.data);

// Parse from a file path (Node.js only)
const result2 = await client.parseFile("./invoice.pdf", {
  schemaTemplate: "invoice",
});

// Streaming parse with real-time progress
for await (const event of client.parseFileStream("./large.pdf", {
  schemaTemplate: "invoice",
})) {
  if (event.event === "page") console.log(event.data.message);
  if (event.event === "complete") console.log("Done!", event.data);
}
```

## Browser Usage

```typescript
const input = document.querySelector<HTMLInputElement>("#pdf-upload")!;
input.addEventListener("change", async () => {
  const file = input.files![0];
  const result = await client.parse(file, file.name, {
    schemaTemplate: "invoice",
  });
  console.log(result.data);
});
```

## Error Handling

```typescript
import { OxPDFClient, OxPDFError } from "oxpdf";

try {
  const result = await client.parseFile("doc.pdf", {
    schemaTemplate: "invoice",
  });
} catch (e) {
  if (e instanceof OxPDFError) {
    console.error(`API error: ${e.message} (status: ${e.statusCode})`);
  }
}
```

## Full API Reference

### Constructor

```typescript
new OxPDFClient({ apiKey, baseUrl?, timeout? })
```

| Option    | Type     | Default                              | Description          |
| --------- | -------- | ------------------------------------ | -------------------- |
| `apiKey`  | `string` | —                                    | Your 0xPdf API key   |
| `baseUrl` | `string` | `https://api.0xpdf.com/api/v1`      | API base URL         |
| `timeout` | `number` | `120000`                             | Request timeout (ms) |

### PDF Parsing

| Method | Description |
|---|---|
| `parse(file, filename, options?)` | Sync parse from Buffer/Blob/File |
| `parseFile(filePath, options?)` | Sync parse from file path (Node.js) |
| `parseStream(file, filename, options?)` | Streaming SSE parse (async generator) |
| `parseFileStream(filePath, options?)` | Streaming parse from file (Node.js) |
| `validate(file, filename, options?)` | Dry-run validation |

### Async Jobs

| Method | Description |
|---|---|
| `upload(file, filename, options?)` | Queue PDF for background processing |
| `jobStatus(jobId)` | Poll async job status |

### Image Extraction

| Method | Description |
|---|---|
| `extractImages(file, filename, options?)` | Extract images from a PDF |
| `listImages(limit?, offset?)` | List extracted images |
| `getImageUrl(imageId, expirationSeconds?)` | Get/refresh presigned URL |
| `deleteImage(imageId)` | Delete a specific image |
| `deleteAllImages()` | Delete all images |

### File Management

| Method | Description |
|---|---|
| `listFiles()` | List uploaded PDFs |
| `getFile(pdfId)` | Get PDF metadata + download URL |
| `deleteFile(pdfId)` | Delete an uploaded PDF |

### Schema CRUD

| Method | Description |
|---|---|
| `listSchemas()` | List saved schemas |
| `getSchema(schemaId)` | Get schema with full definition |
| `createSchema(options)` | Create a new schema |
| `updateSchema(schemaId, options)` | Update existing schema |
| `deleteSchema(schemaId)` | Delete a schema |
| `setDefaultSchema(schemaId)` | Set as default |
| `generateSchema(options)` | AI-generate a schema |

### Templates

| Method | Description |
|---|---|
| `listTemplates()` | Parse templates (invoice, receipt, etc.) |
| `listSchemaTemplates()` | Schema editor templates |
| `getSchemaTemplate(templateId)` | Get template with full schema |

### Analytics & Pricing

| Method | Description |
|---|---|
| `getAnalytics()` | Usage analytics |
| `submitFeedback(feedback)` | Submit feedback |
| `getPricing(billingCycle?)` | Get pricing tiers |
| `getCurrentTier()` | Current subscription & quota |

### Parse Options

| Option           | Type                   | Description                            |
| ---------------- | ---------------------- | -------------------------------------- |
| `schema`         | `Record<string, any>`  | Custom JSON schema                     |
| `schemaTemplate` | `string`               | Pre-built template name                |
| `schemaId`       | `string`               | Saved schema ID                        |
| `useOcr`         | `boolean`              | Enable OCR (default: `false`)          |
| `ocrEngine`      | `string`               | `"surya"` or `"groq_vision"`          |
| `pages`          | `number[]`             | Specific pages to parse                |
