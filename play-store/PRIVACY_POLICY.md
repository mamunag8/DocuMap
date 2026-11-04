# Privacy Policy for DocuMap (`com.documap.vault`)

**Effective Date:** November 4, 2026

## 1. 100% Local-First & Privacy-Sovereign Architecture
**DocuMap** operates on a strict **zero-server, zero-telemetry, and zero-ad** architecture:
- We **do not** operate any central developer cloud servers that store or read your documents.
- We **do not** collect, transmit, sell, or analyze your personal data, scanned PDFs, OCR text, Markdown notes, or Data Logs.
- All document scanning, image enhancement, optical character recognition (OCR), SQLite FTS5 indexing, and AI token compression run **100% locally on your device's CPU/GPU**.

## 2. Device Permissions Used
- **Camera (`android.permission.CAMERA`):** Used exclusively on-device to capture physical documents, ID cards, books, and QR/barcodes for local PDF generation and offline OCR.
- **Biometrics (`USE_BIOMETRIC` / FaceID / Fingerprint):** Used exclusively via the operating system's hardware keystore to unlock your local vault. Biometric data never leaves your device's Secure Enclave / TEE.

## 3. Bring Your Own Cloud (BYOC) Synchronization
If you optionally enable Cloud Sync:
- Your portable `DocuMap_Vault/` files connect **directly** between your device and **your own personal cloud storage** (your own Google Drive `drive.file` / `appDataFolder`, your local iCloud Drive / OneDrive / Dropbox folder via Storage Access Framework, or your own self-hosted WebDAV server).
- No third-party or developer intermediary server ever touches your files or credentials.

## 4. Contact
For questions or support regarding DocuMap, please open an issue at:
https://github.com/mamunag8/DocuMap
