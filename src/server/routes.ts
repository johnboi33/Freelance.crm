import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from './db.js';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  requireAuth,
  requireAdminOrOperator,
  checkRateLimit,
  generatePasswordResetToken,
  hashResetToken,
} from './auth.js';
import { LeadStage, InteractionType, Direction, TaskStatus, Role, Prisma } from '@prisma/client';

export const apiRouter = Router();

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name must be at most 80 characters'),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
  confirmPassword: z.string(),
  timezone: z.string().default('UTC'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, email, password, timezone } = parseResult.data;

    // Check existing email - non-enumerating friendly response
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({
        error: 'REGISTRATION_FAILED',
        message: 'An account with this email address cannot be created. If you already have an account, please sign in.',
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        timezone: timezone || 'UTC',
        role: Role.FREELANCER,
        preferences: {
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
          defaultStage: 'IDENTIFIED',
          hideTerminalStages: false,
        },
      },
    });

    const token = signSessionToken(user);
    res.cookie('emperor_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: user.timezone,
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const { email, password } = parseResult.data;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `login:${clientIp}:${email}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const token = signSessionToken(user);
    res.cookie('emperor_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: user.timezone,
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('emperor_session');
  return res.json({ success: true });
});

apiRouter.get('/auth/session', requireAuth, (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `forgot:${clientIp}:${email || 'none'}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many password reset requests. Please try again in 15 minutes.',
      });
    }

    if (typeof email === 'string' && email.includes('@')) {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (user) {
        const { rawToken, tokenHash, expiresAt } = generatePasswordResetToken();
        // Invalidate previous tokens
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });

        // In development, log the reset URL to the console as specified:
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
        console.log(`\n======================================================`);
        console.log(`[PASSWORD RESET DEV LINK for ${user.email}]:`);
        console.log(`URL: ${resetUrl}`);
        console.log(`Token: ${rawToken}`);
        console.log(`Expires in 60 minutes`);
        console.log(`======================================================\n`);
      }
    }

    // Always return same generic success message to prevent account enumeration
    return res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Password reset token is required or invalid.' });
    }

    if (!newPassword || newPassword.length < 10 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Password must be at least 10 characters and contain letters and numbers.',
      });
    }

    const tokenHash = hashResetToken(token);
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'EXPIRED_OR_USED_TOKEN',
        message: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.activity.create({
        data: {
          userId: resetRecord.userId,
          actorRole: resetRecord.user.role,
          action: 'password.changed',
          details: { via: 'reset_token' },
        },
      }),
    ]);

    return res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ==========================================
// HELPER: Sync lead's nextFollowUp to earliest open task
// ==========================================
async function syncLeadNextFollowUp(leadId: string, tx: Prisma.TransactionClient = prisma) {
  const earliestTask = await tx.task.findFirst({
    where: {
      leadId,
      status: TaskStatus.PENDING,
    },
    orderBy: { dueAt: 'asc' },
  });

  await tx.lead.update({
    where: { id: leadId },
    data: {
      nextFollowUp: earliestTask ? earliestTask.dueAt : null,
    },
  });
}

// ==========================================
// LEADS ROUTES & ACTIONS
// ==========================================

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Lead name is required'),
  company: z.string().trim().optional().nullable(),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().trim().optional().nullable().or(z.literal('')),
  website: z.string().trim().url('Invalid URL').optional().nullable().or(z.literal('')),
  source: z.string().trim().min(1, 'Source is required').default('Referral'),
  service: z.string().trim().min(1, 'Service is required').default('Consulting'),
  stage: z.nativeEnum(LeadStage).default(LeadStage.IDENTIFIED),
  potentialValue: z.number().min(0, 'Potential value cannot be negative').optional().nullable(),
  currency: z.string().trim().default('USD'),
  nextFollowUp: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
  createFollowUpTask: z.boolean().optional(),
});

