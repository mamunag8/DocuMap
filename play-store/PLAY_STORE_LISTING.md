# Google Play Store Listing & Release Guide — DocuMap (`com.documap.vault`)

## 1. Store Listing Copy

- **App Title (<= 30 chars):** `DocuMap: PDF Scanner & Vault`
- **Short Description (<= 80 chars):**
  `100% offline PDF scanner, OCR, [[Markdown]] notes, 2D knowledge map & AI packer.`
- **Category:** `Productivity`
- **Content Rating:** `Everyone`
- **Ads Declaration:** `No, my app does not contain ads`

### Full Description (<= 4000 chars)
**DocuMap — Your Personal Document Vault & Knowledge Map**

Unify your physical documents, digital Markdown notes, and personal data trackers into an effortless, 100% local-first workspace with **zero subscriptions, zero ads, and zero cloud tracking**.

**5 Core Pillars in One App:**
1. **CamScanner-Grade Offline Scanner, Local OCR & PDF Studio:**
   - Capture Single pages, Multi-page Batches, ID Cards (auto-merged Front+Back on A4), Books (2-page split & curved spine dewarping), and QR/Barcodes.
   - Auto-edge corner detection with magnetic magnifier loupe, Shadow & Finger Eraser, and 4 instant filters (*Magic Color*, *Crisp B&W*, *Grayscale*, *Original*).
   - Automatic background on-device OCR indexed in SQLite FTS5. Tap any recognized OCR phrase to link a physical paper directly to a digital note (`[[`).
   - Stamp on-device E-Signatures, add custom watermarks, compress PDFs, and protect files with local AES-256 encryption.

2. **Obsidian-Style Markdown Workspace (`[[Wiki-Links]]`) & Structured Data Logs:**
   - Write clean Markdown notes with a floating keyboard toolbar (`[[ Link Node ]]`, `#Tag`, `Checklist`, `Table`, `Attach Scan`, `Code Block`).
   - Build custom offline Data Log tables (`.csv` and `.json`) with typed columns (`Currency`, `Date`, `Dropdown`, `Number`, `Attached Scan`, `[[Wiki-Link]]`).

3. **Interactive 2D Visual Knowledge Graph (The DocuMap):**
   - Watch your Scans (**Blue**), Markdown Notes (**Emerald**), and Data Logs (**Amber**) organize themselves into a force-directed 2D visual map via `[[Wiki-Links]]`, shared `#tags`, and OCR keywords.

4. **AI Token-Saver & Context Bundler:**
   - Bundle any document plus its 1st-degree linked OCR scans and CSV logs into a token-compressed prompt (~42% fewer tokens) for Claude, GPT-4o, Gemini, or Local LLMs.

5. **Zero-Cost Phone <-> PC Cloud Sync (Bring Your Own Cloud):**
   - All files live inside a portable `DocuMap_Vault/` folder (`/Scans`, `/Notes`, `/Logs`, `.documap/graph_state.json`) that opens directly on Windows/Mac in VS Code, Obsidian, or standard PDF readers via your own Google Drive, iCloud, OneDrive, Dropbox, or WebDAV.

---

## 2. Google Play Data Safety Form Answers
- **Does your app collect or share any of the required user data types?** `No`
- **All processing:** 100% On-Device (SQLite FTS5 + On-Device OCR + User's Own BYOC Storage).

---

## 3. Build & Publish Commands (EAS CLI -> Google Play Console)
```bash
# 1. Authenticate with your Expo account
npx eas-cli login

# 2. Build signed production Android App Bundle (.aab) for Google Play Store
npm run build:playstore:aab

# 3. Submit the signed .aab to Google Play Console
npm run submit:playstore
```
