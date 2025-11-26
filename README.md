# TenderMatch - Tender Eligibility Analyzer

A comprehensive tender management system that automates tender filtering and analysis with intelligent categorization for IT/Software service companies.

## Features

- **Excel Upload**: Upload tender Excel files with GEM and Non-GEM sheets
- **Smart Categorization**: Automatic categorization into 4 categories:
  - **Eligible**: Matches company criteria (project types + turnover)
  - **Not Relevant**: Contains negative keywords (only for non-IT tenders)
  - **Not Eligible**: Doesn't meet turnover requirements
  - **Manual Review**: Requires PDF upload for analysis
- **Intelligent Matching**: Core IT/Software tenders override negative keywords
- **Negative Keywords**: Filter irrelevant tenders (construction, medical, etc.)
- **Manual Override**: Override automatic categorization with reason and comment
- **MSME/Startup Exemptions**: Automatic detection of turnover exemptions
- **Corrigendum Tracking**: Detect duplicate T247 IDs and track changes
- **PDF Analysis**: Upload PDFs for tenders with unclear eligibility
- **Project Type Filtering**: Filter dashboard by project type tags

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Simple username/password (admin/admin)
- **File Processing**: XLSX for Excel, pdf-parse for PDF extraction

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Set up environment variables (see below)
# Create a PostgreSQL database

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## Environment Variables

Create a `.env` file or set these environment variables:

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@host:port/database

# Or individual PostgreSQL settings
PGHOST=your-db-host
PGPORT=5432
PGDATABASE=your-db-name
PGUSER=your-db-user
PGPASSWORD=your-db-password

# Session
SESSION_SECRET=your-secret-key-min-32-chars
```

## Deployment Guide


### Deploy on VPS/Server

#### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- PM2 (for process management)

#### Steps

1. Clone the repository:
```bash
git clone https://github.com/your-username/tendermatch.git
cd tendermatch
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variables:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/tendermatch"
export SESSION_SECRET="your-secret-key-min-32-chars"
export NODE_ENV="production"
```

4. Build the application:
```bash
npm run build
```

5. Push database schema:
```bash
npm run db:push
```

6. Start with PM2:
```bash
pm2 start dist/index.js --name tendermatch
pm2 save
pm2 startup
```

### Option 4: Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/tendermatch
      - SESSION_SECRET=your-secret-key
      - NODE_ENV=production
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=tendermatch
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run:
```bash
docker-compose up -d
```

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `POST /api/login` - Login (body: `{username, password}`)
- `POST /api/logout` - Logout

### Tenders
- `GET /api/tenders` - List all tenders
- `GET /api/tenders/status/:status` - Get tenders by status (eligible, not_relevant, not_eligible, manual_review)
- `POST /api/tenders/:id/override` - Override tender status
- `DELETE /api/tenders/:id/override` - Undo override
- `GET /api/tenders/corrigendum` - Get corrigendum tenders
- `POST /api/tenders/upload-pdf` - Upload PDF for analysis

### Upload
- `POST /api/upload` - Upload Excel file
- `GET /api/uploads` - Get upload history

### Settings
- `GET /api/company-criteria` - Get company criteria
- `PUT /api/company-criteria` - Update company criteria
- `GET /api/negative-keywords` - Get negative keywords
- `POST /api/negative-keywords` - Add negative keyword
- `DELETE /api/negative-keywords/:id` - Delete negative keyword

### Stats
- `GET /api/stats` - Get dashboard statistics

## Company Criteria (Default)

- **Turnover**: 400 Lakhs (4 Crore)
- **Project Types**: Software, Website, Mobile, IT Projects, Manpower Deployment

## Excel Format

Expected sheets: "Gem" and "Non-Gem"

### GEM Sheet Columns
- Column A: T247 ID
- Column B: Title
- Column D: Department
- Column F: Estimated Value
- Column G: EMD Amount
- Column K: MSME Exemption Status
- Column L: Startup Exemption Status
- Column Q: Submission Deadline
- Column S: Turnover Requirement (in Lakhs)
- Column X: Similar Category (for core service matching)

### Non-GEM Sheet Columns
- Column A: T247 ID
- Column B: Title
- Column D: Organization
- Column F: Estimated Value
- Column G: EMD Amount
- Column Q: Submission Deadline
- Column S: Eligibility Criteria

## Eligibility Matching Logic

1. **Core Service Detection**: Checks if tender matches IT/Software services
2. **Smart Negative Keywords**: Only applied to non-IT tenders
3. **Turnover Comparison**: Company turnover (400 Lakhs) vs required turnover
4. **MSME/Startup Exemptions**: Turnover requirements waived if exempted
5. **100% Match**: Core service + turnover met = Eligible

## Default Login

- **Username**: admin
- **Password**: admin

**Important**: Change the default credentials in production by modifying `server/simpleAuth.ts`.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run db:push  # Push schema changes to database
```

## License

MIT License