// GET /api/leads
apiRouter.get('/leads', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      search,
      stage,
      source,
      followUpStatus,
      sortBy = 'nextFollowUp',
      sortOrder = 'asc',
      page = '1',
      limit = '15',
      showArchived = 'false',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.max(1, parseInt(limit as string, 10) || 15);
    const skip = (pageNum - 1) * take;

    const where: Prisma.LeadWhereInput = {
      userId,
      archivedAt: showArchived === 'true' ? { not: null } : null,
    };

    // Case-insensitive search on name, company, email scoped to user
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Stage filter (multi-select)
    if (stage) {
      const stages = Array.isArray(stage) ? (stage as LeadStage[]) : (stage as string).split(',') as LeadStage[];
      where.stage = { in: stages };
    }

    // Source filter (multi-select)
    if (source) {
      const sources = Array.isArray(source) ? (source as string[]) : (source as string).split(',');
      where.source = { in: sources };
    }

    // Follow-up status filter (Overdue / Due today / Upcoming / None)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (followUpStatus === 'Overdue') {
      where.nextFollowUp = { lt: startOfToday };
    } else if (followUpStatus === 'Due today') {
      where.nextFollowUp = { gte: startOfToday, lte: endOfToday };
    } else if (followUpStatus === 'Upcoming') {
      where.nextFollowUp = { gt: endOfToday };
    } else if (followUpStatus === 'None') {
      where.nextFollowUp = null;
    }

    // Order By
    let orderBy: Prisma.LeadOrderByWithRelationInput = { nextFollowUp: 'asc' };
    const orderDirection = sortOrder === 'desc' ? 'desc' : 'asc';

    if (sortBy === 'name') {
      orderBy = { name: orderDirection };
    } else if (sortBy === 'createdAt') {
      orderBy = { createdAt: orderDirection };
    } else if (sortBy === 'potentialValue') {
      orderBy = { potentialValue: orderDirection };
    } else if (sortBy === 'updatedAt') {
      orderBy = { updatedAt: orderDirection };
    } else {
      // nextFollowUp sort with nulls last
      orderBy = { nextFollowUp: orderDirection };
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: {
              interactions: true,
              tasks: { where: { status: TaskStatus.PENDING } },
            },
          },
        },
      }),
    ]);

    return res.json({
      leads,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/leads (Create lead)
apiRouter.post('/leads', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const parseResult = leadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;

    // Idempotency: Reject duplicate if identical name + email created by user in last 10s
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const duplicate = await prisma.lead.findFirst({
      where: {
        userId,
        name: data.name,
        email: data.email ? data.email : null,
        createdAt: { gte: tenSecondsAgo },
      },
    });

    if (duplicate) {
      return res.status(409).json({
        error: 'DUPLICATE_SUBMISSION',
        message: 'A lead with this name and email was created moments ago.',
        lead: duplicate,
      });
    }

    const nextFollowUpDate = data.nextFollowUp ? new Date(data.nextFollowUp) : null;

    const result = await prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          userId,
          name: data.name,
          company: data.company || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          source: data.source,
          service: data.service,
          stage: data.stage,
          potentialValue: data.potentialValue !== undefined && data.potentialValue !== null ? new Prisma.Decimal(data.potentialValue) : null,
          currency: data.currency || 'USD',
          nextFollowUp: nextFollowUpDate,
          notes: data.notes || null,
        },
      });

      // Write activity lead.created
      await tx.activity.create({
        data: {
          userId,
          leadId: newLead.id,
          actorRole: req.user!.role,
          action: 'lead.created',
          details: {
            name: newLead.name,
            stage: newLead.stage,
            potentialValue: data.potentialValue,
            source: newLead.source,
          },
        },
      });

      // If nextFollowUp is provided and createFollowUpTask is selected
      if (nextFollowUpDate && data.createFollowUpTask) {
        await tx.task.create({
          data: {
            userId,
            leadId: newLead.id,
            title: `Follow up with ${newLead.name}`,
            description: `Scheduled initial follow-up for ${newLead.service}`,
            dueAt: nextFollowUpDate,
            status: TaskStatus.PENDING,
          },
        });
      }

      return newLead;
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// GET /api/leads/:id
apiRouter.get('/leads/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        interactions: {
          orderBy: { occurredAt: 'desc' },
        },
        tasks: {
          orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        user: {
          select: { id: true, name: true, email: true, timezone: true },
        },
      },
    });

    // Check existence and ownership (Returns 404 to avoid leaking existence)
    if (!lead || lead.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    return res.json(lead);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// PATCH /api/leads/:id (Update lead)
apiRouter.patch('/leads/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    if (existing.archivedAt) {
      return res.status(400).json({ error: 'ARCHIVED', message: 'Archived leads cannot be edited. Please restore the lead first.' });
    }

    const parseResult = leadSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors });
    }

    const updates = parseResult.data;
    const diff: Record<string, { old: any; new: any }> = {};

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && (existing as any)[key] !== val) {
        diff[key] = { old: (existing as any)[key], new: val };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resLead = await tx.lead.update({
        where: { id },
        data: {
          name: updates.name,
          company: updates.company,
          email: updates.email,
          phone: updates.phone,
          website: updates.website,
          source: updates.source,
          service: updates.service,
          stage: updates.stage,
          potentialValue: updates.potentialValue !== undefined && updates.potentialValue !== null ? new Prisma.Decimal(updates.potentialValue) : undefined,
          currency: updates.currency,
          nextFollowUp: updates.nextFollowUp !== undefined ? (updates.nextFollowUp ? new Date(updates.nextFollowUp) : null) : undefined,
          notes: updates.notes,
        },
      });

      if (Object.keys(diff).length > 0) {
        await tx.activity.create({
          data: {
            userId,
            leadId: id,
            actorRole: req.user!.role,
            action: 'lead.updated',
            details: diff,
          },
        });
      }

      return resLead;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/leads/:id/stage (Move lead stage)
apiRouter.post('/leads/:id/stage', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { stage, wonValue, outcomeReason, reopenConfirmed } = req.body;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    if (existing.archivedAt) {
      return res.status(400).json({ error: 'ARCHIVED', message: 'Cannot move stage of archived lead.' });
    }

    if (!Object.values(LeadStage).includes(stage)) {
      return res.status(400).json({ error: 'INVALID_STAGE', message: 'Invalid lead stage' });
    }

    // Terminal stage validations
    if (stage === LeadStage.WON) {
      const val = wonValue !== undefined && wonValue !== null ? Number(wonValue) : Number(existing.potentialValue || 0);
      if (isNaN(val) || val <= 0) {
        return res.status(400).json({ error: 'WON_VALUE_REQUIRED', message: 'A valid won deal value is required.' });
      }
    }

    if (stage === LeadStage.LOST) {
      if (!outcomeReason || typeof outcomeReason !== 'string' || outcomeReason.trim().length < 3) {
        return res.status(400).json({ error: 'OUTCOME_REASON_REQUIRED', message: 'Please provide a reason for the lost deal (min 3 characters).' });
      }
    }

    // Reopening check
    const isCurrentlyTerminal = existing.stage === LeadStage.WON || existing.stage === LeadStage.LOST;
    const isMovingToActive = stage !== LeadStage.WON && stage !== LeadStage.LOST;

    if (isCurrentlyTerminal && isMovingToActive && !reopenConfirmed) {
      return res.status(400).json({
        error: 'REOPEN_CONFIRMATION_REQUIRED',
        message: 'This will reopen the opportunity. Continue?',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.LeadUpdateInput = {
        stage,
      };

      if (stage === LeadStage.WON) {
        updateData.wonValue = wonValue ? new Prisma.Decimal(wonValue) : existing.potentialValue;
        updateData.outcomeReason = null;
      } else if (stage === LeadStage.LOST) {
        updateData.outcomeReason = outcomeReason.trim();
        updateData.wonValue = null;
      } else if (isCurrentlyTerminal && isMovingToActive && reopenConfirmed) {
        updateData.wonValue = null;
        updateData.outcomeReason = null;
      }

      const resLead = await tx.lead.update({
        where: { id },
        data: updateData,
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: id,
          actorRole: req.user!.role,
          action: 'lead.stage_changed',
          details: {
            from: existing.stage,
            to: stage,
            wonValue: stage === LeadStage.WON ? Number(updateData.wonValue) : undefined,
            outcomeReason: stage === LeadStage.LOST ? outcomeReason : undefined,
          },
        },
      });

      return resLead;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/leads/:id/archive
apiRouter.post('/leads/:id/archive', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resLead = await tx.lead.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: id,
          actorRole: req.user!.role,
          action: 'lead.archived',
        },
      });

      return resLead;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/leads/:id/restore
apiRouter.post('/leads/:id/restore', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resLead = await tx.lead.update({
        where: { id },
        data: { archivedAt: null },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: id,
          actorRole: req.user!.role,
          action: 'lead.restored',
        },
      });

      return resLead;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// PATCH /api/leads/:id/notes
apiRouter.patch('/leads/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { notes } = req.body;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resLead = await tx.lead.update({
        where: { id },
        data: { notes: typeof notes === 'string' ? notes : null },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: id,
          actorRole: req.user!.role,
          action: 'lead.notes_updated',
        },
      });

      return resLead;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ==========================================
