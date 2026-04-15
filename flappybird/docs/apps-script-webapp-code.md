# Apps Script Web App (server) code

Deploy this as a **Google Apps Script Web App** and use the resulting URL as:

- `NEXT_PUBLIC_GAS_LEADERBOARD_URL`

Optionally set a shared token in Script Properties and in:

- `NEXT_PUBLIC_GAS_AUTH_TOKEN`

## Script Properties to set

In Apps Script: **Project Settings → Script Properties**:

- `SHEET_ID`: your Google Sheet ID
- `SHEET_NAME`: (optional) default `Scores`
- `AUTH_TOKEN`: (optional) shared token (if you want a simple permission gate)

## Sheet schema

Create a sheet named `Scores` (or your `SHEET_NAME`) with this header row:

`id | name | score | createdAt | updatedAt`

## `Code.gs`

```javascript
// GET entrypoint (recommended for file:// clients to avoid CORS preflight).
// Supported:
// - ?action=list&token=...
// - ?action=upsertMany&token=...&payload=<JSON string>   (payload should include { entries: [...] })
function doGet(e) {
  try {
    const req = (e && e.parameter) ? e.parameter : {};
    requireAuth_(req.token);
    const sheet = getSheet_();
    const action = String(req.action || '');

    if (action === 'list') {
      const entries = readAll_(sheet);
      return jsonResponse_({ ok: true, entries: entries });
    }

    if (action === 'upsertMany') {
      const payload = req.payload ? JSON.parse(req.payload) : {};
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      upsertMany_(sheet, entries);
      const all = readAll_(sheet);
      return jsonResponse_({ ok: true, entries: all });
    }

    return jsonResponse_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const code = err && err.code ? String(err.code) : undefined;
    return jsonResponse_({ ok: false, error: msg, code: code });
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) throw new Error('Missing SHEET_ID script property');
  const sheetName = props.getProperty('SHEET_NAME') || 'Scores';
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  return sheet;
}

function requireAuth_(tokenFromClient) {
  const props = PropertiesService.getScriptProperties();
  const required = props.getProperty('AUTH_TOKEN');
  if (!required) return; // auth disabled
  if (!tokenFromClient || tokenFromClient !== required) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

function readAll_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  const header = values[0].map(String);
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const id = String(row[idx.id] || '').trim();
    if (!id) continue;
    out.push({
      id: id,
      name: String(row[idx.name] || ''),
      score: Number(row[idx.score] || 0),
      createdAt: String(row[idx.createdAt] || ''),
      updatedAt: String(row[idx.updatedAt] || '')
    });
  }
  return out;
}

function upsertMany_(sheet, entries) {
  // Build existing index by id
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  const rowById = {};
  for (let r = 1; r < values.length; r++) {
    const id = String(values[r][idx.id] || '').trim();
    if (id) rowById[id] = r + 1; // 1-based sheet row
  }

  const now = new Date().toISOString();

  entries.forEach((e) => {
    const id = String(e.id || '').trim();
    if (!id) return;
    const name = String(e.name || '');
    const score = Number(e.score || 0);
    const createdAt = String(e.createdAt || now);
    const updatedAt = String(e.updatedAt || now);

    const existingRow = rowById[id];
    if (existingRow) {
      // Update row in place (overwrite). If you want "keep max score", enforce it here.
      const row = [];
      row[idx.id] = id;
      row[idx.name] = name;
      row[idx.score] = score;
      row[idx.createdAt] = createdAt;
      row[idx.updatedAt] = updatedAt;
      sheet.getRange(existingRow, 1, 1, header.length).setValues([row]);
    } else {
      // Append new row
      const row = [];
      row[idx.id] = id;
      row[idx.name] = name;
      row[idx.score] = score;
      row[idx.createdAt] = createdAt;
      row[idx.updatedAt] = updatedAt;
      sheet.appendRow(row);
    }
  });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const req = body ? JSON.parse(body) : {};

    requireAuth_(req.token);

    const sheet = getSheet_();
    const action = String(req.action || '');

    if (action === 'list') {
      const entries = readAll_(sheet);
      return jsonResponse_({ ok: true, entries: entries });
    }

    if (action === 'upsertMany') {
      const entries = Array.isArray(req.entries) ? req.entries : [];
      upsertMany_(sheet, entries);
      const all = readAll_(sheet);
      return jsonResponse_({ ok: true, entries: all });
    }

    return jsonResponse_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const code = err && err.code ? String(err.code) : undefined;
    return jsonResponse_({ ok: false, error: msg, code: code });
  }
}
```

## Deployment notes

- Deploy as **Web App**
  - Execute as: **Me**
  - Who has access: **Anyone** (or your choice)
- After changing code, you must **Deploy → Manage deployments → Edit → New version → Deploy**
- If you see `Script function not found: doPost`, it means the deployed version does not include `doPost(e)` (wrong file, wrong project, or old deployment version).
- If you use `AUTH_TOKEN`, keep in mind it’s a **shared token in client code** (not secret), but it does prevent casual writes if someone discovers the URL.

