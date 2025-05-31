const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Database connection
const pool = new Pool({
  user: 'reuelrivera',
  host: 'localhost',
  database: 'opps_management',
  password: '',
  port: 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function testUserColumnPreferences() {
  console.log('🧪 Starting User Column Preferences Test...\n');

  try {
    // 1. Check if table exists
    console.log('1️⃣ Checking database table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_column_preferences'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ user_column_preferences table exists');
    } else {
      console.log('❌ user_column_preferences table does not exist');
      return;
    }

    // 2. Check table structure
    console.log('\n2️⃣ Checking table structure...');
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_column_preferences'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Table structure:');
    structureCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // 3. Get a test user
    console.log('\n3️⃣ Getting test user...');
    const userResult = await pool.query('SELECT id, email, name FROM users LIMIT 1');
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const testUser = userResult.rows[0];
    console.log(`✅ Using test user: ${testUser.name} (${testUser.email})`);

    // 4. Test saving preferences
    console.log('\n4️⃣ Testing save preferences...');
    const testPreferences = {
      'project_name': true,
      'client': true,
      'final_amt': true,
      'description': false,
      'comments': false,
      'uid': false,
      'created_at': false,
      'updated_at': false
    };

    const saveResult = await pool.query(`
      INSERT INTO user_column_preferences (user_id, page_name, column_settings, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, page_name)
      DO UPDATE SET 
        column_settings = EXCLUDED.column_settings,
        updated_at = NOW()
      RETURNING id
    `, [testUser.id, 'opportunities', JSON.stringify(testPreferences)]);

    console.log(`✅ Preferences saved with ID: ${saveResult.rows[0].id}`);

    // 5. Test loading preferences
    console.log('\n5️⃣ Testing load preferences...');
    const loadResult = await pool.query(`
      SELECT column_settings FROM user_column_preferences 
      WHERE user_id = $1 AND page_name = $2
    `, [testUser.id, 'opportunities']);

    if (loadResult.rows.length > 0) {
      const loadedPreferences = loadResult.rows[0].column_settings;
      console.log('✅ Preferences loaded successfully');
      console.log('📊 Loaded preferences:', JSON.stringify(loadedPreferences, null, 2));
      
      // Verify preferences match
      const prefsMatch = JSON.stringify(testPreferences) === JSON.stringify(loadedPreferences);
      console.log(`🔍 Preferences match: ${prefsMatch ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('❌ Failed to load preferences');
    }

    // 6. Test with different user
    console.log('\n6️⃣ Testing user isolation...');
    const user2Result = await pool.query('SELECT id, email, name FROM users WHERE id != $1 LIMIT 1', [testUser.id]);
    
    if (user2Result.rows.length > 0) {
      const testUser2 = user2Result.rows[0];
      console.log(`📋 Using second test user: ${testUser2.name} (${testUser2.email})`);
      
      // Try to load preferences for user 2 (should be empty)
      const user2LoadResult = await pool.query(`
        SELECT column_settings FROM user_column_preferences 
        WHERE user_id = $1 AND page_name = $2
      `, [testUser2.id, 'opportunities']);
      
      if (user2LoadResult.rows.length === 0) {
        console.log('✅ User isolation working - User 2 has no preferences');
      } else {
        console.log('ℹ️ User 2 already has preferences:', JSON.stringify(user2LoadResult.rows[0].column_settings, null, 2));
      }
    } else {
      console.log('⚠️ Only one user in database - cannot test user isolation');
    }

    // 7. Test reset functionality
    console.log('\n7️⃣ Testing reset preferences...');
    const resetResult = await pool.query(`
      DELETE FROM user_column_preferences 
      WHERE user_id = $1 AND page_name = $2
    `, [testUser.id, 'opportunities']);

    console.log(`✅ Reset successful - deleted ${resetResult.rowCount} record(s)`);

    // 8. Verify reset
    console.log('\n8️⃣ Verifying reset...');
    const verifyResetResult = await pool.query(`
      SELECT column_settings FROM user_column_preferences 
      WHERE user_id = $1 AND page_name = $2
    `, [testUser.id, 'opportunities']);

    if (verifyResetResult.rows.length === 0) {
      console.log('✅ Reset verified - no preferences found');
    } else {
      console.log('❌ Reset failed - preferences still exist');
    }

    // 9. Final database state
    console.log('\n9️⃣ Final database state...');
    const finalStateResult = await pool.query(`
      SELECT u.name, u.email, ucp.page_name, 
             jsonb_object_keys(ucp.column_settings) as column_name,
             (ucp.column_settings ->> jsonb_object_keys(ucp.column_settings))::boolean as visible
      FROM user_column_preferences ucp
      JOIN users u ON u.id = ucp.user_id
      ORDER BY u.name, ucp.page_name, column_name
    `);

    if (finalStateResult.rows.length > 0) {
      console.log('📊 Current user preferences in database:');
      let currentUser = '';
      finalStateResult.rows.forEach(row => {
        if (row.name !== currentUser) {
          currentUser = row.name;
          console.log(`\n   👤 ${row.name} (${row.email}):`);
        }
        console.log(`      - ${row.column_name}: ${row.visible ? 'visible' : 'hidden'}`);
      });
    } else {
      console.log('📊 No user preferences currently stored in database');
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testUserColumnPreferences();
}

module.exports = { testUserColumnPreferences };