// INTERACTIONS ROUTES
// ==========================================

const interactionSchema = z.object({
  type: z.nativeEnum(InteractionType),
  direction: z.nativeEnum(Direction),
  outcome: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  occurredAt: z.string().refine((val) => new Date(val).getTime() <= Date.now() + 60000, {
    message: 'Interaction occurred time cannot be in the future',
  }),
  followUpTask: z.object({
    title: z.string().min(1),
    dueAt: z.string(),
  }).optional().nullable(),
});

apiRouter.post('/leads/:id/interactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: leadId } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found' });
    }

    const parseResult = interactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors });
    }

    const data = parseResult.data;

    const result = await prisma.$transaction(async (tx) => {
      const newInteraction = await tx.interaction.create({
        data: {
          leadId,
          userId,
          type: data.type,
          direction: data.direction,
          outcome: data.outcome || null,
          notes: data.notes || null,
          occurredAt: new Date(data.occurredAt),
        },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId,
          actorRole: req.user!.role,
          action: 'interaction.logged',
          details: {
            type: data.type,
            direction: data.direction,
            outcome: data.outcome,
          },
        },
      });

      if (data.followUpTask && data.followUpTask.dueAt) {
        await tx.task.create({
          data: {
            userId,
            leadId,
            title: data.followUpTask.title,
            dueAt: new Date(data.followUpTask.dueAt),
            status: TaskStatus.PENDING,
          },
        });
        await syncLeadNextFollowUp(leadId, tx);
      }

      return newInteraction;
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.delete('/interactions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const item = await prisma.interaction.findUnique({ where: { id } });
    if (!item || item.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interaction not found' });
    }

    await prisma.interaction.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ==========================================
// TASKS ROUTES
// ==========================================

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().trim().optional().nullable(),
  dueAt: z.string().min(1, 'Due date is required'),
  leadId: z.string().trim().optional().nullable().or(z.literal('')),
});

