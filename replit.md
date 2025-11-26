# TenderMatch - Tender Eligibility Analyzer

## Overview
TenderMatch is a web application for analyzing government tender eligibility. It allows users to upload Excel files containing tender data (GEM and Non-GEM), automatically categorizes tenders based on company criteria and negative keywords, and provides filtering and override capabilities.

## Tech Stack
- **Frontend**: React with TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Simple username/password (admin/admin)
- **File Processing**: XLSX for Excel parsing, pdf-parse for PDF extraction

## Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
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
1. **Excel Upload**: Upload tender Excel files with Gem/Non-Gem sheets
2. **Tender Categorization**: Automatic categorization into 4 categories:
   - **Eligible**: Matches company criteria
   - **Not Relevant**: Contains negative keywords
   - **Not Eligible**: Doesn't meet eligibility requirements
   - **Manual Review**: Requires PDF upload for analysis
3. **Negative Keywords**: Filter irrelevant tenders automatically
4. **Manual Override**: Override automatic categorization with reason and comment
5. **MSME/Startup Exemptions**: Automatic detection of turnover exemptions
6. **Corrigendum Tracking**: Detect duplicate T247 IDs and track changes
7. **PDF Analysis**: Upload PDFs for tenders with unclear eligibility

## Database Tables
- `users` - User accounts
- `sessions` - Session storage
- `tenders` - Main tender records with eligibility status and override fields
- `excel_uploads` - Upload history
- `company_criteria` - Company matching criteria
- `negative_keywords` - Keywords to filter irrelevant tenders
- `corrigendum_changes` - Change tracking
- `tender_documents` - PDF uploads

## API Endpoints
- `GET /api/auth/user` - Current user
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/tenders` - List all tenders
- `GET /api/tenders/status/:status` - Get tenders by eligibility status
- `POST /api/tenders/:id/override` - Override tender status
- `DELETE /api/tenders/:id/override` - Undo override
- `GET /api/tenders/corrigendum` - Corrigendum tenders
- `POST /api/upload` - Upload Excel file
- `POST /api/tenders/upload-pdf` - Upload PDF for analysis
- `GET /api/uploads` - Upload history
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
The application starts with `npm run dev` which runs both the Express backend and Vite frontend.

## Company Criteria (Default)
- Turnover: 4 Crore
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
