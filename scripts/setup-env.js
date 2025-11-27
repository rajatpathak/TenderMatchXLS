#!/usr/bin/env node
import { randomBytes } from 'crypto';
import { hash } from 'bcrypt';
import { writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function setup() {
  console.log('\n========================================');
  console.log('  TenderMatch Environment Setup');
  console.log('========================================\n');

  if (existsSync('.env')) {
    const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      process.exit(0);
    }
  }

  // Database Configuration
  console.log('\n--- Database Configuration ---\n');
  const dbHost = await question('Database Host (default: localhost): ') || 'localhost';
  const dbPort = await question('Database Port (default: 5432): ') || '5432';
  const dbName = await question('Database Name (default: tendermatch): ') || 'tendermatch';
  const dbUser = await question('Database User: ');
  const dbPassword = await question('Database Password: ');

  if (!dbUser || !dbPassword) {
    console.error('\nError: Database user and password are required!');
    rl.close();
    process.exit(1);
  }

  const databaseUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;

  // Session Secret - Auto Generated
  const sessionSecret = randomBytes(32).toString('base64');
  console.log('\n[OK] Session secret generated automatically');

  // Admin Configuration
  console.log('\n--- Admin Configuration ---\n');
  const adminUsername = await question('Admin Username (default: admin): ') || 'admin';
  const adminEmail = await question('Admin Email (default: admin@tendermatch.com): ') || 'admin@tendermatch.com';
  const adminPassword = await question('Admin Password (min 8 chars): ');

  if (!adminPassword || adminPassword.length < 8) {
    console.error('\nError: Admin password must be at least 8 characters!');
    rl.close();
    process.exit(1);
  }

  // Generate password hash
  console.log('\nGenerating password hash...');
  const passwordHash = await hash(adminPassword, 12);
  console.log('[OK] Password hash generated');

  // Create .env content
  const envContent = `# ===========================================
# TenderMatch Production Environment
# Generated: ${new Date().toISOString()}
# ===========================================

# Database Configuration
DATABASE_URL=${databaseUrl}
PGHOST=${dbHost}
PGPORT=${dbPort}
PGUSER=${dbUser}
PGPASSWORD=${dbPassword}
PGDATABASE=${dbName}

# Session Configuration
SESSION_SECRET=${sessionSecret}

# Admin Authentication
ADMIN_USERNAME=${adminUsername}
ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD_HASH=${passwordHash}

# Application Configuration
NODE_ENV=production
PORT=5000
`;

  // Write .env file
  writeFileSync('.env', envContent, { mode: 0o600 });
  console.log('\n========================================');
  console.log('  .env file created successfully!');
  console.log('========================================');
  console.log('\nFile permissions set to 600 (owner read/write only)');
  console.log('\nNext steps:');
  console.log('  1. npm run db:push    # Push database schema');
  console.log('  2. npm run build      # Build for production');
  console.log('  3. npm start          # Start the server');
  console.log('\nLogin credentials:');
  console.log(`  Username: ${adminUsername}`);
  console.log('  Password: [the password you entered]');
  console.log('');

  rl.close();
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  rl.close();
  process.exit(1);
});
