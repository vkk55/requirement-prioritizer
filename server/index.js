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
    'weight': ['Weight', 'weight', 'WEIGHT']
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
app.post('/api/requirements/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload an Excel file'
      });
    }

    // Get field mapping from request
    let mapping = {};
    try {
      mapping = JSON.parse(req.body.mapping || '{}');
    } catch (e) {
      console.error('Error parsing mapping:', e);
      return res.status(400).json({
        error: 'Invalid mapping format',
        message: 'The field mapping data is not in the correct format'
      });
    }
    
    console.log('Received mapping:', mapping);
    
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
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Get headers from the first row
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({r: 0, c: C})];
      headers[C] = cell ? cell.v : undefined;
    }

    console.log('Found headers:', headers);

    // Convert to array of objects using the mapping
    const data = [];
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const row = {};
      for (const [field, excelColumn] of Object.entries(mapping)) {
        const C = headers.findIndex(h => h === excelColumn);
        if (C !== -1) {
          const cell = worksheet[XLSX.utils.encode_cell({r: R, c: C})];
          row[field] = cell ? cell.v : '';
        }
      }
      if (Object.keys(row).length > 0) {
        data.push(row);
      }
    }

    // Analyze each row
    const preview = {
      total: data.length,
      toBeUpdated: [],
      toBeInserted: [],
      errors: []
    };

    data.forEach((row, index) => {
      if (!row.key) {
        preview.errors.push({
          row: index + 2,
          message: 'Missing Key field'
        });
        return;
      }

      const operation = requirements.has(row.key) ? 'update' : 'insert';
      const previewItem = {
        key: row.key,
        summary: row.summary || '',
        operation,
        currentValues: operation === 'update' ? requirements.get(row.key) : null,
        newValues: {
          summary: row.summary || '',
          priority: row.priority || '',
          status: row.status || '',
          assignee: row.assignee || '',
          timeSpent: row.timeSpent || '',
          labels: row.labels || '',
          roughEstimate: row.roughEstimate || '',
          relatedCustomers: row.relatedCustomers || '',
          prioritization: row.prioritization || 0,
          weight: row.weight || 0
        }
      };

      if (operation === 'update') {
        preview.toBeUpdated.push(previewItem);
      } else {
        preview.toBeInserted.push(previewItem);
      }
    });

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
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Preview failed',
      message: error.message
    });
  }
});

// Import requirements from Excel
app.post('/api/requirements/import', upload.single('file'), (req, res) => {
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
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Get headers from the first row
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({r: 0, c: C})];
      headers[C] = cell ? cell.v : undefined;
    }

    // Convert to array of objects using the mapping
    const data = [];
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const row = {};
      for (const [field, excelColumn] of Object.entries(mapping)) {
        const C = headers.findIndex(h => h === excelColumn);
        if (C !== -1) {
          const cell = worksheet[XLSX.utils.encode_cell({r: R, c: C})];
          row[field] = cell ? cell.v : '';
        }
      }
      if (Object.keys(row).length > 0) {
        data.push(row);
      }
    }

    // Get the highest current rank
    const highestRank = Math.max(
      -1,
      ...Array.from(requirements.values()).map(r => r.rank || 0)
    );
    let nextRank = highestRank + 1;

    // Validate and process each row
    const results = {
      total: data.length,
      updated: 0,
      added: 0,
      errors: []
    };

    data.forEach((row, index) => {
      if (!row.key) {
        results.errors.push(`Row ${index + 2}: Missing Key field`);
        return;
      }

      // Create or update requirement
      const requirement = {
        key: row.key,
        summary: row.summary || '',
        priority: row.priority || '',
        status: row.status || '',
        assignee: row.assignee || '',
        created: row.created || new Date().toISOString(),
        updated: row.updated || new Date().toISOString(),
        timeSpent: row.timeSpent || '',
        labels: row.labels || '',
        roughEstimate: row.roughEstimate || '',
        relatedCustomers: row.relatedCustomers || '',
        prioritization: row.prioritization || 0,
        weight: row.weight || 0,
        score: requirements.has(row.key) ? requirements.get(row.key).score : 0,
        criteria: requirements.has(row.key) ? requirements.get(row.key).criteria : {},
        lastScored: requirements.has(row.key) ? requirements.get(row.key).lastScored : null,
        rank: requirements.has(row.key) ? requirements.get(row.key).rank : nextRank++,
        comments: requirements.has(row.key) ? requirements.get(row.key).comments || '' : ''
      };

      if (requirements.has(row.key)) {
        results.updated++;
      } else {
        results.added++;
      }

      requirements.set(row.key, requirement);
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    saveData();

    res.json({
      success: true,
      message: 'Requirements imported successfully',
      results
    });

  } catch (error) {
    console.error('Import error:', error);
    
    // Clean up uploaded file if it exists
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
app.post('/api/requirements/:key/score', (req, res) => {
  const { key } = req.params;
  const { score, criteria } = req.body;

  if (!requirements.has(key)) {
    return res.status(404).json({
      error: 'Not found',
      message: `Requirement with key ${key} not found`
    });
  }

  const requirement = requirements.get(key);
  requirement.score = score;
  requirement.criteria = criteria;
  requirement.lastScored = new Date().toISOString();
  requirements.set(key, requirement);

  saveData();

  res.json({
    success: true,
    data: requirement
  });
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
  const { id, name, weight, scale_min, scale_max } = req.body;
  try {
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
app.post('/api/criteria/init', (req, res) => {
  try {
    const initialCriteria = [
      {
        id: 'customer_retention',
        name: 'Customer Retention',
        weight: 24,
        scale_min: 1,
        scale_max: 5
      },
      {
        id: 'move_the_needle',
        name: 'Move the Needle',
        weight: 26,
        scale_min: 1,
        scale_max: 5
      },
      {
        id: 'strategic_alignment',
        name: 'Strategic Alignment',
        weight: 25,
        scale_min: 1,
        scale_max: 5
      },
      {
        id: 'tech_debt',
        name: 'Tech Debt',
        weight: 25,
        scale_min: 1,
        scale_max: 5
      }
    ];

    // Clear existing criteria
    criteria.clear();

    // Add initial criteria
    initialCriteria.forEach(criterion => {
      criteria.set(criterion.id, criterion);
    });

    res.json({
      success: true,
      data: initialCriteria
    });
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
app.post('/api/requirements/fix-ranks', (req, res) => {
  try {
    // Get all requirements and sort them by current rank and score
    const reqs = Array.from(requirements.values())
      .map(req => ({ ...req, rank: req.rank || 0 })) // Ensure rank is initialized
      .sort((a, b) => {
        if (a.rank === b.rank) {
          return b.score - a.score; // Higher score comes first when ranks are equal
        }
        return a.rank - b.rank;
      });

    // Reassign ranks sequentially starting from 0
    reqs.forEach((req, index) => {
      req.rank = index;
      requirements.set(req.key, req);
    });

    res.json({
      success: true,
      message: 'Ranks have been fixed successfully',
      data: reqs
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
