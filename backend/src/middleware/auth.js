import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CRITICAL (C1) — never fall back to a hardcoded JWT secret. With a known
// default secret anyone could forge valid tokens and take over any account.
// If JWT_SECRET is missing from the environment, fail fast at startup instead
// of booting with an unsafe default. routes/google.js consumes this same
// validated constant (single source of truth), so the fatal error also covers
// the OAuth state signing there.
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment');
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return next();
  const decoded = verifyToken(token);
  if (decoded?.userId) {
    prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, name: true, email: true, role: true, avatar: true } }).then((u) => {
      req.user = u;
      next();
    }).catch(() => next());
  } else {
    next();
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
