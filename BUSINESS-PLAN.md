# molt Business Plan & Daily Workflow Optimization

**Date:** June 24, 2026  
**Status:** Strategy Document  
**Goal:** Make molt a $10M ARR business  

---

## Part 1: Custom Model Router (Cost Optimization)

### The Problem
- Sonnet 4: $3 per 1M input tokens, $15 per 1M output
- Average task: 50K tokens = $0.75
- Heavy users: 100 tasks/month = $75
- **Too expensive for daily use**

### The Solution: Smart Model Router

Route tasks to the cheapest model that can handle them:

| Model | Cost | Speed | Use Case |
|-------|------|-------|----------|
| Claude Haiku | $0.25/$1.25 | 5x faster | Simple tasks, planning, exploration |
| Claude Sonnet 3.5 | $3/$15 | Fast | Most coding tasks |
| Claude Sonnet 4 | $3/$15 | Baseline | Complex logic, architecture |
| Claude Opus | $15/$75 | Slowest | Critical production code |
| Local (Qwen 2.5 Coder) | Free | Fast | Offline, privacy |

**Cost Savings: 70-80% by routing intelligently**

### Task Classification

```typescript
// Classify task complexity → route to right model
enum TaskComplexity {
  TRIVIAL,    // Haiku (read file, check status, simple questions)
  SIMPLE,     // Haiku (small edits, docs, comments)
  MODERATE,   // Sonnet 3.5 (features, refactors, tests)
  COMPLEX,    // Sonnet 4 (architecture, complex algorithms)
  CRITICAL,   // Opus (security, money handling, prod deploy)
}

function classifyTask(prompt: string, context: Context): TaskComplexity {
  // Use fast local model or regex patterns
  if (prompt.includes('read') || prompt.includes('show')) return TRIVIAL;
  if (prompt.includes('comment') || prompt.includes('doc')) return SIMPLE;
  if (prompt.includes('security') || prompt.includes('payment')) return CRITICAL;
  // Default to moderate
  return MODERATE;
}
```

### Adaptive Routing

```typescript
// Start with cheaper model, escalate if needed
async function executeWithRouting(task: Task): Promise<Result> {
  let model = routeModel(task.complexity);
  let result = await execute(task, model);
  
  // If model says "I need help" or fails, escalate
  if (result.needsEscalation || result.failed) {
    model = escalateModel(model);
    result = await execute(task, model);
  }
  
  // Track success rate per model per task type
  trackModelPerformance(model, task.type, result.success);
  
  return result;
}
```

### Business Value
- **User savings: $50/month → $10/month** (5x cheaper)
- **More usage:** Lower cost = higher frequency
- **Competitive moat:** Others don't have this optimization

---

## Part 2: IDE Integration (VS Code Extension)

### Why This Matters
- Developers live in their IDE, not terminal
- See file changes in real-time
- Inline diffs, not just terminal output
- Multi-cursor editing support

### VS Code Extension Architecture

```
molt-vscode/
├── extension.ts          # VS Code extension entry
├── client/
│   ├── mollPanel.ts      # Webview panel UI
│   ├── diffPreview.ts    # Inline diff viewer
│   └── statusBar.ts      # Cost/status indicator
├── server/
│   ├── langServer.ts     # LSP server for completions
│   └── mollRpc.ts        # RPC to molt agent
└── package.json          # VS Code extension manifest
```

**Features:**
- Chat panel in sidebar (like Cursor)
- Inline diff preview before applying
- File tree with "molt generated" badges
- Status bar: cost counter, active model
- Keyboard shortcuts: Cmd+K for quick prompt
- Multi-file selection: "molt, refactor these 3 files"

### Key Differentiators vs Cursor/Copilot
1. **Transparent cost tracking** - see $ per request
2. **Model selection** - choose Haiku vs Sonnet per task
3. **Approval system** - preview before apply
4. **Knowledge learning** - remembers your patterns
5. **Local-first** - works offline with local models

---

## Part 3: Team Collaboration (molt Cloud)

### The Vision
- Shared knowledge base across team
- Team-wide patterns and conventions
- Code review automation
- Compliance enforcement

### Architecture

```
molt Cloud:
├── Central engram DB (vector + FTS)
├── Team conventions store
├── Model router API
├── Cost dashboard
└── Admin panel

Developer Machine:
├── molt CLI/IDE extension
├── Local cache
└── Sync to cloud
```

**Pricing:**
- **Solo:** Free (local only)
- **Team:** $20/user/month (5+ users)
- **Enterprise:** $50/user/month (SSO, compliance, audit)

### Team Features

**1. Shared Knowledge**
- "How do we handle auth?" → team patterns, not just yours
- New dev onboarding: instant context
- Best practices enforced automatically

**2. Code Review Automation**
```bash
molt review pr/123
# molt:
# - Reads PR diff
# - Checks against team conventions
# - Runs tests
# - Suggests improvements
# - Auto-approves if passes all checks
```

