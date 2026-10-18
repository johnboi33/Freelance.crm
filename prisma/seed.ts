import { PrismaClient, Role, LeadStage, InteractionType, Direction, TaskStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Emperor CRM v1 database...');

  // Ensure database clean-up in correct relation order
  await prisma.activity.deleteMany({});
  await prisma.interaction.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.supportAccessGrant.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.user.deleteMany({});

  const defaultPassword = 'Password123!';
  const passwordHash = await argon2.hash(defaultPassword, {
    type: argon2.argon2id,
  });

  // 1. Create demo freelancer user
  const freelancer = await prisma.user.create({
    data: {
      name: 'Elena Rostova',
      email: 'demo@emperorcrm.test',
      passwordHash,
      timezone: 'America/New_York',
      role: Role.FREELANCER,
      emailVerifiedAt: new Date('2026-01-15T10:00:00Z'),
      preferences: {
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        defaultStage: 'IDENTIFIED',
        hideTerminalStages: false,
      },
    },
  });

  // 5. Create an admin user
  const admin = await prisma.user.create({
    data: {
      name: 'Marcus Vance',
      email: 'admin@emperorcrm.test',
      passwordHash,
      timezone: 'UTC',
      role: Role.ADMIN,
      emailVerifiedAt: new Date('2026-01-01T08:00:00Z'),
      preferences: {
        currency: 'USD',
        dateFormat: 'YYYY-MM-DD',
        defaultStage: 'IDENTIFIED',
        hideTerminalStages: false,
      },
    },
  });

  // Also create an operator for support consent testing
  const operator = await prisma.user.create({
    data: {
      name: 'Sarah Chen',
      email: 'operator@emperorcrm.test',
      passwordHash,
      timezone: 'Europe/London',
      role: Role.OPERATOR,
      emailVerifiedAt: new Date('2026-02-01T09:00:00Z'),
    },
  });

  console.log(`Created users: Demo Freelancer (${freelancer.id}), Admin (${admin.id}), Operator (${operator.id})`);

  // Today reference dates
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);

  // 2. Create 12 leads spread across every stage, 4 sources, varied potentialValue, some archived
  // Stages: IDENTIFIED, CONTACTED, REPLIED, MEETING, PROPOSAL_SENT, WON, LOST
  // 4 sources: Referral, LinkedIn, Website, Cold Outreach
  const leadDefinitions = [
    {
      name: 'Aether Robotics',
      company: 'Aether Autonomous Systems',
      email: 'procurement@aether-robotics.io',
      phone: '+1 415 890 1204',
      website: 'https://aether-robotics.io',
      source: 'Referral',
      service: 'Full-Stack Architecture & Telemetry Dashboard',
      stage: LeadStage.IDENTIFIED,
      potentialValue: 24000.00,
      currency: 'USD',
      nextFollowUp: new Date(Date.now() + 86400000 * 3), // +3 days
      notes: 'Referred by Julian at Stripe. Looking for high-throughput React dashboard with WebSockets.',
    },
    {
      name: 'Vanguard Biometrics',
      company: 'Vanguard Cyber Security',
      email: 'kevin.stuart@vanguardbio.com',
      phone: '+1 617 334 9901',
      website: 'https://vanguardbio.com',
      source: 'Cold Outreach',
      service: 'SOC2 Compliance & Auth Security Overhaul',
      stage: LeadStage.CONTACTED,
      potentialValue: 18500.00,
      currency: 'USD',
      nextFollowUp: new Date(Date.now() - 86400000 * 2), // 2 days overdue
      notes: 'Initial cold outreach sent regarding OAuth2 and cryptographic session architecture.',
    },
    {
      name: 'Hyperion Logistics',
      company: 'Hyperion Global Freight',
      email: 'miranda@hyperioncargo.com',
      phone: '+1 312 902 4432',
      website: 'https://hyperioncargo.com',
      source: 'LinkedIn',
      service: 'Fleet Tracking & Route Optimization Engine',
      stage: LeadStage.REPLIED,
      potentialValue: 36000.00,
      currency: 'USD',
      nextFollowUp: todayDateOnly, // Due today
      notes: 'Replied positively to message. Expressed urgency due to legacy system deprecation.',
    },
    {
      name: 'Kallisto Diagnostics',
      company: 'Kallisto Health Labs',
      email: 'claire@kallistolabs.org',
      phone: '+1 206 555 7712',
      website: 'https://kallistolabs.org',
      source: 'Website',
      service: 'HIPAA-Compliant Patient Portal',
      stage: LeadStage.MEETING,
      potentialValue: 42000.00,
      currency: 'USD',
      nextFollowUp: new Date(Date.now() + 86400000 * 1), // tomorrow
      notes: 'Discovery call scheduled for 2pm EST. Focused on audit logging and data residency.',
    },
    {
      name: 'Solaria Solar',
      company: 'Solaria Energy Systems',
      email: 'david.b@solariaenergy.tech',
      phone: '+1 512 884 1928',
      website: 'https://solariaenergy.tech',
      source: 'Referral',
      service: 'Commercial Solar Quotation Web Engine',
      stage: LeadStage.PROPOSAL_SENT,
      potentialValue: 28500.00,
      currency: 'USD',
      nextFollowUp: new Date(Date.now() - 86400000 * 1), // 1 day overdue
      notes: 'Formal proposal sent. Scope: 6-week turnaround with payment milestone schedule.',
    },
    {
      name: 'Apex Precision Tools',
      company: 'Apex Industrial Robotics',
      email: 'h.schmidt@apexindustrial.de',
      phone: '+49 89 2314 9081',
      website: 'https://apexindustrial.de',
      source: 'Website',
      service: 'SCADA Interface & Component Catalog',
      stage: LeadStage.WON,
      potentialValue: 55000.00,
      currency: 'USD',
      wonValue: 55000.00,
      nextFollowUp: null,
      notes: 'Signed contract and deposit wire received. Commencing milestone 1 design review.',
    },
    {
      name: 'Zenith Retail Platform',
      company: 'Zenith Omnichannel Inc',
      email: 'alex@zenithretail.co',
      phone: '+1 415 772 9011',
      website: 'https://zenithretail.co',
      source: 'Cold Outreach',
      service: 'Headless Checkout Modernization',
      stage: LeadStage.LOST,
      potentialValue: 30000.00,
      currency: 'USD',
      outcomeReason: 'Decided to stay with Shopify Plus in-house team due to budget freeze.',
      nextFollowUp: null,
      notes: 'Budget cancelled by leadership; follow up in Q4.',
    },
    {
      name: 'Orion FinTech',
      company: 'Orion Wealth Analytics',
      email: 'tarik@orionfintech.capital',
      phone: '+44 20 7946 0192',
      website: 'https://orionfintech.capital',
      source: 'LinkedIn',
      service: 'Portfolio Risk Monte Carlo Visualizer',
      stage: LeadStage.PROPOSAL_SENT,
      potentialValue: 48000.00,
      currency: 'USD',
      nextFollowUp: todayDateOnly, // Due today
      notes: 'Board reviewing RFP response this Wednesday.',
    },
    {
      name: 'Pinnacle Aerospace',
      company: 'Pinnacle Composites Ltd',
      email: 'contracts@pinnacleaero.co.uk',
      phone: '+44 117 496 0883',
      website: 'https://pinnacleaero.co.uk',
      source: 'Referral',
      service: 'Material Certification Tracking System',
      stage: LeadStage.CONTACTED,
      potentialValue: 34000.00,
      currency: 'USD',
      nextFollowUp: new Date(Date.now() + 86400000 * 5),
      notes: 'Emailed VP Engineering following aviation conference.',
    },
    {
      name: 'Nova Biosystems',
      company: 'Nova Genomics Research',
      email: 'inquiries@novabio.science',
      phone: '+1 650 338 1290',
      website: 'https://novabio.science',
      source: 'Website',
      service: 'Variant Analysis Pipeline Web Client',
      stage: LeadStage.IDENTIFIED,
      potentialValue: 22000.00,
      currency: 'USD',
      nextFollowUp: new Date(Date.now() + 86400000 * 7),
      notes: 'Discovered through bio-tech accelerator announcement.',
    },
    // Archived Leads (some archived)
    {
      name: 'Starlight Media',
      company: 'Starlight Interactive',
      email: 'greg@starlightinteractive.tv',
      phone: '+1 310 449 8102',
      website: 'https://starlightinteractive.tv',
      source: 'Cold Outreach',
      service: 'Streaming Asset Management CMS',
      stage: LeadStage.CONTACTED,
      potentialValue: 15000.00,
      currency: 'USD',
      archivedAt: new Date(Date.now() - 86400000 * 14),
      nextFollowUp: null,
      notes: 'Archived due to company reorganization and unresponsiveness.',
    },
    {
      name: 'Beacon Maritime Corp',
      company: 'Beacon Marine Instruments',
      email: 'ops@beaconmaritime.no',
      phone: '+47 22 83 90 00',
      website: 'https://beaconmaritime.no',
      source: 'Referral',
      service: 'Vessel Telemetry GPS Ingestion',
      stage: LeadStage.LOST,
      potentialValue: 26000.00,
      currency: 'USD',
      outcomeReason: 'Project cancelled after supplier merger.',
      archivedAt: new Date(Date.now() - 86400000 * 30),
      nextFollowUp: null,
      notes: 'Archived legacy prospect from last quarter.',
    },
  ];

  const createdLeads = [];
  for (const def of leadDefinitions) {
    const lead = await prisma.lead.create({
      data: {
        userId: freelancer.id,
        ...def,
      },
    });
    createdLeads.push(lead);

    // Write initial lead.created activity
    await prisma.activity.create({
      data: {
        userId: freelancer.id,
        leadId: lead.id,
        actorRole: Role.FREELANCER,
        action: 'lead.created',
        details: {
          name: lead.name,
          stage: lead.stage,
          potentialValue: lead.potentialValue ? Number(lead.potentialValue) : null,
          source: lead.source,
        },
        createdAt: lead.createdAt,
      },
    });
  }

  console.log(`Created ${createdLeads.length} leads across all stages.`);

  // 3. Create interactions for the leads (at least 3 leads with 5+ interactions to prove the timeline)
  // Let's pick Lead 0 (Aether Robotics), Lead 2 (Hyperion Logistics), Lead 4 (Solaria Solar)
  // Lead 0: Aether Robotics (6 interactions)
  const aetherInteractions = [
    {
      type: InteractionType.EMAIL,
      direction: Direction.OUTGOING,
      outcome: 'Replied',
      notes: 'Sent introductory portfolio and reference architecture overview.',
      occurredAt: new Date(Date.now() - 86400000 * 20),
    },
    {
      type: InteractionType.EMAIL,
      direction: Direction.INCOMING,
      outcome: 'Replied',
      notes: 'VP of Product replied requesting technical references from similar IoT projects.',
      occurredAt: new Date(Date.now() - 86400000 * 18),
    },
    {
      type: InteractionType.CALL,
      direction: Direction.OUTGOING,
      outcome: 'Meeting booked',
      notes: '15-min discovery phone call with Lead Architect to clarify tech stack (React + Go).',
      occurredAt: new Date(Date.now() - 86400000 * 14),
    },
    {
      type: InteractionType.MEETING,
      direction: Direction.INCOMING,
      outcome: 'Replied',
      notes: 'Technical discovery session over Zoom with team. Walked through system diagrams.',
      occurredAt: new Date(Date.now() - 86400000 * 9),
    },
    {
      type: InteractionType.MESSAGE,
      direction: Direction.OUTGOING,
      outcome: 'Replied',
      notes: 'Slack message sharing benchmark latency metrics and sandbox repository.',
      occurredAt: new Date(Date.now() - 86400000 * 5),
    },
    {
      type: InteractionType.EMAIL,
      direction: Direction.OUTGOING,
      outcome: 'Proposal sent',
      notes: 'Sent preliminary statement of work and deliverables schedule.',
      occurredAt: new Date(Date.now() - 86400000 * 2),
    },
  ];

  for (const item of aetherInteractions) {
    await prisma.interaction.create({
      data: {
        leadId: createdLeads[0].id,
        userId: freelancer.id,
        ...item,
      },
    });
  }

  // Lead 2: Hyperion Logistics (5 interactions)
  const hyperionInteractions = [
    {
      type: InteractionType.MESSAGE,
      direction: Direction.OUTGOING,
      outcome: 'No response',
      notes: 'LinkedIn InMail about logistics route dashboard automation.',
      occurredAt: new Date(Date.now() - 86400000 * 25),
    },
    {
      type: InteractionType.MESSAGE,
      direction: Direction.INCOMING,
      outcome: 'Replied',
      notes: 'Miranda from Hyperion responded saying they are actively looking to replace their GPS tracker.',
      occurredAt: new Date(Date.now() - 86400000 * 16),
    },
    {
      type: InteractionType.EMAIL,
      direction: Direction.OUTGOING,
      outcome: 'Meeting booked',
      notes: 'Sent calendar link for discovery meeting.',
      occurredAt: new Date(Date.now() - 86400000 * 12),
    },
    {
      type: InteractionType.MEETING,
      direction: Direction.OUTGOING,
      outcome: 'Meeting booked',
      notes: 'Discovery call held. Discussed real-time fleet map rendering and WebSocket load.',
      occurredAt: new Date(Date.now() - 86400000 * 6),
    },
    {
      type: InteractionType.CALL,
      direction: Direction.INCOMING,
      outcome: 'Replied',
      notes: 'Quick check-in on integration feasibility with their legacy Oracle database.',
      occurredAt: new Date(Date.now() - 86400000 * 1),
    },
  ];

  for (const item of hyperionInteractions) {
    await prisma.interaction.create({
      data: {
        leadId: createdLeads[2].id,
        userId: freelancer.id,
        ...item,
      },
    });
  }

  // Lead 4: Solaria Solar (6 interactions)
  const solariaInteractions = [
    {
      type: InteractionType.EMAIL,
      direction: Direction.INCOMING,
      outcome: 'Replied',
      notes: 'Inbound referral from Julian requesting quote configuration engine.',
      occurredAt: new Date(Date.now() - 86400000 * 22),
    },
    {
      type: InteractionType.CALL,
      direction: Direction.OUTGOING,
      outcome: 'Meeting booked',
      notes: 'Brief phone alignment on required panel irradiance calculations.',
      occurredAt: new Date(Date.now() - 86400000 * 19),
    },
    {
      type: InteractionType.MEETING,
      direction: Direction.OUTGOING,
      outcome: 'Meeting booked',
      notes: 'Deep-dive scoping workshop with David B. and engineering lead.',
      occurredAt: new Date(Date.now() - 86400000 * 13),
    },
    {
      type: InteractionType.MESSAGE,
      direction: Direction.OUTGOING,
      outcome: 'Replied',
      notes: 'Provided breakdown of third-party solar geometry API costs.',
      occurredAt: new Date(Date.now() - 86400000 * 8),
    },
    {
      type: InteractionType.EMAIL,
      direction: Direction.OUTGOING,
      outcome: 'Proposal sent',
      notes: 'Submitted comprehensive $28,500 proposal with milestones.',
      occurredAt: new Date(Date.now() - 86400000 * 4),
    },
    {
      type: InteractionType.CALL,
      direction: Direction.OUTGOING,
      outcome: 'No response',
      notes: 'Followed up via telephone to check if procurement had questions.',
      occurredAt: new Date(Date.now() - 86400000 * 1),
    },
  ];

  for (const item of solariaInteractions) {
    await prisma.interaction.create({
      data: {
        leadId: createdLeads[4].id,
        userId: freelancer.id,
        ...item,
      },
    });
  }

  // Also add some interactions for other leads
  await prisma.interaction.create({
    data: {
      leadId: createdLeads[5].id, // Apex (Won)
      userId: freelancer.id,
      type: InteractionType.MEETING,
      direction: Direction.INCOMING,
      outcome: 'Proposal sent',
      notes: 'Final contract signing and kickoff call scheduled.',
      occurredAt: new Date(Date.now() - 86400000 * 3),
    },
  });

  console.log('Seeded interactions for multiple leads with full timeline depth.');

  // 4. Create tasks: 3 overdue, 2 due today, 4 upcoming, 2 completed
  const taskDefinitions = [
    // 3 Overdue (status PENDING && dueAt < now)
    {
      title: 'Send security compliance checklist to Vanguard Biometrics',
      description: 'Detailing SOC2 Type II controls and encrypted credential storage.',
      dueAt: new Date(Date.now() - 86400000 * 3), // 3 days overdue
      status: TaskStatus.PENDING,
      leadId: createdLeads[1].id,
    },
    {
      title: 'Follow up on Solaria Solar proposal status',
      description: 'Check in with David regarding committee signoff.',
      dueAt: new Date(Date.now() - 86400000 * 1.5), // 1.5 days overdue
      status: TaskStatus.PENDING,
      leadId: createdLeads[4].id,
    },
    {
      title: 'Prepare quarterly tax estimates for software freelance income',
      description: 'Reconcile invoice receipts from Stripe & bank statements.',
      dueAt: new Date(Date.now() - 86400000 * 2), // 2 days overdue
      status: TaskStatus.PENDING,
      leadId: null, // standalone task
    },

    // 2 Due Today (status PENDING && dueAt is today)
    {
      title: 'Review Hyperion Logistics API documentation & specs',
      description: 'Inspect their REST endpoint payload samples before the 2pm sync.',
      dueAt: new Date(todayDateOnly.getTime() + 1000 * 60 * 60 * 5), // Today 14:00
      status: TaskStatus.PENDING,
      leadId: createdLeads[2].id,
    },
    {
      title: 'Follow up with Orion FinTech board review',
      description: 'Send brief polite check-in note to Tarik.',
      dueAt: new Date(todayDateOnly.getTime() + 1000 * 60 * 60 * 7), // Today 16:00
      status: TaskStatus.PENDING,
      leadId: createdLeads[7].id,
    },

    // 4 Upcoming (status PENDING && dueAt > today)
    {
      title: 'Kallisto Diagnostics discovery call preparation',
      description: 'Prepare demo slide deck on HIPAA audit trail implementation.',
      dueAt: new Date(Date.now() + 86400000 * 1), // Tomorrow
      status: TaskStatus.PENDING,
      leadId: createdLeads[3].id,
    },
    {
      title: 'Draft technical architecture diagram for Aether Robotics',
      description: 'Include WebSocket cluster topology and fallback long-polling mechanism.',
      dueAt: new Date(Date.now() + 86400000 * 3), // +3 days
      status: TaskStatus.PENDING,
      leadId: createdLeads[0].id,
    },
    {
      title: 'Send cold outreach batch to 5 aerospace component suppliers',
      description: 'Target VP of Operations using LinkedIn InMail.',
      dueAt: new Date(Date.now() + 86400000 * 5), // +5 days
      status: TaskStatus.PENDING,
      leadId: null,
    },
    {
      title: 'Follow up with Pinnacle Aerospace VP of Engineering',
      description: 'Check if they reviewed the material traceability case study.',
      dueAt: new Date(Date.now() + 86400000 * 6), // +6 days
      status: TaskStatus.PENDING,
      leadId: createdLeads[8].id,
    },

    // 2 Completed (status COMPLETED, completedAt set)
    {
      title: 'Initial scoping consultation with Apex Precision Tools',
      description: 'Gathered requirements for SCADA catalog interface.',
      dueAt: new Date(Date.now() - 86400000 * 10),
      status: TaskStatus.COMPLETED,
      completedAt: new Date(Date.now() - 86400000 * 9),
      leadId: createdLeads[5].id,
    },
    {
      title: 'Send customized contract agreement to Apex Precision Tools',
      description: 'Standard master services agreement with 50% upfront retainer.',
      dueAt: new Date(Date.now() - 86400000 * 5),
      status: TaskStatus.COMPLETED,
      completedAt: new Date(Date.now() - 86400000 * 4),
      leadId: createdLeads[5].id,
    },
  ];

  for (const t of taskDefinitions) {
    await prisma.task.create({
      data: {
        userId: freelancer.id,
        ...t,
      },
    });
  }

  console.log(`Created ${taskDefinitions.length} tasks (3 overdue, 2 due today, 4 upcoming, 2 completed).`);

  // Add support access grant for testing support/admin consent model
  await prisma.supportAccessGrant.create({
    data: {
      subjectUserId: freelancer.id,
      grantedToUserId: operator.id,
      reason: 'Diagnosing sync delay between lead timeline and task notifications.',
      scope: 'READ_ONLY',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000 * 2), // 2 days active
      approvedAt: new Date(Date.now() - 86400000 * 1),
    },
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
