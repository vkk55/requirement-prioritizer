const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 6;
const OTP_RATE_LIMIT = 3; // max OTPs per email per hour

// In-memory rate limit (for demo; use Redis for production)
const otpRequestCounts = {};

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

// Create login_otps table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS login_otps (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
  )
`);

// Helper: generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: send OTP email (configure as needed)
async function sendOtpEmail(email, otp) {
  // Configure your SMTP or use SendGrid/Mailgun/SES
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or 'SendGrid', 'Mailgun', etc.
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your Login Code',
    text: `Your one-time login code is: ${otp}\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
  });
}

// Endpoint: Request OTP
app.post('/api/auth/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.endsWith('@viseven.com')) {
    return res.status(400).json({ error: 'Only viseven.com email addresses are allowed.' });
  }
  // Rate limit (basic, per hour)
  const now = Date.now();
  otpRequestCounts[email] = otpRequestCounts[email] || [];
  otpRequestCounts[email] = otpRequestCounts[email].filter(ts => now - ts < 60 * 60 * 1000);
  if (otpRequestCounts[email].length >= OTP_RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
  }
  otpRequestCounts[email].push(now);
  // Generate and hash OTP
  const otp = generateOTP();
  const otp_hash = await bcrypt.hash(otp, 10);
  const expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  // Store in DB
  await pool.query(
    'INSERT INTO login_otps (email, otp_hash, expires_at, used) VALUES ($1, $2, $3, false)',
    [email, otp_hash, expires_at]
  );
  // Send email
  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send OTP email.' });
  }
  res.json({ success: true, message: 'OTP sent to your email.' });
});

// Endpoint: Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }
  // Find latest, unused, unexpired OTP for this email
  const result = await pool.query(
    'SELECT * FROM login_otps WHERE email = $1 AND used = false AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1',
    [email]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({ error: 'No valid OTP found or OTP expired.' });
  }
  const otpRow = result.rows[0];
  const valid = await bcrypt.compare(otp, otpRow.otp_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid OTP.' });
  }
  // Mark OTP as used
  await pool.query('UPDATE login_otps SET used = true WHERE id = $1', [otpRow.id]);
  // Issue JWT (or session)
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

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
    // Map productowner to productOwner for frontend compatibility
    const data = result.rows.map(row => {
      if (row.productowner && !row.productOwner) {
        row.productOwner = row.productowner;
        delete row.productowner;
      }
      return row;
    });
    res.json({ success: true, data });
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
      // Normalize productowner to productOwner
      if (row.productowner && !row.productOwner) {
        row.productOwner = row.productowner;
        delete row.productowner;
      }
      // Ensure productOwner is always mapped to productowner for DB
      if (row.productOwner && !row.productowner) {
        row.productowner = row.productOwner;
        delete row.productOwner;
      }
      // Set default rank to 0 if not provided or empty
      if (row.rank === undefined || row.rank === null || row.rank === '') {
        row.rank = 0;
      }
      // Debug log for row data (after normalization)
      console.log('[IMPORT DEBUG] Row to be saved:', row);
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
    // Fetch current rank and updatehistory
    const result = await pool.query('SELECT rank, updatehistory FROM requirements WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    const oldRank = result.rows[0].rank;
    const oldHistory = result.rows[0].updatehistory || '';

    if (oldRank === rank) {
      // No change, do not log or update
      return res.json({ success: true, message: 'Rank unchanged, no log entry added.' });
    }

    // Prepare new log line
    const now = new Date().toLocaleString();
    const logLine = `Rank was updated from "${oldRank}" to "${rank}" on "${now}".`;

    // Append to updatehistory (with newline)
    const newHistory = oldHistory ? `${oldHistory}\n${logLine}` : logLine;

    // Update rank and updatehistory
    await pool.query(
      'UPDATE requirements SET rank = $1, updatehistory = $2 WHERE key = $3',
      [rank, newHistory, key]
    );

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
    relatedcustomers TEXT,
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
    // Defensive: If relatedcustomers, criteria, or rank is null/undefined, fetch current value from DB
    let relatedcustomers = r.relatedcustomers;
    let criteria = r.criteria;
    let rank = r.rank;
    if ((relatedcustomers === null || relatedcustomers === undefined || criteria === null || criteria === undefined || rank === null || rank === undefined) && r.key) {
      const existing = await pool.query('SELECT relatedcustomers, criteria, rank FROM requirements WHERE key = $1', [r.key]);
      if (existing.rows.length > 0) {
        if (relatedcustomers === null || relatedcustomers === undefined) {
          relatedcustomers = existing.rows[0].relatedcustomers;
        }
        if (criteria === null || criteria === undefined) {
          criteria = existing.rows[0].criteria;
        }
        if (rank === null || rank === undefined) {
          rank = existing.rows[0].rank;
        }
      }
    }
    await pool.query(
      `INSERT INTO requirements (key, summary, priority, status, assignee, created, updated, timeSpent, labels, roughEstimate, relatedcustomers, prioritization, weight, score, criteria, lastScored, rank, comments, "InPlan?", "MinorRelCandidate?", "Team(s)")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (key) DO UPDATE SET
         summary=EXCLUDED.summary, priority=EXCLUDED.priority, status=EXCLUDED.status, assignee=EXCLUDED.assignee, updated=EXCLUDED.updated, timeSpent=EXCLUDED.timeSpent, labels=EXCLUDED.labels, roughEstimate=EXCLUDED.roughEstimate, relatedcustomers=EXCLUDED.relatedcustomers, prioritization=EXCLUDED.prioritization, weight=EXCLUDED.weight, score=EXCLUDED.score, criteria=EXCLUDED.criteria, lastScored=EXCLUDED.lastScored, rank=EXCLUDED.rank, comments=EXCLUDED.comments, "InPlan?"=EXCLUDED."InPlan?", "MinorRelCandidate?"=EXCLUDED."MinorRelCandidate?", "Team(s)"=EXCLUDED."Team(s)"
      `,
      [r.key, r.summary, r.priority, r.status, r.assignee, r.created, r.updated, r.timeSpent, r.labels, r.roughEstimate, relatedcustomers, r.prioritization, r.weight, r.score, criteria, r.lastScored, rank, r.comments, r["InPlan?"], r["MinorRelCandidate?"], r["Team(s)"]]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save requirement', message: error.message });
  }
});

// Create squad table
pool.query(`
  CREATE TABLE IF NOT EXISTS squad (
    id TEXT PRIMARY KEY,
    name TEXT,
    capacity INTEGER
  )
`);

// Get all squads
app.get('/api/squads', async (req, res) => {
  console.log('GET /api/squads called');
  try {
    const result = await pool.query('SELECT * FROM squad');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch squads', message: error.message });
  }
});

// Add or update a squad
app.post('/api/squads', async (req, res) => {
  const { id, name, capacity } = req.body;
  try {
    await pool.query(
      `INSERT INTO squad (id, name, capacity)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, capacity=EXCLUDED.capacity`,
      [id, name, capacity]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save squad', message: error.message });
  }
});

// Delete a squad
app.delete('/api/squads/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM squad WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete squad', message: error.message });
  }
});

// Fallback route (must be last)
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

console.log('Server code loaded, NODE_ENV:', process.env.NODE_ENV);
