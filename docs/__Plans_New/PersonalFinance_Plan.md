# Personal Finance Planning App - Development Plan

## Executive Summary

This plan outlines the development of a sophisticated personal finance planning application based on the spreadsheet image provided. The app will enable daily spending tracking, bill management, cash flow projection, and budgeting with encrypted data storage and future AI integration.

## Research Summary: Similar Apps & Best Practices

### Top Personal Finance Apps Analyzed

1. **YNAB (You Need A Budget)**
   - Zero-based budgeting methodology
   - Real-time transaction sync
   - Goal tracking and debt payoff planning
   - Mobile-first design

2. **Mint (by Intuit)**
   - Automatic transaction categorization
   - Bill reminders and alerts
   - Credit score monitoring
   - Investment tracking

3. **PocketGuard**
   - "In My Pocket" spending limit calculation
   - Bill tracking with due dates
   - Subscription management
   - Daily spending limits

4. **Goodbudget**
   - Envelope budgeting system
   - Multi-account support
   - Shared budgets for families
   - Simple, clean interface

5. **Personal Capital**
   - Investment portfolio tracking
   - Retirement planning
   - Net worth calculation
   - Fee analyzer

### Key Features Identified

**Core Features:**
- Daily/weekly spending limits
- Bill tracking with due dates and frequencies
- Cash flow projection
- Multi-account management
- Budget vs. actual tracking
- Financial goal setting

**Advanced Features:**
- Automatic transaction categorization (AI)
- Spending pattern analysis
- Predictive cash flow modeling
- Bill payment reminders
- Debt payoff calculators
- Savings goal tracking

**Security Features:**
- End-to-end encryption
- Biometric authentication
- Secure data storage
- Privacy-first design

## Architecture Overview

### Technology Stack
- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS)
- **Encryption:** pgcrypto extension + application-level encryption
- **AI Integration:** OpenAI/Anthropic APIs (future)
- **Design System:** Liquid Glass (existing)

### Database Schema Design

#### Core Tables

```sql
-- Financial Accounts (user's bank accounts, credit cards, etc.)
CREATE TABLE finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Orange One", "Everyday Spending", "Bills Acc"
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit', 'investment', 'other')),
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AUD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bills/Recurring Expenses
CREATE TABLE finance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL, -- e.g., "Synergy Electricity", "TPG Internet"
  amount DECIMAL(10, 2) NOT NULL,
  charge_cycle TEXT NOT NULL CHECK (charge_cycle IN ('weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  next_due_date DATE NOT NULL,
  billing_account_id UUID REFERENCES finance_accounts(id),
  category TEXT, -- e.g., "utilities", "insurance", "subscriptions"
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions (income and expenses)
CREATE TABLE finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL, -- negative for expenses, positive for income
  description TEXT NOT NULL,
  category TEXT, -- auto-categorized or manual
  bill_id UUID REFERENCES finance_bills(id), -- if linked to a bill
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets (monthly/weekly spending limits)
CREATE TABLE finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  category TEXT, -- null for overall budget
  budget_amount DECIMAL(10, 2) NOT NULL,
  spent_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES finance_accounts(id), -- if budget is account-specific
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial Goals (savings goals, debt payoff, etc.)
CREATE TABLE finance_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('savings', 'debt_payoff', 'purchase', 'emergency_fund', 'other')),
  name TEXT NOT NULL,
  target_amount DECIMAL(10, 2) NOT NULL,
  current_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  target_date DATE,
  account_id UUID REFERENCES finance_accounts(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cash Flow Projections (daily/weekly projections)
CREATE TABLE finance_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projection_date DATE NOT NULL,
  days_remaining INTEGER NOT NULL,
  everyday_spending DECIMAL(10, 2),
  bills_amount DECIMAL(10, 2),
  orange_one_balance DECIMAL(10, 2),
  savings_balance DECIMAL(10, 2),
  work_concur DECIMAL(10, 2),
  zip_balance DECIMAL(10, 2),
  total_available DECIMAL(10, 2) NOT NULL,
  bills_remaining DECIMAL(10, 2) NOT NULL,
  cash_available DECIMAL(10, 2) NOT NULL,
  cash_per_week DECIMAL(10, 2),
  spending_per_day DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, projection_date, days_remaining)
);
```

#### Encryption Strategy

**Option 1: Application-Level Encryption (Recommended)**
- Encrypt sensitive fields (amounts, account numbers) before storing
- Use AES-256-GCM encryption
- Store encryption keys securely (environment variables, rotated regularly)
- Decrypt on read in application layer

**Option 2: Database-Level Encryption**
- Use pgcrypto extension for column-level encryption
- Encrypt at rest using Supabase encryption features
- Transparent encryption for sensitive columns

**Implementation:**
```typescript
// utils/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.FINANCE_ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encryptFinancialData(data: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

export function decryptFinancialData(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_projections ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY finance_accounts_own ON finance_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY finance_bills_own ON finance_bills
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY finance_transactions_own ON finance_transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY finance_budgets_own ON finance_budgets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY finance_goals_own ON finance_goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY finance_projections_own ON finance_projections
  FOR ALL USING (auth.uid() = user_id);
```

