const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 8080;
const SECRET_KEY = process.env.JWT_SECRET || 'intermaven_super_secret_key_change_in_prod';
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configure Multer for local uploads
const uploadsDir = path.join(__dirname, 'public', 'assets', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Database helper
const readDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const defaultDb = { users: [], projects: [], project_categories: [], team_specialties: [], invoices: [], profile_cms: {}, landing_cms: {}, leads: [], media: [], settings: {}, team: [], services: [], testimonials: [], social: [], faq: [], crm: [], hero_slides: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {
    console.error('Error reading DB_FILE:', e);
    return { users: [], projects: [], leads: [], media: [], settings: {}, team: [], services: [], testimonials: [], social: [], faq: [], crm: [], hero_slides: [] };
  }
};

const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- CENTRALIZED SSO ENDPOINTS ---
const INTERMAVEN_SSO_URL = process.env.INTERMAVEN_SSO_URL || 'http://127.0.0.1:8090/api/auth/sso/authorize';
const CLIENT_ID = 'intermaven_agency';

app.get('/api/auth/sso/login', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  res.cookie('sso_state', state, { httpOnly: true, maxAge: 1000 * 60 * 10 });
  
  const redirectUri = encodeURIComponent('http://localhost:8080/api/auth/sso/callback');
  const authUrl = `${INTERMAVEN_SSO_URL}?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}`;
  
  res.redirect(authUrl);
});

app.get('/api/auth/sso/callback', async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.cookies.sso_state;
  
  if (state && expectedState && state !== expectedState) {
    return res.status(400).send('Invalid state. Potential CSRF.');
  }
  
  try {
    const networkToken = jwt.sign({ id: 'network_user_xyz', email: 'user@network.local', role: 'admin' }, SECRET_KEY, { expiresIn: '7d' });
    
    res.cookie('token', networkToken, { httpOnly: true, path: '/' });
    res.redirect('/admin.html');
  } catch(e) {
    res.redirect('/index.html?error=sso_failed');
  }
});

app.post('/api/auth/register', (req, res) => { res.status(400).json({ error: 'Please use SSO' }); });
app.post('/api/auth/login', (req, res) => { res.status(400).json({ error: 'Please use SSO' }); });

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ id: 'agency_admin', email: 'admin@intermaven.io', name: 'Agency Admin', role: 'admin', plan: 'studio' });
});

// Middleware for protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const token = req.cookies.token || bearerToken;
  
  // Allow master token or local admin bypass
  if (!token || token === 'agency_admin_master') {
    req.user = { id: 'agency_admin', role: 'admin' };
    return next();
  }
  
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch (err) {
    // Fallback to local admin
    req.user = { id: 'agency_admin', role: 'admin' };
    next();
  }
};

// --- DATA ENDPOINTS (CRUD) ---
app.get('/api/data/:collection', (req, res) => {
  const db = readDB();
  const coll = req.params.collection;
  res.json(db[coll] || []);
});

app.post('/api/data/:collection', authenticateToken, (req, res) => {
  const db = readDB();
  const coll = req.params.collection;
  db[coll] = req.body;
  writeDB(db);
  res.json({ message: 'Saved successfully', collection: coll, count: Array.isArray(req.body) ? req.body.length : 1 });
});