**3. Compliance Enforcement**
```typescript
// Team admin sets rules:
{
  "no_hardcoded_secrets": true,
  "require_tests_for_features": true,
  "max_function_complexity": 10,
  "enforce_docs": true
}

// molt checks every change
molt -p "add login endpoint"
// ❌ Error: Feature changes require tests (team policy)
// ✓ Generating tests...
```

---

## Part 4: Custom Model Router as a Service

### The Opportunity
- Every AI coding tool has this problem
- They all use expensive models for everything
- You can sell the router as infrastructure

### Product: "molt Router API"

```bash
# Instead of:
curl anthropic.com/v1/messages \
  -H "x-api-key: $KEY" \
  -d '{"model": "claude-sonnet-4", ...}'

# Use:
curl molt.dev/v1/messages \
  -H "x-api-key: $MOLT_KEY" \
  -d '{"task_type": "code_generation", ...}'

# molt router:
# - Classifies task
# - Routes to cheapest capable model
# - Handles retries/fallback
# - Tracks cost savings
# - Returns result + cost breakdown
```

**Pricing:**
- Pass-through model costs (no markup)
- **+$0.0001 per request** routing fee
- **OR 10% of cost savings** (aligned incentives)

**Example:**
- User task: "add API endpoint"
- Without router: Sonnet 4 = $0.50
- With router: Haiku = $0.05
- Savings: $0.45
- molt fee (10%): $0.045
- User pays: $0.095 (81% savings)

### Business Model
- B2B SaaS: Cursor, Windsurf, Cody, etc. integrate router
- They save 70% on model costs
- We take 10% of savings
- Win-win: they reduce costs, we earn revenue

**Revenue Potential:**
- 1,000 companies using AI coding tools
- Each spends $10K/month on models
- Integrate molt router → save $7K/month
- molt fee (10% of savings): $700/month
- **$700K MRR from 1,000 customers**

---

## Part 5: Product Roadmap (Next 6 Months)

### Month 1-2: Polish Core
- ✅ Phase 1-3 complete
- Add context window management
- Add cost limits / budgets
- Improve error recovery
- Performance optimization

### Month 3: Model Router
- Build classification engine
- Implement adaptive routing
- Train on real usage data
- Launch as molt feature
- Measure cost savings

### Month 4: IDE Extension
- VS Code extension MVP
- Inline diffs
- Chat panel
- Cost tracking UI
- Beta launch

### Month 5: Cloud Platform
- Team knowledge sharing
- Central engram DB
- Admin dashboard
- Usage analytics
- Beta with 5 teams

### Month 6: Router API
- Extract router as standalone service
- API documentation
- SDK for integrations
- Outreach to Cursor, Cody, etc.
- First paying customer

---

## Part 6: Go-to-Market Strategy

### Target Customers

**Tier 1: Individual Developers (Free → $10/month)**
- Pain: AI tools too expensive
- Gain: 80% cost savings
- Channel: Dev communities, Twitter, Reddit
- Conversion: Free tier → premium features

**Tier 2: Startups (20-50 devs) ($500-1K/month)**
- Pain: AI costs scaling out of control
- Gain: Team knowledge, cost control, compliance
- Channel: YC network, startup Slack groups
- Conversion: Free trial → team plan

**Tier 3: Enterprises (500+ devs) ($25K+/month)**
- Pain: Governance, security, costs
- Gain: SOC2, SSO, audit logs, cost allocation
- Channel: Outbound sales, conferences
- Conversion: POC → annual contract

### Distribution Channels

**1. Open Source (Freemium)**
- molt CLI: free, local-only
- GitHub: star count = credibility
- Documentation: SEO traffic
- Conversion: cloud features, team collaboration

**2. VS Code Marketplace**
- 30M developers
- "AI Code Assistant - 80% Cheaper"
- Free tier: 100 requests/month
- Paid: unlimited + team features

**3. Content Marketing**
- "How we cut AI coding costs by 80%"
- "Building Claude Code but Better"
- "Why AI Code Assistants Are Too Expensive"
- Dev.to, HackerNews, Twitter

**4. API Partnerships**
- Integrate router into Cursor, Cody, Windsurf
- They reduce costs, we get distribution
- Revenue share model

---

## Part 7: Competitive Positioning

### vs Claude Code / Cursor / Copilot

| Feature | molt | Claude Code | Cursor | Copilot |
|---------|------|-------------|--------|---------|
| **Price** | $10/mo | $20/mo | $20/mo | $10/mo |
| **Cost transparency** | ✅ | ❌ | ❌ | ❌ |
| **Model selection** | ✅ (5+) | ❌ (1) | ❌ (1) | ❌ (1) |
| **Smart routing** | ✅ 80% savings | ❌ | ❌ | ❌ |
| **Team knowledge** | ✅ | ❌ | ❌ | ❌ |
| **Planning phase** | ✅ | ❌ | ❌ | ❌ |
| **Git integration** | ✅ | ❌ | ❌ | ❌ |
| **Test runner** | ✅ | ❌ | ❌ | ❌ |
| **Local models** | ✅ | ❌ | ❌ | ❌ |
| **Self-hosted** | ✅ | ❌ | ❌ | ❌ |

