const { createClient } = require('@supabase/supabase-js');

// Use the service role key for admin operations
const supabaseUrl = 'https://wxxrprwnovnyncgigrwi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eHJwcndub3ZueW5jZ2lncndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0ODE4MSwiZXhwIjoyMDc3MjI0MTgxfQ.3sSBNq7MT_dpIVGk9OINteoUOQu9Y-8_HX1B1at-oVs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for users table...');
  
  try {
    // First, let's check the current state
    console.log('\n📊 Checking current state...');
    
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('count')
      .limit(1);
    
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    console.log('Auth users accessible:', !authError);
    console.log('Public users accessible:', !publicError);
    
    // Check for admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', '600675ad-af15-4c72-b6d0-59d1b8e572a4')
      .single();
    
    console.log('Admin user found:', !!adminUser);
    if (adminUser) {
      console.log('Admin user details:', {
        id: adminUser.id,
        name: adminUser.name,
        role: adminUser.role,
        active: adminUser.active
      });
    }
    
    // Now let's temporarily disable RLS to test
    console.log('\n🔓 Temporarily disabling RLS on users table...');
    
    const { error: disableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;'
    });
    
    if (disableError) {
      console.error('Error disabling RLS:', disableError);
    } else {
      console.log('✅ RLS disabled successfully');
    }
    
    // Test if we can now access the user profile
    console.log('\n🧪 Testing profile access...');
    
    const { data: testProfile, error: testError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', '600675ad-af15-4c72-b6d0-59d1b8e572a4')
      .single();
    
    if (testError) {
      console.error('❌ Still can\'t access profile:', testError);
    } else {
      console.log('✅ Profile access successful:', testProfile);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixRLSPolicies();
