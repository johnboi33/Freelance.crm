export type Role = 'FREELANCER' | 'ADMIN' | 'OPERATOR';

export type LeadStage =
  | 'IDENTIFIED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'MEETING'
  | 'PROPOSAL_SENT'
  | 'WON'
  | 'LOST';

export type InteractionType = 'EMAIL' | 'CALL' | 'MESSAGE' | 'MEETING' | 'OTHER';

export type Direction = 'OUTGOING' | 'INCOMING';

export type TaskStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export type GrantStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DENIED';

export interface UserPreferences {
  currency?: string;
  dateFormat?: string;
  defaultStage?: LeadStage;
  hideTerminalStages?: boolean;
  stageOrder?: LeadStage[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  preferences?: UserPreferences;
}

export interface Lead {
  id: string;
  userId: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  source: string;
  service: string;
  stage: LeadStage;
  potentialValue?: number | string | null;
  currency?: string;
  nextFollowUp?: string | null;
  notes?: string | null;
  outcomeReason?: string | null;
  wonValue?: number | string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    interactions: number;
    tasks: number;
  };
}

export interface Interaction {
  id: string;
  leadId: string;
  userId: string;
  type: InteractionType;
  direction: Direction;
  outcome?: string | null;
  notes?: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  leadId?: string | null;
  title: string;
  description?: string | null;
  dueAt: string;
  status: TaskStatus;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    name: string;
    company?: string | null;
    stage?: LeadStage;
  } | null;
}

export interface Activity {
  id: string;
  userId: string;
  leadId?: string | null;
  actorRole: Role;
  action: string;
  details?: any;
  createdAt: string;
  lead?: {
    id: string;
    name: string;
  } | null;
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
}

export interface DashboardStats {
  activeLeads: number;
  followUpsDueToday: number;
  overdueFollowUps: number;
  proposalsAwaitingResponse: number;
  wonDealsCount: number;
  recordedRevenue: number;
  bellCount: number;
}

export interface PipelineSnapshotStage {
  stage: LeadStage;
  count: number;
  potentialValue: number;
}
