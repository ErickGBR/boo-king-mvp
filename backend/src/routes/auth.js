import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { verifyGoogleToken, verifyGoogleAccessToken } from '../services/google.js';

const router = Router();
const prisma = new PrismaClient();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(422).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
      select: { id: true, name: true, email: true, role: true },
    });
    const token = signToken({ userId: user.id });
    res.status(201).json({ user, token });
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ userId: user.id });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      token,
    });
  }
);

router.post('/logout', (_, res) => {
  res.clearCookie('token').json({ ok: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

router.post('/google', async (req, res) => {
  try {
    const { credential, idToken } = req.body || {};
    const googleToken = credential || idToken;
    if (!googleToken) {
      return res.status(422).json({ error: 'Google credential required' });
    }
    // Prefer ID token verification; fall back to tokeninfo for access tokens.
    let payload = await verifyGoogleToken(googleToken);
    if (!payload) payload = await verifyGoogleAccessToken(googleToken);
    if (!payload?.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const email = payload.email;
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, avatar: true, googleId: true },
    });
    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, avatar: payload.picture || user.avatar },
          select: { id: true, name: true, email: true, role: true, avatar: true },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          name: payload.name || email.split('@')[0],
          email,
          googleId: payload.sub,
          avatar: payload.picture || null,
          password: null,
        },
        select: { id: true, name: true, email: true, role: true, avatar: true },
      });
    }
    const authToken = signToken({ userId: user.id });
    res.json({ user, token: authToken });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

export default router;
