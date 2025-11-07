// backend/routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../database/config.js';
import { hashPassword, comparePassword } from '../utils/passwordHash.js';

const router = express.Router();

// Normalize skills (array or comma-separated string)
function normalizeSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.map(s => s.trim()).filter(Boolean);
  if (typeof skills === 'string')
    return skills.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password, skills, bio } = req.body;
  const skillsArray = normalizeSkills(skills);

  if (!name || !email || !password || skillsArray.length === 0) {
    return res
      .status(400)
      .json({ error: 'All fields (name, email, password, skills) are required' });
  }

  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(400).json({ error: 'Email already exists' });

    const hashed = await hashPassword(password);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, bio, avatar, available) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashed, bio || '', `https://picsum.photos/seed/${name}/200`, true]
    );

    const userId = result.insertId;

    for (const skill of skillsArray) {
      await pool.execute('INSERT INTO user_skills (user_id, skill) VALUES (?, ?)', [
        userId,
        skill,
      ]);
    }

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'your_secret_key_here',
      { expiresIn: '7d' }
    );

    const [userRows] = await pool.execute(
      'SELECT id, name, email, bio, avatar, available FROM users WHERE id = ?',
      [userId]
    );
    const [skillRows] = await pool.execute(
      'SELECT skill FROM user_skills WHERE user_id = ?',
      [userId]
    );

    const user = userRows[0];
    user.skills = skillRows.map((r) => r.skill);

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    if (!res.headersSent)
      return res.status(500).json({ error: 'Internal server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    const isValid = await comparePassword(password, user.password);
    if (!isValid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const [skills] = await pool.execute(
      'SELECT skill FROM user_skills WHERE user_id = ?',
      [user.id]
    );

    user.skills = skills.map((r) => r.skill);
    delete user.password;

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_secret_key_here',
      { expiresIn: '7d' }
    );

    return res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    if (!res.headersSent)
      return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
