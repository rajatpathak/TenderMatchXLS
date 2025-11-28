const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createAdminTeamMember() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tendermatch'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Hash password for admin
    const hashedPassword = await bcrypt.hash('admin', 10);

    // Check if admin exists
    const existing = await client.query('SELECT * FROM team_members WHERE username = $1', ['admin']);
    
    if (existing.rows.length > 0) {
      console.log('Admin team member already exists:', existing.rows[0].username);
      return;
    }
    
    // Insert admin team member
    const result = await client.query(`
      INSERT INTO team_members (username, password, email, full_name, role, is_active) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, username, full_name, role
    `, ['admin', hashedPassword, 'admin@company.com', 'Admin User', 'admin', true]);

    console.log('✅ Admin team member created:', result.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createAdminTeamMember();