## Feature Specifications

### Phase 1: Core Functionality (MVP)

#### 1.1 Dashboard Overview
- **Financial Summary Cards:**
  - Total available cash across all accounts
  - Bills remaining this month
  - Daily/weekly spending limits
  - Budget status (on track, over budget, under budget)
  
- **Quick Actions:**
  - Add transaction
  - Add bill
  - Update account balance
  - View projections

#### 1.2 Bills Management
- **Bills Breakdown Table:**
  - Company name
  - Amount and charge cycle
  - Next due date
  - Remaining amount this month
  - Billing account
  - Status (paid, pending, overdue)
  
- **Features:**
  - Add/edit/delete bills
  - Mark bills as paid
  - Auto-calculate remaining amounts based on cycle
  - Filter by account, category, status

#### 1.3 Account Management
- **Account List:**
  - Account name and type
  - Current balance
  - Last updated
  - Quick balance update
  
- **Features:**
  - Add/edit accounts
  - Update balances
  - Archive inactive accounts
  - Account-specific views

#### 1.4 Cash Flow Projection
- **Projection Table:**
  - Days remaining in month
  - Account balances
  - Bills remaining
  - Cash available
  - Spending per day/week
  - Projections for multiple scenarios
  
- **Features:**
  - Daily projection updates
  - Multiple scenario modeling
  - Visual charts (line/bar graphs)
  - Export to CSV

#### 1.5 Transaction Tracking
- **Transaction List:**
  - Date, amount, description
  - Category
  - Account
  - Linked bill (if applicable)
  
- **Features:**
  - Add/edit/delete transactions
  - Quick add from dashboard
  - Filter by date range, account, category
  - Search functionality

### Phase 2: Advanced Features

#### 2.1 Budgeting System
- **Budget Creation:**
  - Weekly/monthly/yearly budgets
  - Category-based budgets
  - Account-specific budgets
  - Budget templates
  
- **Budget Tracking:**
  - Real-time spending vs. budget
  - Visual progress indicators
  - Alerts when approaching limits
  - Budget adjustment suggestions

#### 2.2 Financial Goals
- **Goal Types:**
  - Savings goals (emergency fund, vacation, etc.)
  - Debt payoff goals
  - Purchase goals
  - Custom goals
  
- **Goal Tracking:**
  - Progress visualization
  - Timeline tracking
  - Contribution planning
  - Achievement celebrations

#### 2.3 Analytics & Reports
- **Spending Analysis:**
  - Category breakdown (pie charts)
  - Trend analysis (line charts)
  - Monthly comparisons
  - Year-over-year analysis
  
- **Reports:**
  - Monthly financial summary
  - Bill payment history
  - Account balance history
  - Export capabilities (PDF, CSV)

#### 2.4 Notifications & Reminders
- **Bill Reminders:**
  - Upcoming bill notifications
  - Overdue bill alerts
  - Payment confirmations
  
- **Budget Alerts:**
  - Approaching budget limit
  - Over budget warnings
  - Weekly spending summaries

### Phase 3: AI Integration

#### 3.1 Transaction Categorization
- **Automatic Categorization:**
  - AI-powered transaction categorization
  - Learning from user corrections
  - Merchant recognition
  - Smart category suggestions

#### 3.2 Financial Insights
- **AI Analysis:**
  - Spending pattern recognition
  - Anomaly detection
  - Budget optimization suggestions
  - Savings opportunity identification
  
- **Personalized Recommendations:**
  - Budget adjustments
  - Bill negotiation opportunities
  - Debt payoff strategies
  - Savings goal optimization

#### 3.3 Predictive Analytics
- **Cash Flow Forecasting:**
  - ML-based cash flow predictions
  - Scenario modeling
  - Risk assessment
  - Goal achievement probability

#### 3.4 Conversational Finance Assistant
- **Chat Interface:**
  - "How much can I spend today?"
  - "When is my next bill due?"
  - "Am I on track with my budget?"
  - "What's my spending trend?"
  - Natural language queries

## UI/UX Design

### Design Principles
- **Liquid Glass Design System:** Use existing glass-morphism components
- **Mobile-First:** Responsive design for daily mobile updates
- **Quick Actions:** Fast transaction entry (under 10 seconds)
- **Visual Clarity:** Clear financial status at a glance
- **Accessibility:** WCAG 2.1 AA compliance

### Key Screens

#### Dashboard
```
┌─────────────────────────────────────┐
│  Personal Finance Dashboard         │
├─────────────────────────────────────┤
│  [Summary Cards Row]                │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Cash │ │Bills │ │Budget│        │
│  └──────┘ └──────┘ └──────┘        │
├─────────────────────────────────────┤
│  Quick Actions                      │
│  [Add Transaction] [Add Bill]      │
├─────────────────────────────────────┤
│  Bills Breakdown (This Month)       │
│  [Table with bills]                 │
├─────────────────────────────────────┤
│  Cash Flow Projection               │
│  [Projection table/chart]           │
└─────────────────────────────────────┘
```

