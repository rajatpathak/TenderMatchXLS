# TenderMatch - Tender Eligibility Analyzer

## Overview
TenderMatch is a web application for analyzing government tender eligibility with complete workflow management. It allows users to upload Excel files containing tender data (GEM and Non-GEM), automatically categorizes tenders based on company criteria and negative keywords, assigns tenders to team members, and tracks bidding progress through to submission.

## Tech Stack
- **Frontend**: React with TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Secure bcrypt-based admin authentication with role-based access control
- **File Processing**: XLSX for Excel parsing, pdf-parse for PDF extraction

## Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components (Dashboard, WorkflowPage, SubmittedTenders, TeamManagement)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
├── server/                 # Backend Express application
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   ├── eligibilityMatcher.ts # Tender matching algorithm
│   ├── simpleAuth.ts       # Authentication setup
│   └── db.ts               # Database connection
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Drizzle ORM schemas
```

## Key Features
1. **Analytics Dashboard**: High-scale analytics dashboard featuring:
   - Key metrics cards (Eligible Tenders, Active Assignments, Ready for Review, Submitted Bids)
   - Win rate and pending results tracking
   - Workflow distribution pie chart
   - Tender results bar chart (Won/Lost/Cancelled)
   - System performance metrics (API response time, success rate, uptime)
   - Upcoming deadlines section (next 7 days)
   - Today's schedule (presentations and clarification deadlines)
   - Quick stats footer with overall tender counts
2. **Excel Upload**: Upload tender Excel files with Gem/Non-Gem sheets
3. **Smart Tender Categorization**: Automatic categorization into 5 categories:
   - **Eligible**: Matches company criteria (project types + turnover)
   - **Not Relevant**: Contains negative keywords (only for non-IT tenders)
   - **Not Eligible**: Doesn't meet turnover requirements
   - **Manual Review**: Requires PDF upload for analysis
   - **Missed**: Tenders past deadline
4. **Intelligent Negative Keywords**: IT/Software tenders override negative keywords
5. **Manual Override**: Override automatic categorization with reason and comment
6. **MSME/Startup Exemptions**: Automatic detection of turnover exemptions
7. **Corrigendum Tracking**: Detect duplicate T247 IDs and track changes
8. **PDF Analysis**: Upload PDFs for tenders with unclear eligibility
9. **Project Type Filtering**: Filter dashboard by detected tags
10. **Team Management**: Add team members with roles (admin/manager/bidder)
11. **Tender Assignment**: Assign eligible tenders to bidders with priority and deadline
12. **Workflow Management**: Track tender progress through bidding stages
13. **Submission Tracking**: Record final bids with budget and portal reference
14. **Tender Results**: Track tender outcomes (won/lost/cancelled) with history
15. **Presentations**: Schedule presentations with team assignments, contact management, and PDF uploads
16. **Clarifications**: Track tender clarifications through stages (submitted/pending/resolved) with team assignment, submit deadline date/time tracking, and file upload on submission
17. **Unified Notifications**: Header notification bell combining presentation and clarification reminders with:
   - Today's scheduled presentations (auto-expire after scheduled time)
   - Today's clarification deadlines (auto-expire after submit deadline time)
   - Tab-based filtering (All/Presentations/Clarifications)
   - 60-second auto-refresh
18. **Notification Marquee Banner**: Scrolling alert banner at the top of the page showing:
   - Today's presentations and clarification deadlines
   - Continuous scrolling animation for multiple notifications
   - Auto-pause on hover for reading
   - Quick link to view all notifications
19. **MIS Reports**: Management Information System reports with:
   - Date range selection (Today, Yesterday, Last 7 Days, This Week, Last 30 Days, This Month, Custom)
   - Team member activity tracking (tenders marked, assignments, submissions, reviews)
   - Clarifications and presentations tracking
   - Daily breakdown charts and tables with tender ID details
   - Result metrics: L1 count, Awarded count, Lost count, Cancelled count, Win Ratio
   - PDF export option with full details (summary, daily breakdown, tender IDs by activity)
   - CSV download for individual and team reports
   - Team comparison view (admin/manager only)

## Workflow Stages
Tenders progress through the following stages after assignment:
- **Assigned**: Tender assigned to a bidder
- **In Progress**: Bidder actively working on the bid
- **Ready for Review**: Bid prepared, awaiting manager review
- **Submitted**: Bid submitted to portal (with budget capture)

## User Roles
- **Admin**: Full access to all features including team management
- **Manager**: Can assign tenders and review submissions, assign tenders to bidders
- **Bidder**: Can update workflow status on assigned tenders, can self-assign (claim) unassigned eligible tenders

## Status/Stage Update Authorization
- **Presentations**: Admin, Manager, or the assigned team member can update the presentation status
- **Clarifications**: Admin, Manager, or the assigned team member can update the clarification stage and submit clarifications

## Tender Assignment Flow
- Managers/Admins can assign eligible tenders to any bidder via the "Assign" button on tender cards
- Bidders can view unassigned tenders in the "Available to Claim" tab in My Work page
- Bidders can claim unassigned tenders by clicking the "Claim Tender" button
- Backend prevents duplicate assignments (returns 409 Conflict if tender already assigned)
- After assignment, the tender appears in the bidder's My Work queue with "Assigned" stage

## Eligibility Matching Logic
1. Core service detection checks if tender matches IT/Software services
2. Smart negative keywords only apply to non-IT tenders
3. Turnover comparison: Company (400 Lakhs) vs required turnover
4. MSME/Startup exemptions waive turnover requirements
5. All values stored and compared in Lakhs for accuracy

## Database Tables
- `users` - User accounts
- `sessions` - Session storage
- `tenders` - Main tender records with eligibility status and override fields
- `excel_uploads` - Upload history
- `company_criteria` - Company matching criteria
- `negative_keywords` - Keywords to filter irrelevant tenders
- `corrigendum_changes` - Change tracking
- `tender_documents` - PDF uploads
- `team_members` - Team member profiles with roles
- `tender_assignments` - Tender assignment tracking with workflow status
- `bidding_submissions` - Final bid submission records
- `tender_results` - Track tender outcomes (won/lost/cancelled)
- `tender_result_history` - History of result status changes
- `presentations` - Schedule presentations with team assignments
- `presentation_history` - History of presentation status changes
- `clarifications` - Track clarifications through stages
- `clarification_history` - History of clarification stage changes

## API Endpoints
### Authentication
- `GET /api/auth/user` - Current user
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/me/team-member` - Get current user's team member record

