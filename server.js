const express = require('express');
const cors = require('cors');
const mongodb = require('mongodb');
const path = require('path');


const app = express();
app.use(cors());
app.use(express.json());


const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://nitesh:Nitesh123@cluster0.kcjasgc.mongodb.net/?appName=Cluster0';
const client = new mongodb.MongoClient(MONGO_URI);
let db;


// Connect to MongoDB
client.connect().then(() => {
 db = client.db('userdb');
 console.log('✅ Connected to MongoDB');
  // Create indexes
 db.collection('users').createIndex({ name: 'text', city: 'text', degree: 'text' });
 console.log('📑 Text indexes created');
}).catch(err => console.error('❌ MongoDB connection failed:', err));


// Serve static files
app.use(express.static(path.join(__dirname, 'public')));


// API: Add user
app.post('/api/users', async (req, res) => {
 try {
   const { name, city, degree } = req.body;
  
   if (!name || !city || !degree) {
     return res.status(400).json({ error: 'All fields required' });
   }
  
   const result = await db.collection('users').insertOne({
     name,
     city,
     degree,
     createdAt: new Date()
   });
  
   res.json({ success: true, id: result.insertedId });
 } catch (error) {
   res.status(500).json({ error: error.message });
 }
});


// API: Search users
app.get('/api/users', async (req, res) => {
 try {
   const users = await db.collection('users').find({}).toArray();
   res.json(users);
 } catch (error) {
   res.status(500).json({ error: error.message });
 }
});


// API: Search by query
app.get('/api/search', async (req, res) => {
 try {
   const query = req.query.q;
   const results = await db.collection('users')
     .find({ $text: { $search: query } })
     .toArray();
   res.json(results);
 } catch (error) {
   res.status(500).json({ error: error.message });
 }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
 console.log(`🚀 Server running on port ${PORT}`);
});

