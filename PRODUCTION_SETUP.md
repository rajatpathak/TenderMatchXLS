# Production Deployment Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- PM2 (for process management)

## Environment Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd TenderMatchXLS
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your production values:
```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/tendermatch
PGHOST=localhost
PGPORT=5432
PGUSER=your_db_user
PGPASSWORD=your_db_password
PGDATABASE=tendermatch

# Session (REQUIRED)
SESSION_SECRET=your-super-secure-session-secret-min-32-chars

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=your-bcrypt-hash

# Application
NODE_ENV=production
PORT=5000
```

4. **Generate admin password hash:**
```bash
node scripts/generate-password-hash.js your-secure-password
```

5. **Set up database:**
```bash
createdb tendermatch
npm run db:push
```

6. **Build the application:**
```bash
npm run build
```

7. **Start with PM2:**
```bash
pm2 start dist/index.js --name tendermatch
pm2 save
pm2 startup
```

## Features

### Core Functionality
- ✅ Excel upload with GEM/Non-GEM sheet processing
- ✅ Smart tender categorization (Eligible, Not Relevant, Not Eligible, Manual Review)
- ✅ Intelligent matching with IT/Software service detection
- ✅ Negative keywords filtering
- ✅ Manual override capabilities
- ✅ MSME/Startup exemption handling
- ✅ Corrigendum tracking
- ✅ PDF analysis for unclear tenders
- ✅ Missed deadline detection

### Team Management & Workflow
- ✅ Team member management (Admin, Manager, Bidder roles)
- ✅ Tender assignment system
- ✅ Workflow stages (Assigned → In Progress → Ready for Review → Submitted)
- ✅ Assignment tracking and history
- ✅ Bidding submission management
- ✅ Audit logging

### Dashboard & Analytics
- ✅ Real-time statistics
- ✅ Category-wise tender views
- ✅ Upload history tracking
- ✅ Workflow progress monitoring
- ✅ Location-based filtering
- ✅ Date range filtering

## Default Credentials
- **Username:** admin
- **Password:** admin

**⚠️ IMPORTANT:** Change default credentials in production!

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/auth/user` - Get current user

### Tenders
- `GET /api/tenders` - List all tenders
- `GET /api/tenders/status/:status` - Get tenders by status
- `POST /api/tenders/:id/override` - Override tender status
- `POST /api/upload` - Upload Excel file

### Team Management
- `GET /api/team-members` - List team members
- `POST /api/team-members` - Create team member
- `GET /api/me/team-member` - Get current user's team member profile

### Assignments
- `GET /api/assignments` - List all assignments
- `GET /api/assignments/my` - Get current user's assignments
- `POST /api/assignments` - Create assignment
- `POST /api/assignments/:id/stage` - Update workflow stage

## Security Features
- Bcrypt password hashing
- Session-based authentication
- CSRF protection
- Input validation
- SQL injection prevention
- Audit logging

## Performance Optimizations
- Background Excel processing
- Real-time progress updates via SSE
- Database indexing
- Query optimization
- Pagination for large datasets

## Monitoring
- Application logs via PM2
- Database connection monitoring
- Upload progress tracking
- Error handling and reporting

## Backup Strategy
- Regular PostgreSQL backups
- Environment configuration backup
- Application logs retention

## Support
For issues or questions, refer to the main README.md or create an issue in the repository.