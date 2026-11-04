import {
  computeContentHash,
  estimateTokens,
} from '../core/linkAndTokenEngine';
import {
  LogEntry,
  LogSchema,
  VaultFolder,
  VaultNode,
} from '../models/types';

export const DEMO_FOLDER_ID = 'folder-demo-start';

export const DEFAULT_FOLDERS: VaultFolder[] = [
  {
    id: DEMO_FOLDER_ID,
    name: '📌 Start Here (Demo)',
    icon: 'sparkles',
    description: '3 interconnected starter items demonstrating Scan -> Note -> Data Log linking.',
    is_demo: true,
    created_at: '2026-11-04T09:00:00.000Z',
  },
  {
    id: 'folder-receipts-scans',
    name: 'Scans & Contracts',
    icon: 'document-text',
    description: 'Searchable PDFs, ID cards, receipts & OCR captures.',
    is_demo: false,
    created_at: '2026-11-04T09:00:00.000Z',
  },
  {
    id: 'folder-knowledge-notes',
    name: 'Knowledge Base',
    icon: 'book',
    description: 'Obsidian-compatible Markdown notes with [[Wiki-Links]].',
    is_demo: false,
    created_at: '2026-11-04T09:00:00.000Z',
  },
  {
    id: 'folder-personal-logs',
    name: 'Structured Trackers',
    icon: 'grid',
    description: 'Offline CSV/JSON tables for expenses, research & inventory.',
    is_demo: false,
    created_at: '2026-11-04T09:00:00.000Z',
  },
];

const DEMO_SCAN_CONTENT = `# [OCR EXTRACTED LAYER] Hardware Supplier Invoice #INV-2026-0842
**Vendor:** Apex MicroSystems Ltd. (Tax ID: US-94-3829104)
**Invoice Date:** 2026-11-01 | **Status:** PAID IN FULL
**Linked Project Note:** [[Project Budget & Architecture Notes]]
**Logged In Tracker:** [[Equipment Expense Log]]

---

### Itemized Hardware Line Items (OCR Table Extraction)
| SKU | Description | Qty | Unit Price | Subtotal |
| :--- | :--- | :---: | :---: | :---: |
| \`APX-NPU-16G\` | Edge AI Neural Compute Module (16GB LPDDR5X) | 2 | $680.00 | $1,360.00 |
| \`OPT-CMOS-48M\` | High-Speed Document Dewarp CMOS Optics Array | 2 | $340.00 | $680.00 |
| \`NVM-ENC-2TB\` | Industrial NVMe AES-256 Hardware Vault Drive | 2 | $220.00 | $440.00 |

- **Subtotal:** $2,480.00
- **Shipping & Handling:** $0.00 (Enterprise Waiver)
- **Total Paid:** **$2,480.00 USD**
- **Payment Method:** Corporate Wire #WT-88412
- **Warranty:** 36-Month On-Site Replacement Guarantee

#project-alpha #invoice #hardware`;

const DEMO_NOTE_CONTENT = `# Project Budget & Architecture Notes

Welcome to **DocuMap**! This Markdown note lives locally at \`DocuMap_Vault/Notes/Project_Budget_&_Architecture_Notes.md\` and automatically connects to your scanned PDFs and structured data logs.

## 1. Interlinked Vault Documents
- **Primary Hardware Receipt:** [[Hardware Supplier Invoice]] *(Scanned 2-page PDF with automatic offline OCR)*
- **Live Expense Ledger:** [[Equipment Expense Log]] *(Structured CSV/JSON Data Log table)*

## 2. Edge Hardware Architecture Checklist
- [x] Verify on-device OCR latency (< 120ms per A4 page on NPU)
- [x] Confirm AES-256 hardware encryption on the 2TB NVMe modules from [[Hardware Supplier Invoice]]
- [x] Reconcile Q4 hardware capex ($2,480.00) inside [[Equipment Expense Log]]
- [ ] Run Phone <-> PC Delta Sync benchmark via Google Drive \`DocuMap_Vault/\` folder

## 3. Budget Allocation Summary
We allocated **$3,500.00** for Phase-1 prototype hardware. With the Apex MicroSystems invoice totaling **$2,480.00**, remaining contingency budget is **$1,020.00** (29.1% buffer).

> Tip: Tap the **DocuMap** tab below to see these 3 documents connected in an interactive 2D triangle, or tap **AI Packer** to compress all 3 into a token-optimized LLM prompt!

#project-alpha #architecture #budget`;