// GET /api/tasks
apiRouter.get('/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { filter = 'all' } = req.query;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const where: Prisma.TaskWhereInput = { userId };

    if (filter === 'overdue') {
      where.status = TaskStatus.PENDING;
      where.dueAt = { lt: now };
    } else if (filter === 'today') {
      where.status = TaskStatus.PENDING;
      where.dueAt = { gte: startOfToday, lte: endOfToday };
    } else if (filter === 'upcoming') {
      where.status = TaskStatus.PENDING;
      where.dueAt = { gt: endOfToday };
    } else if (filter === 'completed') {
      where.status = TaskStatus.COMPLETED;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { dueAt: 'asc' },
      ],
      include: {
        lead: {
          select: { id: true, name: true, company: true, stage: true },
        },
      },
    });

    // Counts for tabs/badges
    const [overdueCount, todayCount, upcomingCount, completedCount] = await Promise.all([
      prisma.task.count({ where: { userId, status: TaskStatus.PENDING, dueAt: { lt: now } } }),
      prisma.task.count({ where: { userId, status: TaskStatus.PENDING, dueAt: { gte: startOfToday, lte: endOfToday } } }),
      prisma.task.count({ where: { userId, status: TaskStatus.PENDING, dueAt: { gt: endOfToday } } }),
      prisma.task.count({ where: { userId, status: TaskStatus.COMPLETED } }),
    ]);

    return res.json({
      tasks,
      counts: {
        overdue: overdueCount,
        today: todayCount,
        upcoming: upcomingCount,
        completed: completedCount,
        totalOpen: overdueCount + todayCount + upcomingCount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/tasks
apiRouter.post('/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const parseResult = taskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors });
    }

    const data = parseResult.data;
    const leadId = data.leadId && data.leadId !== '' ? data.leadId : null;

    if (leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead || lead.userId !== userId) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Linked lead not found' });
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          userId,
          leadId,
          title: data.title,
          description: data.description || null,
          dueAt: new Date(data.dueAt),
          status: TaskStatus.PENDING,
        },
        include: {
          lead: { select: { id: true, name: true, company: true } },
        },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId,
          actorRole: req.user!.role,
          action: 'task.created',
          details: { title: created.title, dueAt: created.dueAt },
        },
      });

      if (leadId) {
        await syncLeadNextFollowUp(leadId, tx);
      }

      return created;
    });

    return res.status(201).json(task);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/tasks/:id/complete
