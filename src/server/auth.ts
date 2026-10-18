import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'emperor_crm_secret_key_at_least_32_characters_long_for_security';

export interface SessionUser {
  sub: string;
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

// 1. Password Hashing with Argon2id
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// 2. JWT Generation & Verification
export function signSessionToken(user: { id: string; name: string; email: string; role: Role; timezone: string }): string {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      sub: decoded.sub,
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      timezone: decoded.timezone || 'UTC',
    };
  } catch {
    return null;
  }
}

// 3. Sliding-Window Rate Limiter
// 5 attempts per 15 minutes per IP + email
interface RateLimitRecord {
  attempts: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let record = rateLimitStore.get(key);
  if (!record) {
    record = { attempts: [] };
    rateLimitStore.set(key, record);
  }

  // Filter attempts in sliding window
  record.attempts = record.attempts.filter((timestamp) => now - timestamp < windowMs);

  if (record.attempts.length >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  record.attempts.push(now);
  return { allowed: true, remaining: maxAttempts - record.attempts.length };
}

// 4. Session Middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.emperor_session;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session expired. Please sign in again.',
    });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.clearCookie('emperor_session');
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session expired. Please sign in again.',
    });
  }

  // Re-verify user exists in DB on every server query as specified in prompt
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, timezone: true },
  });

  if (!user) {
    res.clearCookie('emperor_session');
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session expired. Please sign in again.',
    });
  }

  req.user = {
    sub: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
  };

  next();
}

// 5. Admin/Operator Authorization Guard
// Prompts explicitly specify: "Admin routes (/admin/**) require role ADMIN or OPERATOR; otherwise 404 (not 403, to avoid revealing the route)"
export function requireAdminOrOperator(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== Role.ADMIN && req.user.role !== Role.OPERATOR)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Page not found' });
  }
  next();
}

// 6. Cryptographic Password Reset Token
export function generatePasswordResetToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes
  return { rawToken, tokenHash, expiresAt };
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