### Tender Management
- `GET /api/tenders` - List all tenders
- `GET /api/tenders/status/:status` - Get tenders by eligibility status
- `POST /api/tenders/:id/override` - Override tender status
- `DELETE /api/tenders/:id/override` - Undo override
- `GET /api/tenders/corrigendum` - Corrigendum tenders
- `POST /api/upload` - Upload Excel file
- `POST /api/tenders/upload-pdf` - Upload PDF for analysis
- `GET /api/uploads` - Upload history

### Team Management
- `GET /api/team-members` - List all team members
- `POST /api/team-members` - Add team member
- `PUT /api/team-members/:id` - Update team member
- `DELETE /api/team-members/:id` - Remove team member

### Workflow Management
- `GET /api/tender-assignments` - List all assignments
- `GET /api/tender-assignments/stats` - Get workflow stats (counts per stage)
- `POST /api/tender-assignments` - Create assignment
- `PUT /api/tender-assignments/:id/stage` - Update workflow stage
- `GET /api/bidding-submissions` - List all submissions
- `POST /api/bidding-submissions` - Record bid submission

### Tender Results
- `GET /api/tender-results` - List all tender results
- `POST /api/tender-results` - Create tender result
- `PUT /api/tender-results/:id` - Update tender result
- `DELETE /api/tender-results/:id` - Delete tender result
- `GET /api/tender-results/:id/history` - Get result history

### Presentations
- `GET /api/presentations` - List all presentations
- `GET /api/presentations/today` - Get today's presentations for current user (notifications)
- `POST /api/presentations` - Create presentation
- `PUT /api/presentations/:id` - Update presentation
- `DELETE /api/presentations/:id` - Delete presentation
- `POST /api/presentations/:id/status` - Update presentation status
- `GET /api/presentations/:id/history` - Get presentation history

### Clarifications
- `GET /api/clarifications` - List all clarifications
- `GET /api/clarifications/today` - Get today's clarification deadlines for current user (notifications)
- `POST /api/clarifications` - Create clarification
- `PUT /api/clarifications/:id` - Update clarification
- `DELETE /api/clarifications/:id` - Delete clarification
- `PATCH /api/clarifications/:id/stage` - Update clarification stage
- `POST /api/clarifications/:id/submit` - Submit clarification with file upload
- `GET /api/clarifications/:id/history` - Get clarification history

### MIS Reports
- `GET /api/mis-report/me` - Get MIS report for current user
- `GET /api/mis-report/team-member/:id` - Get MIS report for specific team member
- `GET /api/mis-report/all` - Get MIS reports for all team members (admin/manager only)
- `GET /api/mis-report/download/me` - Download personal MIS report as CSV
- `GET /api/mis-report/download/all` - Download team MIS report as CSV (admin/manager only)

### Configuration
- `GET /api/company-criteria` - Get criteria
- `PUT /api/company-criteria` - Update criteria
- `GET /api/negative-keywords` - Get negative keywords
- `POST /api/negative-keywords` - Add negative keyword
- `DELETE /api/negative-keywords/:id` - Delete negative keyword
- `GET /api/stats` - Dashboard stats

## Eligibility Status Values
- `eligible` - Tender matches company criteria
- `not_relevant` - Tender contains negative keyword
- `not_eligible` - Tender requirements not met
- `manual_review` - Requires manual PDF analysis

## Running the Project

### Development
The application starts with `npm run dev` which runs both the Express backend and Vite frontend.
Default dev credentials: admin/admin

### Production Deployment (VPS)
1. Copy `.env.example` to `.env` and configure
2. Generate password hash: `node scripts/generate-password-hash.js <password>`
3. Set `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` in `.env`
4. Run `npm run db:push` to initialize database
5. Run `npx tsx scripts/seed.ts` to seed initial data
6. Build: `npm run build`
7. Start: `npm start`

See `DEPLOYMENT.md` for full VPS deployment guide with Nginx/PM2/SSL.

## Company Criteria (Default)
- Turnover: 400 Lakhs (4 Crore)
- Project Types: Software, Website, Mobile, IT Projects, Manpower Deployment

## Excel Format
Expected sheets: "Gem" and "Non-Gem" with columns:
- T247 ID (unique identifier)
- Title
- Department/Organization
- Estimated Value
- EMD Amount
- Eligibility Criteria
- Submission Deadline