apiRouter.post('/tasks/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resTask = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: task.leadId,
          actorRole: req.user!.role,
          action: 'task.completed',
          details: { title: task.title },
        },
      });

      if (task.leadId) {
        await syncLeadNextFollowUp(task.leadId, tx);
      }

      return resTask;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/tasks/:id/reopen
apiRouter.post('/tasks/:id/reopen', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resTask = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.PENDING,
          completedAt: null,
        },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: task.leadId,
          actorRole: req.user!.role,
          action: 'task.reopened',
          details: { title: task.title },
        },
      });

      if (task.leadId) {
        await syncLeadNextFollowUp(task.leadId, tx);
      }

      return resTask;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/tasks/:id/cancel
apiRouter.post('/tasks/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resTask = await tx.task.update({
        where: { id },
        data: { status: TaskStatus.CANCELLED },
      });

      await tx.activity.create({
        data: {
          userId,
          leadId: task.leadId,
          actorRole: req.user!.role,
          action: 'task.cancelled',
          details: { title: task.title },
        },
      });

      if (task.leadId) {
        await syncLeadNextFollowUp(task.leadId, tx);
      }

      return resTask;
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// DELETE /api/tasks/:id
apiRouter.delete('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id } });
      if (task.leadId) {
        await syncLeadNextFollowUp(task.leadId, tx);
      }
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ==========================================
// DASHBOARD & REPORTS (AGGREGATED SQL)
// ==========================================

apiRouter.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Active leads — count of non-archived leads not in Won/Lost
    const activeLeadsCount = await prisma.lead.count({
      where: {
        userId,
        archivedAt: null,
        stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
      },
    });

    // 2. Follow-ups due today
    const followUpsDueTodayCount = await prisma.task.count({
      where: {
        userId,
        status: TaskStatus.PENDING,
        dueAt: { gte: startOfToday, lte: endOfToday },
      },
    });

    // 3. Overdue follow-ups
    const overdueFollowUpsCount = await prisma.task.count({
      where: {
        userId,
        status: TaskStatus.PENDING,
        dueAt: { lt: now },
      },
    });

    // 4. Proposals awaiting response:
    // leads in PROPOSAL_SENT with no interaction of type incoming recorded after the proposal
    const proposalLeads = await prisma.lead.findMany({
      where: {
        userId,
        archivedAt: null,
        stage: LeadStage.PROPOSAL_SENT,
      },
      include: {
        interactions: {
          orderBy: { occurredAt: 'desc' },
        },
      },
    });

    const proposalsAwaitingCount = proposalLeads.filter((lead) => {
      const proposalInteraction = lead.interactions.find((i) => i.outcome === 'Proposal sent' || i.notes?.toLowerCase().includes('proposal'));
      const proposalTime = proposalInteraction ? proposalInteraction.occurredAt.getTime() : lead.createdAt.getTime();
      const incomingAfterProposal = lead.interactions.some((i) => i.direction === Direction.INCOMING && i.occurredAt.getTime() > proposalTime);
      return !incomingAfterProposal;
    }).length;

    // 5. Won deals + recorded revenue: count and sum of wonValue
    const wonAggregate = await prisma.lead.aggregate({
      where: {
        userId,
        stage: LeadStage.WON,
      },
      _count: { id: true },
      _sum: { wonValue: true },
    });

    // Pipeline stage breakdown for snapshot
    const stageCounts = await prisma.lead.groupBy({
      by: ['stage'],
      where: {
        userId,
        archivedAt: null,
      },
      _count: { id: true },
      _sum: { potentialValue: true },
    });

    // Compact today's + overdue tasks (max 8)
    const todayFollowUps = await prisma.task.findMany({
      where: {
        userId,
        status: TaskStatus.PENDING,
        dueAt: { lte: endOfToday },
      },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: {
        lead: { select: { id: true, name: true, company: true } },
      },
    });

    // Recent activity (last 10 activities)
    const recentActivity = await prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        lead: { select: { id: true, name: true } },
      },
    });

    return res.json({
      stats: {
        activeLeads: activeLeadsCount,
        followUpsDueToday: followUpsDueTodayCount,
        overdueFollowUps: overdueFollowUpsCount,
        proposalsAwaitingResponse: proposalsAwaitingCount,
        wonDealsCount: wonAggregate._count.id || 0,
        recordedRevenue: Number(wonAggregate._sum.wonValue || 0),
        bellCount: followUpsDueTodayCount + overdueFollowUpsCount,
      },
      todayFollowUps,
      pipelineSnapshot: stageCounts.map((s) => ({
        stage: s.stage,
        count: s._count.id,
        potentialValue: Number(s._sum.potentialValue || 0),
      })),
      recentActivity,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// GET /api/reports
apiRouter.get('/reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [allLeads, wonAggregate, lostAggregate] = await Promise.all([
      prisma.lead.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          source: true,
          stage: true,
          potentialValue: true,
          wonValue: true,
          outcomeReason: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.lead.aggregate({
        where: { userId, stage: LeadStage.WON },
        _count: { id: true },
        _sum: { wonValue: true },
        _avg: { wonValue: true },
      }),
      prisma.lead.aggregate({
        where: { userId, stage: LeadStage.LOST },
        _count: { id: true },
      }),
    ]);

    const wonCount = wonAggregate._count.id || 0;
    const lostCount = lostAggregate._count.id || 0;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;

    // Group by source
    const bySourceMap: Record<string, { total: number; won: number; wonRevenue: number }> = {};
    for (const lead of allLeads) {
      if (!bySourceMap[lead.source]) {
        bySourceMap[lead.source] = { total: 0, won: 0, wonRevenue: 0 };
      }
      bySourceMap[lead.source].total += 1;
      if (lead.stage === LeadStage.WON) {
        bySourceMap[lead.source].won += 1;
        bySourceMap[lead.source].wonRevenue += Number(lead.wonValue || 0);
      }
    }

    return res.json({
      summary: {
        totalLeads: allLeads.length,
        wonDeals: wonCount,
        lostDeals: lostCount,
        winRate: Math.round(winRate),
        totalWonRevenue: Number(wonAggregate._sum.wonValue || 0),
        avgDealSize: Number(wonAggregate._avg.wonValue || 0),
      },
      bySource: Object.entries(bySourceMap).map(([source, stats]) => ({
        source,
        total: stats.total,
        won: stats.won,
        conversionRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
        revenue: stats.wonRevenue,
      })),
      recentWon: allLeads.filter((l) => l.stage === LeadStage.WON).slice(0, 5),
      recentLost: allLeads.filter((l) => l.stage === LeadStage.LOST).slice(0, 5),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ==========================================
// SETTINGS ROUTES
// ==========================================

apiRouter.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        role: true,
        preferences: true,
        createdAt: true,
      },
    });

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.patch('/settings/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, timezone, currency, dateFormat } = req.body;

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const currentPrefs = (existing.preferences as any) || {};
    const updatedPrefs = {
      ...currentPrefs,
      currency: currency || currentPrefs.currency || 'USD',
      dateFormat: dateFormat || currentPrefs.dateFormat || 'MM/DD/YYYY',
    };

    const updated = await prisma.$transaction(async (tx) => {
      const resUser = await tx.user.update({
        where: { id: userId },
        data: {
          name: name ? name.trim() : existing.name,
          timezone: timezone || existing.timezone,
          preferences: updatedPrefs,
        },
      });

      await tx.activity.create({
        data: {
          userId,
          actorRole: existing.role,
          action: 'profile.updated',
          details: { name, timezone, currency, dateFormat },
        },
      });

      return resUser;
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      timezone: updated.timezone,
      preferences: updated.preferences,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.post('/settings/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Current and new password are required' });
    }

    if (newPassword.length < 10 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'New password must be at least 10 characters and contain letters and numbers.',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const isMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'INCORRECT_PASSWORD', message: 'Incorrect current password.' });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      // Log only password.changed with no sensitive details as instructed
      prisma.activity.create({
        data: {
          userId,
          actorRole: user.role,
          action: 'password.changed',
        },
      }),
    ]);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.patch('/settings/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hideTerminalStages, defaultStage, stageOrder } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });

    const currentPrefs = (user.preferences as any) || {};
    const updatedPrefs = {
      ...currentPrefs,
      hideTerminalStages: hideTerminalStages !== undefined ? Boolean(hideTerminalStages) : currentPrefs.hideTerminalStages,
      defaultStage: defaultStage || currentPrefs.defaultStage || 'IDENTIFIED',
      stageOrder: stageOrder || currentPrefs.stageOrder,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const resUser = await tx.user.update({
        where: { id: userId },
        data: { preferences: updatedPrefs },
      });

      await tx.activity.create({
        data: {
          userId,
          actorRole: user.role,
          action: 'preferences.updated',
          details: { hideTerminalStages, defaultStage },
        },
      });

      return resUser;
    });

    return res.json(updated.preferences);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// GET /api/settings/export (CSV / JSON export)