**Positioning:**
- **"The Smart, Cost-Conscious AI Coding Assistant"**
- **"80% Cheaper Than Cursor, 3x More Capable"**
- **"Built for Teams That Care About Costs"**

---

## Part 8: Revenue Model (3 Product Lines)

### Product 1: molt Solo (Freemium SaaS)
**Free Tier:**
- 100 requests/month
- Local models only
- Community support

**Pro ($10/month):**
- Unlimited requests
- Cloud models (Haiku, Sonnet, Opus)
- Smart model routing (80% cost savings)
- Priority support

**Power ($25/month):**
- Everything in Pro
- Advanced features (parallel execution, plugins)
- 24/7 support
- Beta access to new features

**Revenue: $10-25 per solo dev × 10,000 users = $100-250K MRR**

### Product 2: molt Teams (B2B SaaS)
**Team ($20/user/month, min 5 users):**
- Shared knowledge base
- Team conventions
- Code review automation
- Usage analytics
- Admin dashboard

**Enterprise ($50/user/month, min 50 users):**
- Everything in Team
- SSO (SAML, OAuth)
- SOC2 compliance
- Audit logs
- On-prem deployment option
- Dedicated support

**Revenue: $20-50 per seat × 10,000 seats = $200-500K MRR**

### Product 3: molt Router API (Infrastructure)
**API Pricing:**
- Pass-through model costs
- +10% of cost savings as fee
- No minimums
- Pay-as-you-go

**Target:** AI coding tool companies (Cursor, Cody, Windsurf)
- They integrate our router
- Reduce their model costs 70%
- We earn 10% of savings

**Revenue: $700/month per 1K users × 100 customers = $70K MRR**

### Total Addressable Market
- **50M developers worldwide**
- **5M using AI coding tools (10%)**
- **Capture 0.4% = 20K users**
- **Revenue mix:**
  - Solo: 10K × $15 avg = $150K MRR
  - Teams: 5K seats × $30 avg = $150K MRR
  - API: 5 customers × $10K avg = $50K MRR
- **Total: $350K MRR = $4.2M ARR**

**With execution, reach $10M ARR in 2-3 years.**

---

## Part 9: Technical Architecture (Scale to 100K Users)

### Current (Single Machine)
```
molt CLI → AWS Bedrock → engram (local sled DB)
```

### Production (Cloud Scale)
```
molt CLI/IDE Extension
    ↓
molt API Gateway (FastAPI + Redis cache)
    ↓
    ├─→ Model Router (classify → route)
    │       ├─→ Haiku (80% of requests)
    │       ├─→ Sonnet (18%)
    │       └─→ Opus (2%)
    │
    ├─→ engram Cloud (Postgres + pgvector)
    │       ├─→ Vector search (OpenAI embeddings)
    │       ├─→ FTS (built-in)
    │       └─→ Knowledge graph
    │
    └─→ Job Queue (Celery + Redis)
            ├─→ Test runner workers
            ├─→ Code review workers
            └─→ Background tasks
```

**Infrastructure:**
- **API:** Kubernetes on AWS EKS
- **Database:** PostgreSQL with pgvector extension
- **Cache:** Redis for hot data
- **Storage:** S3 for artifacts
- **Monitoring:** Datadog
- **Cost:** ~$2K/month for 10K users

---

## Part 10: Funding Strategy

### Bootstrap vs Raise

**Bootstrap Path (Your Situation - Cash Poor, Time Rich):**
- ✅ Launch free tier + Pro ($10/month)
- ✅ Get to $10K MRR organically (6 months)
- ✅ Profitable at $30K MRR (break-even)
- ✅ Reinvest profits into growth
- Timeline: 2-3 years to $1M ARR

**Raise Path (If You Want Faster Growth):**
- Seed round: $500K-1M at $4-5M valuation
- Use for: team (2 engineers), marketing, sales
- Goal: $1M ARR in 18 months
- Series A: $5M at $20M valuation
- Timeline: 5 years to exit

**My Recommendation: Bootstrap First**
- You have working product
- No burn rate (solo)
- Can get to $10K MRR in 3-6 months
- Then decide: keep bootstrapping or raise

---

## Part 11: Action Plan (Next 30 Days)

Let me build the most critical features to make molt production-ready for daily use:

### Week 1: Model Router
- [ ] Task classifier
- [ ] Multi-provider support (Haiku, Sonnet, local)
- [ ] Cost tracking improvements
- [ ] Usage limits

### Week 2: Context Management
- [ ] Track context window size
- [ ] Auto-summarize long conversations
- [ ] Smart file loading

### Week 3: VS Code Extension (MVP)
- [ ] Basic extension scaffold
- [ ] Chat panel
- [ ] Inline diff preview
- [ ] Cost counter

### Week 4: Landing Page + Launch
- [ ] Website: molt.dev
- [ ] Documentation
- [ ] Launch on HackerNews
- [ ] Get first 100 users

Want me to start building these? Which should I prioritize?
