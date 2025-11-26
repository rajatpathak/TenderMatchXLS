# TenderMatch - Tender Eligibility Analyzer

## Overview
TenderMatch is a web application for analyzing government tender eligibility. It allows users to upload Excel files containing tender data (GEM and Non-GEM), automatically match tenders against company criteria, and filter/sort opportunities efficiently.

## Tech Stack
- **Frontend**: React with TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
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
│   ├── replitAuth.ts       # Authentication setup
│   └── db.ts               # Database connection
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Drizzle ORM schemas
```

## Key Features
1. **Excel Upload**: Upload tender Excel files with Gem/Non-Gem sheets
2. **Eligibility Matching**: Rule-based matching against company criteria (turnover, project types)
3. **Color-coded Display**: Visual match percentage indicators (green/yellow/orange/red)
4. **MSME/Startup Exemptions**: Automatic detection of turnover exemptions
5. **Corrigendum Tracking**: Detect duplicate T247 IDs and track changes
6. **PDF Analysis**: Upload PDFs for tenders with unclear eligibility
7. **Filtering**: Filter by match %, type, tags, budget, dates, etc.

## Database Tables
- `users` - User accounts (Replit Auth)
- `sessions` - Session storage
- `tenders` - Main tender records
- `excel_uploads` - Upload history
- `company_criteria` - Company matching criteria
- `corrigendum_changes` - Change tracking
- `tender_documents` - PDF uploads

## API Endpoints
- `GET /api/auth/user` - Current user
- `GET /api/tenders` - List all tenders
- `GET /api/tenders/corrigendum` - Corrigendum tenders
- `POST /api/upload` - Upload Excel file
- `POST /api/tenders/upload-pdf` - Upload PDF for analysis
- `GET /api/uploads` - Upload history
- `GET /api/company-criteria` - Get criteria
- `PUT /api/company-criteria` - Update criteria
- `GET /api/stats` - Dashboard stats

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