#### Bills Management
- Filterable/sortable table
- Add/Edit modal dialogs
- Bulk actions (mark multiple as paid)
- Calendar view for due dates

#### Transaction Entry
- Quick add form (minimal fields)
- Full add form (all fields)
- Recurring transaction setup
- Category autocomplete

### Color Coding
- **Green:** Positive amounts, savings, goals achieved
- **Red:** Expenses, over budget, overdue bills
- **Yellow/Orange:** Warnings, approaching limits
- **Blue:** Information, projections, neutral data

## Implementation Plan

### Sprint 1: Database & Core Setup (Week 1-2)
- [ ] Create database schema
- [ ] Set up RLS policies
- [ ] Implement encryption utilities
- [ ] Create TypeScript types
- [ ] Set up API routes structure

### Sprint 2: Accounts & Bills (Week 3-4)
- [ ] Accounts CRUD operations
- [ ] Bills CRUD operations
- [ ] Bill calculation logic (remaining amounts)
- [ ] Accounts UI components
- [ ] Bills UI components

### Sprint 3: Transactions & Dashboard (Week 5-6)
- [ ] Transaction CRUD operations
- [ ] Dashboard summary calculations
- [ ] Quick action components
- [ ] Dashboard layout
- [ ] Transaction list/table

### Sprint 4: Cash Flow Projections (Week 7-8)
- [ ] Projection calculation logic
- [ ] Projection storage/retrieval
- [ ] Projection UI components
- [ ] Charts/visualizations
- [ ] Scenario modeling

### Sprint 5: Budgeting & Goals (Week 9-10)
- [ ] Budget CRUD operations
- [ ] Budget tracking logic
- [ ] Goals CRUD operations
- [ ] Budget UI components
- [ ] Goals UI components

### Sprint 6: Analytics & Polish (Week 11-12)
- [ ] Analytics calculations
- [ ] Charts and visualizations
- [ ] Reports generation
- [ ] Notifications system
- [ ] Mobile optimization
- [ ] Testing & bug fixes

### Sprint 7: AI Integration (Future)
- [ ] Transaction categorization API
- [ ] Financial insights engine
- [ ] Predictive analytics
- [ ] Chat assistant integration
- [ ] AI recommendations UI

## Security Considerations

### Data Protection
1. **Encryption:**
   - Encrypt sensitive financial data at rest
   - Use HTTPS for all API calls
   - Secure key management

2. **Access Control:**
   - RLS policies for all tables
   - User authentication required
   - Session management

3. **Audit Trail:**
   - Log all financial data changes
   - Track user actions
   - Compliance with financial data regulations

4. **Input Validation:**
   - Sanitize all user inputs
   - Validate amounts and dates
   - Prevent SQL injection

### Privacy
- No data sharing with third parties
- User data ownership
- GDPR compliance
- Data export capabilities
- Account deletion with data purge

## Testing Strategy

### Unit Tests
- Encryption/decryption functions
- Calculation logic (projections, budgets)
- Data validation

### Integration Tests
- API endpoints
- Database operations
- RLS policy enforcement

### E2E Tests
- User workflows
- Transaction entry
- Bill management
- Dashboard updates

## Performance Considerations

### Optimization
- Index database columns for frequent queries
- Cache dashboard calculations
- Lazy load transaction history
- Pagination for large datasets
- Optimistic UI updates

### Scalability
- Efficient queries (avoid N+1)
- Batch operations where possible
- Background jobs for calculations
- CDN for static assets

## Future Enhancements

1. **Bank Integration:**
   - Automatic transaction import
   - Real-time balance sync
   - Open Banking API integration

2. **Multi-Currency Support:**
   - Currency conversion
   - Multi-currency accounts
   - Exchange rate tracking

3. **Collaborative Features:**
   - Shared budgets (family/household)
   - Expense splitting
   - Shared goals

4. **Advanced Analytics:**
   - Predictive modeling
   - Investment tracking
   - Tax planning
   - Retirement planning

5. **Mobile App:**
   - Native iOS/Android apps
   - Push notifications
   - Offline support
   - Biometric authentication

## Success Metrics

- **User Engagement:**
  - Daily active users
  - Transactions entered per day
  - Bills tracked
  - Goals created

- **Financial Impact:**
  - Budget adherence rate
  - Savings goal achievement
  - Bill payment on-time rate
  - Spending reduction

- **Technical:**
  - Page load time < 2s
  - API response time < 500ms
  - Zero security incidents
  - 99.9% uptime

## Conclusion

This personal finance planning app will provide users with a sophisticated, secure, and user-friendly tool for managing their finances. The phased approach allows for iterative development and user feedback, while the AI integration roadmap ensures future scalability and advanced features.

The encryption and security measures ensure user data is protected, while the comprehensive feature set rivals commercial finance apps. The integration with the existing Strings app provides a seamless user experience within a familiar interface.

