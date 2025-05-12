const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// Security headers
app.use(helmet());

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// CORS configuration with custom domain support
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        process.env.APP_URL || 'https://requirement-prioritizer-production.up.railway.app',
        /\.railway\.app$/,
        /\.herokuapp\.com$/
      ]
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Helper function to normalize column names
function normalizeColumnNames(data) {
  if (data.length === 0) return [];
  
  const columnMapping = {
    'key': ['Key', 'key', 'KEY'],
    'summary': ['Summary', 'summary', 'SUMMARY'],
    'priority': ['Priority', 'priority', 'PRIORITY'],
    'status': ['Status', 'status', 'STATUS'],
    'assignee': ['Assignee', 'assignee', 'ASSIGNEE'],
    'timeSpent': ['Time Spent', 'timeSpent', 'TIME SPENT'],
    'labels': ['Labels', 'labels', 'LABELS'],
    'roughEstimate': ['Rough Estimate', 'roughEstimate', 'ROUGH ESTIMATE'],
    'relatedCustomers': ['Related Customer(s)', 'relatedCustomers', 'RELATED CUSTOMERS'],
    'prioritization': ['Prioritization', 'prioritization', 'PRIORITIZATION'],
    'weight': ['Weight', 'weight', 'WEIGHT'],
    'productOwner': ['Product Owner', 'productOwner', 'PRODUCT OWNER']
  };

  return data.map(row => {
    const normalizedRow = {};
    for (const [normalizedKey, possibleKeys] of Object.entries(columnMapping)) {
      const foundKey = possibleKeys.find(key => row[key] !== undefined);
      if (foundKey) {
        normalizedRow[normalizedKey] = row[foundKey];
      }
    }
    return normalizedRow;
  });
}

// Root endpoint for basic testing
app.get('/', (req, res) => {
  res.json({ message: 'Server is running successfully!' });
});