const DEMO_LOG_CONTENT = `# Structured Data Log: Equipment Expense Log
**Portable Files:** \`DocuMap_Vault/Logs/Equipment_Expense_Log.csv\` & \`.json\`
**Connected Documents:** [[Hardware Supplier Invoice]] | [[Project Budget & Architecture Notes]]

### Summary Metrics
- **Total Logged Rows:** 4 entries
- **Verified against Scan [[Hardware Supplier Invoice]]:** $2,480.00
- **Additional Calibration Tooling:** $195.00
- **Cumulative Equipment Spend:** **$2,675.00 USD**

| Date | Item Description | Category | Cost (USD) | Vendor | Linked Scan / Note |
| :--- | :--- | :--- | :---: | :--- | :--- |
| 2026-11-01 | Edge AI Neural Compute Module (x2) | Compute | $1,360.00 | Apex MicroSystems | [[Hardware Supplier Invoice]] |
| 2026-11-01 | Document Dewarp CMOS Optics Array (x2) | Optics | $680.00 | Apex MicroSystems | [[Hardware Supplier Invoice]] |
| 2026-11-01 | Industrial NVMe AES-256 Vault Drive (x2) | Storage | $440.00 | Apex MicroSystems | [[Project Budget & Architecture Notes]] |
| 2026-11-02 | Laser Calibration Target Chart (ISO-12233) | QA Tooling | $195.00 | Edmund Optics | [[Project Budget & Architecture Notes]] |

#project-alpha #finance`;

export const DEMO_NODES: VaultNode[] = [
  {
    id: 'demo-node-scan-invoice',
    type: 'SCAN',
    title: 'Hardware Supplier Invoice',
    content_md: DEMO_SCAN_CONTENT,
    file_path: 'DocuMap_Vault/Scans/Hardware_Supplier_Invoice.pdf',
    scan_mode: 'SINGLE',
    scan_filter: 'MAGIC_COLOR',
    page_count: 2,
    tags: ['project-alpha', 'invoice', 'hardware'],
    folder_id: DEMO_FOLDER_ID,
    token_count: estimateTokens(DEMO_SCAN_CONTENT),
    is_encrypted: false,
    sync_status: 'SYNCED',
    created_at: '2026-11-01T14:20:00.000Z',
    updated_at: '2026-11-04T09:15:00.000Z',
    content_hash: computeContentHash(DEMO_SCAN_CONTENT),
    is_demo: true,
    watermark_text: 'PAID • VERIFIED',
    has_signature: true,
    graph_x: 180,
    graph_y: 130,
  },
  {
    id: 'demo-node-note-budget',
    type: 'NOTE',
    title: 'Project Budget & Architecture Notes',
    content_md: DEMO_NOTE_CONTENT,
    file_path: 'DocuMap_Vault/Notes/Project_Budget_&_Architecture_Notes.md',
    scan_mode: null,
    tags: ['project-alpha', 'architecture', 'budget'],
    folder_id: DEMO_FOLDER_ID,
    token_count: estimateTokens(DEMO_NOTE_CONTENT),
    is_encrypted: false,
    sync_status: 'SYNCED',
    created_at: '2026-11-02T10:05:00.000Z',
    updated_at: '2026-11-04T10:30:00.000Z',
    content_hash: computeContentHash(DEMO_NOTE_CONTENT),
    is_demo: true,
    graph_x: 310,
    graph_y: 290,
  },
  {
    id: 'demo-node-log-expenses',
    type: 'LOG',
    title: 'Equipment Expense Log',
    content_md: DEMO_LOG_CONTENT,
    file_path: 'DocuMap_Vault/Logs/Equipment_Expense_Log.csv',
    scan_mode: null,
    tags: ['project-alpha', 'finance', 'hardware'],
    folder_id: DEMO_FOLDER_ID,
    token_count: estimateTokens(DEMO_LOG_CONTENT),
    is_encrypted: false,
    sync_status: 'SYNCED',
    created_at: '2026-11-02T16:40:00.000Z',
    updated_at: '2026-11-04T11:00:00.000Z',
    content_hash: computeContentHash(DEMO_LOG_CONTENT),
    is_demo: true,
    graph_x: 90,
    graph_y: 290,
  },
];