apiRouter.get('/settings/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const [leads, tasks, interactions, activities] = await Promise.all([
      prisma.lead.findMany({ where: { userId } }),
      prisma.task.findMany({ where: { userId } }),
      prisma.interaction.findMany({ where: { userId } }),
      prisma.activity.findMany({ where: { userId } }),
    ]);

    if (format === 'csv') {
      // Export Leads as CSV
      const headers = ['id', 'name', 'company', 'email', 'phone', 'stage', 'potentialValue', 'wonValue', 'source', 'service', 'createdAt'];
      const rows = leads.map((l) => [
        l.id,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        l.email || '',
        l.phone || '',
        l.stage,
        l.potentialValue ? Number(l.potentialValue) : '',
        l.wonValue ? Number(l.wonValue) : '',
        l.source,
        `"${(l.service || '').replace(/"/g, '""')}"`,
        l.createdAt.toISOString(),
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="emperor-crm-export.csv"');
      return res.send(csvContent);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="emperor-crm-export.json"');
    return res.json({
      exportDate: new Date().toISOString(),
      user: { id: req.user!.id, email: req.user!.email },
      leads,
      tasks,
      interactions,
      activities,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// POST /api/settings/delete-account (Danger zone)
apiRouter.post('/settings/delete-account', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { confirmation, password } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'CONFIRMATION_MISMATCH', message: 'You must type "DELETE" to confirm account deletion.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'INCORRECT_PASSWORD', message: 'Incorrect password entered.' });
    }

    // Cascade delete on user removes leads, tasks, interactions, activities, grants, tokens
    await prisma.user.delete({ where: { id: userId } });

    res.clearCookie('emperor_session');
    return res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ==========================================
// ADMIN & OPERATOR AUDIT ROUTES
// Returns 404 for freelancers as requested:
// "Admin routes (/admin/**) require role ADMIN or OPERATOR; otherwise 404 (not 403, to avoid revealing the route)"
// ==========================================

apiRouter.get('/admin/users', requireAuth, requireAdminOrOperator, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        timezone: true,
        createdAt: true,
        _count: {
          select: {
            leads: true,
            tasks: true,
            activities: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.get('/admin/access', requireAuth, requireAdminOrOperator, async (_req: Request, res: Response) => {
  try {
    const grants = await prisma.supportAccessGrant.findMany({
      include: {
        subjectUser: { select: { id: true, name: true, email: true } },
        grantedToUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(grants);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

apiRouter.get('/admin/audit', requireAuth, requireAdminOrOperator, async (_req: Request, res: Response) => {
  try {
    const activities = await prisma.activity.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        lead: { select: { id: true, name: true } },
      },
    });

    return res.json(activities);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});
