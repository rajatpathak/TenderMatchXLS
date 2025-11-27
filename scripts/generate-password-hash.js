#!/usr/bin/env node

/**
 * Password Hash Generator for TenderMatch
 * 
 * Usage:
 *   node scripts/generate-password-hash.js <password>
 *   node scripts/generate-password-hash.js
 * 
 * If no password is provided, it will prompt for one.
 */

import bcrypt from 'bcrypt';
import readline from 'readline';

const SALT_ROUNDS = 12;

async function generateHash(password) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

async function promptPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter password to hash: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  let password = process.argv[2];

  if (!password) {
    password = await promptPassword();
  }

  if (!password || password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long');
    process.exit(1);
  }

  console.log('\n🔐 Generating bcrypt hash...\n');
  
  const hash = await generateHash(password);
  
  console.log('='.repeat(60));
  console.log('Your password hash (copy this to ADMIN_PASSWORD_HASH):');
  console.log('='.repeat(60));
  console.log(`\n${hash}\n`);
  console.log('='.repeat(60));
  console.log('\nAdd this to your .env file:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