export const DEMO_LOG_SCHEMAS: LogSchema[] = [
  {
    id: 'demo-schema-expenses',
    node_id: 'demo-node-log-expenses',
    columns: [
      { id: 'col_date', name: 'Date', type: 'DATE', required: true },
      { id: 'col_item', name: 'Item Description', type: 'TEXT', required: true },
      {
        id: 'col_category',
        name: 'Category',
        type: 'DROPDOWN',
        dropdown_options: ['Compute', 'Optics', 'Storage', 'QA Tooling', 'Software'],
      },
      { id: 'col_cost', name: 'Cost (USD)', type: 'CURRENCY', currency_symbol: '$' },
      { id: 'col_vendor', name: 'Vendor', type: 'TEXT' },
      { id: 'col_wiki', name: 'Wiki Reference', type: 'WIKI_LINK' },
    ],
    created_at: '2026-11-02T16:40:00.000Z',
    updated_at: '2026-11-04T11:00:00.000Z',
  },
];

export const DEMO_LOG_ENTRIES: LogEntry[] = [
  {
    id: 'demo-entry-1',
    node_id: 'demo-node-log-expenses',
    schema_id: 'demo-schema-expenses',
    values: {
      col_date: '2026-11-01',
      col_item: 'Edge AI Neural Compute Module (16GB x2)',
      col_category: 'Compute',
      col_cost: 1360.0,
      col_vendor: 'Apex MicroSystems Ltd.',
      col_wiki: '[[Hardware Supplier Invoice]]',
    },
    attached_scan_id: 'demo-node-scan-invoice',
    linked_note_id: 'demo-node-note-budget',
    created_at: '2026-11-02T16:41:00.000Z',
    updated_at: '2026-11-02T16:41:00.000Z',
  },
  {
    id: 'demo-entry-2',
    node_id: 'demo-node-log-expenses',
    schema_id: 'demo-schema-expenses',
    values: {
      col_date: '2026-11-01',
      col_item: 'High-Speed Document Dewarp CMOS Optics Array (x2)',
      col_category: 'Optics',
      col_cost: 680.0,
      col_vendor: 'Apex MicroSystems Ltd.',
      col_wiki: '[[Hardware Supplier Invoice]]',
    },
    attached_scan_id: 'demo-node-scan-invoice',
    linked_note_id: 'demo-node-note-budget',
    created_at: '2026-11-02T16:42:00.000Z',
    updated_at: '2026-11-02T16:42:00.000Z',
  },
  {
    id: 'demo-entry-3',
    node_id: 'demo-node-log-expenses',
    schema_id: 'demo-schema-expenses',
    values: {
      col_date: '2026-11-01',
      col_item: 'Industrial NVMe AES-256 Hardware Vault Drive (2TB x2)',
      col_category: 'Storage',
      col_cost: 440.0,
      col_vendor: 'Apex MicroSystems Ltd.',
      col_wiki: '[[Project Budget & Architecture Notes]]',
    },
    attached_scan_id: 'demo-node-scan-invoice',
    linked_note_id: 'demo-node-note-budget',
    created_at: '2026-11-02T16:43:00.000Z',
    updated_at: '2026-11-02T16:43:00.000Z',
  },
  {
    id: 'demo-entry-4',
    node_id: 'demo-node-log-expenses',
    schema_id: 'demo-schema-expenses',
    values: {
      col_date: '2026-11-02',
      col_item: 'Laser Calibration Target Chart (ISO-12233)',
      col_category: 'QA Tooling',
      col_cost: 195.0,
      col_vendor: 'Edmund Optics',
      col_wiki: '[[Project Budget & Architecture Notes]]',
    },
    attached_scan_id: null,
    linked_note_id: 'demo-node-note-budget',
    created_at: '2026-11-02T17:10:00.000Z',
    updated_at: '2026-11-02T17:10:00.000Z',
  },
];
