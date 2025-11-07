import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../database/config.js';
import { hashPassword, comparePassword } from '../utils/passwordHash.js';

const router = express.Router();

// ✅ REGISTER (SIGN UP)
router.post('/register', async (req, res) => {
  console.log('📥 Received signup request:', req.body);

  const { name, email, password, skills, bio } = req.body;

  // Normalize skills (allow comma-separated string or array)
  const skillsArray = Array.isArray(skills)
    ? skills.map(s => s.trim()).filter(Boolean)
    : typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : [];

  console.log('🧩 Normalized skills:', skillsArray);

  if (!name || !email || !password || skillsArray.length === 0) {
    console.log('❌ Missing required fields');
    return res.status(400).json({
      error: 'All fields are required (name, email, password, skills)',
    });
  }

  try {
    // Check for existing email
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUsers.length > 0) {
      console.log('⚠️ Email already exists:', email);
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    console.log('🔒 Password hashed');

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, bio, avatar, available) VALUES (?, ?, ?, ?, ?, ?)',
      [
        name,
        email,
        hashedPassword,
        bio || '',
        `https://picsum.photos/seed/${encodeURIComponent(name.split(' ')[0])}/200`,
        true,
      ]
    );

    const userId = result.insertId;
    console.log('✅ User created with ID:', userId);

    // Insert skills
    for (const skill of skillsArray) {
      await pool.execute(
        'INSERT INTO user_skills (user_id, skill) VALUES (?, ?)',
        [userId, skill]
      );
    }
    console.log('🧠 Skills added:', skillsArray);

    // Generate JWT
    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'your_secret_key_here',
      { expiresIn: '7d' }
    );
    console.log('🎫 Token generated');

    // Fetch user with skills
    const [userRows] = await pool.execute(
      'SELECT id, name, email, bio, avatar, available FROM users WHERE id = ?',
      [userId]
    );
    const [skillRows] = await pool.execute(
      'SELECT skill FROM user_skills WHERE user_id = ?',
      [userId]
    );

    const user = userRows[0];
    user.skills = skillRows.map(row => row.skill);
    console.log('📤 Sending response:', { user });

    // ✅ Always return JSON
    return res.status(201).json({ user, token });
  } catch (error) {
    console.error('❌ Registration error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal server error during registration',
        details: error.message,
      });
    }
  }
});

// ✅ LOGIN
router.post('/login', async (req, res) => {
  console.log('📥 Login attempt:', req.body.email);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ Invalid email');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const [skillRows] = await pool.execute(
      'SELECT skill FROM user_skills WHERE user_id = ?',
      [user.id]
    );

    user.skills = skillRows.map(row => row.skill);
    delete user.password;

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_secret_key_here',
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful:', user.email);
    res.json({ user, token });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

export default router;