// Test Jira connection endpoint
app.post('/api/jira/test', async (req, res) => {
  try {
    const { jiraUrl, token } = req.body;
    
    if (!jiraUrl || !token) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: {
          jiraUrl: !jiraUrl ? 'Jira URL is required' : null,
          token: !token ? 'API token is required' : null
        }
      });
    }

    // Ensure the Jira URL ends with a slash
    const baseUrl = jiraUrl.endsWith('/') ? jiraUrl : `${jiraUrl}/`;

    // Split the token if it contains email:token format
    let authToken = token;
    if (!token.includes(':')) {
      return res.status(400).json({
        error: 'Invalid token format',
        message: 'Token should be in the format "email:api-token"'
      });
    }

    // Test connection by getting current user info
    const response = await axios.get(`${baseUrl}rest/api/2/myself`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(authToken).toString('base64')}`,
        'Accept': 'application/json'
      }
    });

    res.json({
      success: true,
      data: response.data,
      message: 'Successfully connected to Jira!'
    });

  } catch (error) {
    console.error('Jira connection error:', error.message);
    
    // Handle different types of errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      let message = error.response.data.message || error.message;
      
      if (status === 403) {
        message = 'Authentication failed. Please check your email and API token.';
      } else if (status === 401) {
        message = 'Unauthorized. Please verify your credentials.';
      }

      return res.status(status).json({
        error: 'Jira API error',
        status: status,
        message: message
      });
    } else if (error.request) {
      // The request was made but no response was received
      return res.status(503).json({
        error: 'No response from Jira',
        message: 'Could not reach Jira server. Please check the URL and try again.'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      return res.status(500).json({
        error: 'Configuration error',
        message: error.message
      });
    }
  }
});

// Get all requirements
app.get('/api/requirements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requirements');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requirements', message: error.message });
  }
});

// Get Excel columns
app.post('/api/requirements/columns', upload.single('file'), (req, res) => {
  try {
    console.log('Received request to get columns');
    console.log('Request file:', req.file);
    
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload an Excel file'
      });
    }

    console.log('Reading Excel file:', req.file.path);
    
    // Read the Excel file
    const workbook = XLSX.readFile(req.file.path);
    console.log('Available sheets:', workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log('Worksheet range:', worksheet['!ref']);
    
    // Get headers from the first row
    const columns = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({r: 0, c: C})];
      if (cell && cell.v) {
        columns.push(cell.v);
      }
    }

    console.log('Found columns:', columns);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log('Sending response with columns');
    res.json({
      success: true,
      columns
    });

  } catch (error) {
    console.error('Get columns error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to get columns',
      message: error.message
    });
  }
});

// Preview Excel import
app.post('/api/requirements/preview', upload.single('file'), async (req, res) => {
  try {
    console.log('--- /api/requirements/preview called ---');
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload an Excel file'
      });
    }
    console.log('Received file:', req.file.originalname, 'size:', req.file.size);

    // Get field mapping from request
    let mapping = {};
    try {
      mapping = JSON.parse(req.body.mapping || '{}');
      console.log('Received mapping:', mapping);
    } catch (e) {
      console.error('Error parsing mapping:', e);
      return res.status(400).json({
        error: 'Invalid mapping format',
        message: 'The field mapping data is not in the correct format'
      });
    }

    if (!mapping.key) {
      console.error('Key field mapping is required');
      return res.status(400).json({
        error: 'Invalid mapping',
        message: 'Key field mapping is required'
      });
    }

    // Read the Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = XLSX.utils.encode_cell({r: 0, c: C});
      headers[C] = cell ? worksheet[cell]?.v : undefined;
    }
    console.log('Parsed headers:', headers);

    // Convert to array of objects using the mapping
    const data = [];
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const row = {};
      for (const [field, excelColumn] of Object.entries(mapping)) {
        // Case-insensitive, trimmed header match
        const C = headers.findIndex(
          h => h && h.toString().trim().toLowerCase() === excelColumn.toString().trim().toLowerCase()
        );
        if (C !== -1) {
          const cell = XLSX.utils.encode_cell({r: R, c: C});
          row[field] = worksheet[cell] ? worksheet[cell].v : '';
        }
      }
      if (Object.keys(row).length > 0) {
        data.push(row);
      }
    }
    console.log('Parsed data rows:', data.length);
    if (data.length > 0) {
      console.log('First data row:', data[0]);
    }

    // Build preview with all mapped fields (including new fields)
    const preview = {
      total: data.length,
      toBeUpdated: [],
      toBeInserted: [],
      errors: []
    };

    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      if (!row.key) {
        preview.errors.push({
          row: index + 2,
          message: 'Missing Key field'
        });
        continue;
      }
      // Check if requirement exists in DB
      const existingReq = await pool.query('SELECT * FROM requirements WHERE key = $1', [row.key]);
      const operation = existingReq.rows.length > 0 ? 'update' : 'insert';
      // Include all mapped fields in newValues
      const newValues = { ...row };
      const previewItem = {
        key: row.key,
        operation,
        currentValues: operation === 'update' ? existingReq.rows[0] : null,
        newValues,
        ...newValues // Spread all fields at the top level for preview table
      };
      if (operation === 'update') {
        preview.toBeUpdated.push(previewItem);
      } else {
        preview.toBeInserted.push(previewItem);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      preview: {
        totalRows: preview.total,
        toBeInserted: preview.toBeInserted,
        toBeUpdated: preview.toBeUpdated,
        errors: preview.errors
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Preview failed',
      message: error.message
    });
  }
});

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return parseInt(value, 10);
}

// Import requirements from Excel
app.post('/api/requirements/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload an Excel file'
      });
    }

    // Get field mapping from request
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    if (!mapping.key) {
      return res.status(400).json({
        error: 'Invalid mapping',
        message: 'Key field mapping is required'
      });
    }

    // Read the Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = XLSX.utils.encode_cell({r: 0, c: C});
      headers[C] = worksheet[cell] ? worksheet[cell].v : undefined;
    }

    // Convert to array of objects using the mapping
    const data = [];
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const row = {};
      for (const [field, excelColumn] of Object.entries(mapping)) {
        const C = headers.findIndex(
          h => h && h.toString().trim().toLowerCase() === excelColumn.toString().trim().toLowerCase()
        );
        if (C !== -1) {
          const cell = XLSX.utils.encode_cell({r: R, c: C});
          row[field] = worksheet[cell] ? worksheet[cell].v : '';
        }
      }
      if (Object.keys(row).length > 0) {
        data.push(row);
      }
    }

    // --- Dynamic Schema Extension ---
    // 1. Get current columns from requirements table
    const colRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'requirements'`);
    const currentColumns = colRes.rows.map(r => r.column_name);
    // 2. Find new fields in mapping not in currentColumns
    const newFields = Object.keys(mapping).filter(f => !currentColumns.includes(f) && f !== 'operation');
    // 3. For each new field, ALTER TABLE to add as TEXT
    for (const field of newFields) {
      try {
        await pool.query(`ALTER TABLE requirements ADD COLUMN IF NOT EXISTS "${field}" TEXT`);
        console.log(`[DynamicSchema] Added new column: ${field}`);
      } catch (err) {
        // Ignore if already exists or log error
        console.error(`[DynamicSchema] Error adding column ${field}:`, err.message);
      }
    }
    // 4. Refresh columns after possible alter
    const colRes2 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'requirements'`);
    const allColumns = colRes2.rows.map(r => r.column_name);

    // For each row, insert or update in PostgreSQL
    for (const row of data) {
      if (!row.key) continue;
      // Clean and prepare the data (use all fields)
      const cleanedData = {};
      for (const col of allColumns) {
        if (row[col] !== undefined) {
          // Convert empty string to null for integer columns
          if (["prioritization", "weight", "rank"].includes(col)) {
            cleanedData[col] = parseIntOrNull(row[col]);
          } else {
            cleanedData[col] = row[col];
          }
        }
      }
      // Always set key
      cleanedData.key = row.key;
      // Check if exists
      const existing = await pool.query('SELECT * FROM requirements WHERE key = $1', [row.key]);
      if (existing.rows.length > 0) {
        // Update: build SET clause dynamically
        const setCols = Object.keys(cleanedData).filter(c => c !== 'key');
        const setClause = setCols.map((c, i) => `"${c}"=$${i+1}`).join(', ');
        const values = setCols.map(c => cleanedData[c]);
        values.push(row.key); // for WHERE
        await pool.query(
          `UPDATE requirements SET ${setClause} WHERE key=$${setCols.length+1}`,
          values
        );
      } else {
        // Insert: build columns and values dynamically
        const insertCols = Object.keys(cleanedData);
        const insertVals = insertCols.map((c, i) => `$${i+1}`).join(', ');
        const values = insertCols.map(c => cleanedData[c]);
        await pool.query(
          `INSERT INTO requirements (${insertCols.map(c => '"'+c+'"').join(',')}) VALUES (${insertVals})`,
          values
        );
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, message: 'Requirements imported successfully', newFields });
  } catch (error) {
    console.error('Import error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Import failed',
      message: error.message
    });
  }
});

// Update requirement score
app.post('/api/requirements/:key/score', async (req, res) => {
  const { key } = req.params;
  const { score, criteria } = req.body;

  try {
    // Check if requirement exists
    const existing = await pool.query('SELECT * FROM requirements WHERE key = $1', [key]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `Requirement with key ${key} not found`
      });
    }

    // Update score and criteria (as JSON)
    await pool.query(
      `UPDATE requirements SET score = $1, criteria = $2, lastScored = NOW() WHERE key = $3`,
      [score, criteria, key]
    );

    // Return updated requirement
    const updated = await pool.query('SELECT * FROM requirements WHERE key = $1', [key]);
    res.json({
      success: true,
      data: updated.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update score',
      message: error.message
    });
  }
});

// Get all criteria
app.get('/api/criteria', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM criteria');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch criteria', message: error.message });
  }
});

// Add new criterion
app.post('/api/criteria', async (req, res) => {
  let { id, name, weight, scale_min, scale_max } = req.body;
  try {
    if (!id) {
      if (!name) throw new Error('Name is required to generate id');
      id = name.toLowerCase().replace(/\s+/g, '_');
    }
    await pool.query(
      `INSERT INTO criteria (id, name, weight, scale_min, scale_max)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, weight=EXCLUDED.weight, scale_min=EXCLUDED.scale_min, scale_max=EXCLUDED.scale_max
      `,
      [id, name, weight, scale_min, scale_max]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save criterion', message: error.message });
  }
});

// Delete criterion
app.delete('/api/criteria/:id', (req, res) => {
  const { id } = req.params;

  if (!criteria.has(id)) {
    return res.status(404).json({
      error: 'Not found',
      message: `Criterion with id ${id} not found`
    });
  }

  criteria.delete(id);

  res.json({
    success: true,
    message: 'Criterion deleted successfully'
  });
});

// Initialize criteria with existing ones
app.post('/api/criteria/init', async (req, res) => {
  try {
    const initialCriteria = [
      {
        name: 'Customer Retention',
        weight: 24,
        scale_min: 1,
        scale_max: 5
      },
      {
        name: 'Move the Needle',
        weight: 26,
        scale_min: 1,
        scale_max: 5
      },
      {
        name: 'Strategic Alignment',
        weight: 25,
        scale_min: 1,
        scale_max: 5
      },
      {
        name: 'Tech Debt',
        weight: 25,
        scale_min: 1,
        scale_max: 5
      }
    ];

    // Insert each criterion with a generated id
    for (const c of initialCriteria) {
      const id = c.name.toLowerCase().replace(/\s+/g, '_');
      await pool.query(
        `INSERT INTO criteria (id, name, weight, scale_min, scale_max)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, weight=EXCLUDED.weight, scale_min=EXCLUDED.scale_min, scale_max=EXCLUDED.scale_max
        `,
        [id, c.name, c.weight, c.scale_min, c.scale_max]
      );
    }

    // Fetch and return all criteria
    const result = await pool.query('SELECT * FROM criteria');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to initialize criteria',
      message: error.message
    });
  }
});

// Update requirement rank
app.post('/api/requirements/:key/rank', async (req, res) => {
  const { key } = req.params;
  const { rank } = req.body;
  try {
    await pool.query('UPDATE requirements SET rank = $1 WHERE key = $2', [rank, key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rank', message: error.message });
  }
});

// Fix ranks (make them sequential)
app.post('/api/requirements/fix-ranks', async (req, res) => {
  try {
    // Get all requirements
    const result = await pool.query('SELECT * FROM requirements');
    const reqs = result.rows.map(req => ({ ...req, rank: req.rank || 0 }));

    // Separate requirements with rank 999 and others
    const normalReqs = reqs.filter(r => r.rank !== 999);
    const specialReqs = reqs.filter(r => r.rank === 999);

    // Sort only the normal requirements
    normalReqs.sort((a, b) => {
      if (a.rank === b.rank) {
        return b.score - a.score;
      }
      return a.rank - b.rank;
    });

    // Renumber only the normal requirements
    let newRank = 0;
    for (let i = 0; i < normalReqs.length; i++) {
      await pool.query('UPDATE requirements SET rank = $1 WHERE key = $2', [newRank, normalReqs[i].key]);
      normalReqs[i].rank = newRank;
      newRank++;
    }
    // specialReqs are left untouched

    res.json({
      success: true,
      message: 'Ranks have been fixed successfully',
      data: [...normalReqs, ...specialReqs]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fix ranks',
      message: error.message
    });
  }
});

// === New endpoint to update comments ===
app.post('/api/requirements/:key/comments', async (req, res) => {
  const { key } = req.params;
  const { comments } = req.body;
  try {
    await pool.query('UPDATE requirements SET comments = $1 WHERE key = $2', [comments, key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update comments', message: error.message });
  }
});

// Delete requirement
app.delete('/api/requirements/:key', async (req, res) => {
  const { key } = req.params;
  try {
    await pool.query('DELETE FROM requirements WHERE key = $1', [key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete requirement', message: error.message });
  }
});

// Serve React app for any unknown routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Create requirements table
pool.query(`
  CREATE TABLE IF NOT EXISTS requirements (
    key TEXT PRIMARY KEY,
    summary TEXT,
    priority TEXT,
    status TEXT,
    assignee TEXT,
    created TIMESTAMP,
    updated TIMESTAMP,
    timeSpent TEXT,
    labels TEXT,
    roughEstimate TEXT,
    relatedCustomers TEXT,
    prioritization INTEGER,
    weight INTEGER,
    score REAL,
    criteria JSONB,
    lastScored TIMESTAMP,
    rank INTEGER,
    comments TEXT
  )