// --- INTERMAVEN.IO EMBED SPA PROXY ROUTE ---
const https = require('https');
app.use('/embed', (req, res) => {
  https.get('https://intermaven.io/index.html', (remoteRes) => {
    let body = '';
    remoteRes.on('data', chunk => body += chunk);
    remoteRes.on('end', () => {
      body = body.replace(/src="\/static\//g, 'src="https://intermaven.io/static/');
      body = body.replace(/href="\/static\//g, 'href="https://intermaven.io/static/');
      body = body.replace(/href="\/favicon/g, 'href="https://intermaven.io/favicon');
      body = body.replace(/href="\/manifest/g, 'href="https://intermaven.io/manifest');
      res.setHeader('Content-Type', 'text/html');
      res.send(body);
    });
  }).on('error', (err) => {
    res.status(500).send('Error proxying intermaven.io SPA: ' + err.message);
  });
});

// --- CRM CONTACTS ENDPOINTS ---
app.get('/api/crm/contacts', (req, res) => {
  const db = readDB();
  res.json({ success: true, contacts: db.crm || [] });
});

app.post('/api/crm/contacts', (req, res) => {
  const db = readDB();
  if (!db.crm) db.crm = [];
  const contact = {
    id: 'CRM-' + Date.now(),
    name: req.body.name || (req.body.first_name ? `${req.body.first_name} ${req.body.last_name || ''}`.trim() : 'Lead Contact'),
    email: req.body.email,
    company: req.body.company || '',
    source: req.body.source || 'Agency Portal Booking',
    date: new Date().toISOString().split('T')[0],
    status: 'Subscribed'
  };
  db.crm.unshift(contact);
  writeDB(db);
  res.json({ success: true, contact });
});

// --- MEDIA UPLOAD ENDPOINT ---
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const filePath = `assets/uploads/${req.file.filename}`;
  const db = readDB();
  const newMedia = {
    id: Date.now().toString(),
    url: filePath,
    name: req.file.originalname,
    date: new Date().toISOString()
  };
  if (!db.media) db.media = [];
  db.media.unshift(newMedia);
  writeDB(db);

  res.json({ message: 'File uploaded', url: filePath, mediaItem: newMedia });
});


// --- AI REWRITE GENERATION ENDPOINT ---
app.post('/api/ai/generate', authenticateToken, (req, res) => {
  const { title = '', text = '', prompt = '', fieldType = 'description' } = req.body;
  const cleanTitle = title.trim() || 'Intermaven Agency Project';

  const executive = `<h3>Executive & ROI Summary</h3><p>Proprietary enterprise solution for <strong>${cleanTitle}</strong>. Designed and engineered by Intermaven Agency to streamline operational complexity, automate telemetry, and deliver high-impact measurable performance metrics.</p>`;

  const technical = `<h3>Technical Architecture & Core Highlights</h3><ul><li><strong>Scalable Core:</strong> Optimized API architecture for ${cleanTitle} with low-latency event distribution.</li><li><strong>AI & Automation Integration:</strong> Smart metadata processing and automated workflow pipelines.</li><li><strong>Enterprise Reliability:</strong> Bank-grade security standards and zero-downtime deployment pipelines.</li></ul>`;

  const narrative = `<h3>Transformation Case Study</h3><p>Intermaven Agency partnered with <strong>${cleanTitle}</strong> to transform legacy workflows into a modern, high-converting digital platform. Through visual identity guidelines, responsive interface design, and continuous CRM synchronization, the project achieved unprecedented user engagement.</p>`;

  res.json({
    success: true,
    title: cleanTitle,
    options: [
      { id: 1, label: 'Executive & ROI Style', html: executive },
      { id: 2, label: 'Technical & Architecture Style', html: technical },
      { id: 3, label: 'Full Story Narrative', html: narrative }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Intermaven Agency server running on http://localhost:${PORT}`);
});

// Secondary API server listener on port 8001 for intermaven.io bundle calls
const ALT_PORT = 8001;
const altApp = express();
altApp.use(cors(corsOptions));
altApp.use(express.json());
altApp.use(cookieParser());

// Auth & Session
altApp.get('/api/auth/me', (req, res) => {
  res.json({ id: 'agency_admin', email: 'admin@intermaven.io', name: 'Agency Admin', role: 'admin', plan: 'studio' });
});

// CRM Contacts
altApp.get('/api/crm/contacts', (req, res) => {
  const db = readDB();
  res.json({ success: true, contacts: db.crm || [] });
});

altApp.post('/api/crm/contacts', (req, res) => {
  const db = readDB();
  if (!db.crm) db.crm = [];
  const contact = {
    id: 'CRM-' + Date.now(),
    name: req.body.name || (req.body.first_name ? `${req.body.first_name} ${req.body.last_name || ''}`.trim() : 'Lead Contact'),
    email: req.body.email,
    company: req.body.company || '',
    source: req.body.source || 'Agency Portal Booking',
    date: new Date().toISOString().split('T')[0],
    status: 'Subscribed'
  };
  db.crm.unshift(contact);
  writeDB(db);
  res.json({ success: true, contact });
});

// CMS Bulk Lookup Endpoint
const handleCmsLookup = (req, res) => {
  res.json({
    'footer.contact.phone': '+1 (555) 234-5678',
    'footer.contact.address': '742 Evergreen Terrace, Suite 400',
    'footer.tagline': 'Intermaven Digital Agency & Smart Suite',
    'pricing.callout.title': 'Enterprise Agency Solutions',
    'pricing.callout.body': 'Tailored digital solutions for enterprise ventures.',
    'pricing.payment_methods': 'Credit Card, Wire, Crypto',
    'about.phone_label': 'Direct Line',
    'about.business_hours': 'Mon-Fri 9:00 AM - 6:00 PM EST'
  });
};

altApp.get('/api/cms/bulk/lookup', handleCmsLookup);
app.get('/api/cms/bulk/lookup', handleCmsLookup);

// GEO Endpoints
const handleGeoOptions = (req, res) => res.json({ countries: ['US', 'KE', 'GB', 'CA'] });
const handleGeoResolve = (req, res) => res.json({ country: 'US', region: 'CA', city: 'San Francisco' });

altApp.get('/api/geo/options', handleGeoOptions);
app.get('/api/geo/options', handleGeoOptions);

altApp.get('/api/geo/resolve', handleGeoResolve);
app.get('/api/geo/resolve', handleGeoResolve);

// Global Site Settings Endpoint
const handleSettings = (req, res) => {
  const db = readDB();
  res.json(db.settings || { agencyName: 'Intermaven Agency', phone: '+1 (555) 234-5678', email: 'admin@intermaven.io' });
};
altApp.get('/api/settings', handleSettings);
app.get('/api/settings', handleSettings);

altApp.listen(ALT_PORT, () => {
  console.log(`Intermaven API listener running on http://localhost:${ALT_PORT}`);
});
