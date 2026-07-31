const express = require('express');
const cors = require('cors');
const mongodb = require('mongodb');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nitesh:Nfdd1223@cluster0.kcjasgc.mongodb.net/?appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || '368ca4e46d889c5da3cd9693739bc15839d0db4d5750af9aaccbcc48889f62fa';
const client = new mongodb.MongoClient(MONGODB_URI);
let db;
let isConnected = false;

// Connect to MongoDB
client.connect().then(() => {
  db = client.db('userdb');
  isConnected = true;
  console.log('✅ Connected to MongoDB');
  
  // Create indexes
  db.collection('users').createIndex({ email: 1 });
  db.collection('users').createIndex({ name: 'text', fatherName: 'text', qualification: 'text', address: 'text' });
  db.collection('admins').createIndex({ email: 1 });
  console.log('📑 Indexes created');
  
  // Create default admin if not exists
  createDefaultAdmin();
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

// Create default admin
async function createDefaultAdmin() {
  try {
    if (!db) {
      console.log('⏳ Waiting for database connection...');
      setTimeout(createDefaultAdmin, 2000);
      return;
    }
    
    const admin = await db.collection('admins').findOne({ email: 'admin@example.com' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.collection('admins').insertOne({
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        createdAt: new Date()
      });
      console.log('✅ Default admin created: admin@example.com / admin123');
    } else {
      console.log('✅ Default admin already exists');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
  }
}

// Middleware to check database connection
const checkDB = (req, res, next) => {
  if (!isConnected || !db) {
    return res.status(503).json({ error: 'Database connection not ready. Please try again.' });
  }
  next();
};

app.use(checkDB);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    database: isConnected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// ======================== USER ROUTES ========================

// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, fatherName, qualification, mobileNumber, address, email } = req.body;
    
    // Validate all fields
    if (!name || !fatherName || !qualification || !mobileNumber || !address || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate mobile number
    if (!/^\d{10}$/.test(mobileNumber.replace(/[-\s]/g, ''))) {
      return res.status(400).json({ error: 'Mobile number must be 10 digits' });
    }

    // Check if email already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const result = await db.collection('users').insertOne({
      name,
      fatherName,
      qualification,
      mobileNumber,
      address,
      email,
      registeredAt: new Date(),
      status: 'Pending'
    });

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful! Your data will be reviewed by admin.',
      id: result.insertedId 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by email
app.get('/api/users/status/:email', async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ 
      email: user.email,
      name: user.name,
      status: user.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ======================== ADMIN ROUTES ========================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const admin = await db.collection('admins').findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true, 
      token,
      adminName: admin.name
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get all registrations
app.get('/api/admin/registrations', verifyToken, async (req, res) => {
  try {
    const users = await db.collection('users').find({}).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search registrations
app.get('/api/admin/search', verifyToken, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await db.collection('users')
      .find({ 
        $text: { $search: query } 
      })
      .toArray();
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete registration
app.delete('/api/admin/registrations/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongodb.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid registration ID' });
    }

    const result = await db.collection('users').deleteOne({
      _id: new mongodb.ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({ success: true, message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update registration status
app.patch('/api/admin/registrations/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.collection('users').updateOne(
      { _id: new mongodb.ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin stats
app.get('/api/admin/stats', verifyToken, async (req, res) => {
  try {
    const totalRegistrations = await db.collection('users').countDocuments({});
    const pendingRegistrations = await db.collection('users').countDocuments({ status: 'Pending' });
    const approvedRegistrations = await db.collection('users').countDocuments({ status: 'Approved' });
    const rejectedRegistrations = await db.collection('users').countDocuments({ status: 'Rejected' });

    res.json({
      totalRegistrations,
      pendingRegistrations,
      approvedRegistrations,
      rejectedRegistrations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});