`);

// Create criteria table
pool.query(`
  CREATE TABLE IF NOT EXISTS criteria (
    id TEXT PRIMARY KEY,
    name TEXT,
    weight INTEGER,
    scale_min INTEGER,
    scale_max INTEGER
  )
`);

app.post('/api/requirements', async (req, res) => {
  const r = req.body;
  try {
    await pool.query(
      `INSERT INTO requirements (key, summary, priority, status, assignee, created, updated, timeSpent, labels, roughEstimate, relatedCustomers, prioritization, weight, score, criteria, lastScored, rank, comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (key) DO UPDATE SET
         summary=EXCLUDED.summary, priority=EXCLUDED.priority, status=EXCLUDED.status, assignee=EXCLUDED.assignee, updated=EXCLUDED.updated, timeSpent=EXCLUDED.timeSpent, labels=EXCLUDED.labels, roughEstimate=EXCLUDED.roughEstimate, relatedCustomers=EXCLUDED.relatedCustomers, prioritization=EXCLUDED.prioritization, weight=EXCLUDED.weight, score=EXCLUDED.score, criteria=EXCLUDED.criteria, lastScored=EXCLUDED.lastScored, rank=EXCLUDED.rank, comments=EXCLUDED.comments
      `,
      [r.key, r.summary, r.priority, r.status, r.assignee, r.created, r.updated, r.timeSpent, r.labels, r.roughEstimate, r.relatedCustomers, r.prioritization, r.weight, r.score, r.criteria, r.lastScored, r.rank, r.comments]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save requirement', message: error.message });
  }
});
