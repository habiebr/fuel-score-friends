// Test script for update-actual-training endpoint
const USER_JWT = 'eyJhbGciOiJIUzI1NiIsImtpZCI6Ikw0TjFHQnoweGN4dXg2Y1giLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2VlY2RiZGRwendlZGZpY25wZW5tLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4YzIwMDZlMi01NTEyLTQ4NjUtYmEwNS02MThjZjIxNjFlYzEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwMTU1Mjk3LCJpYXQiOjE3NjAxNTE2OTcsImVtYWlsIjoiaGFiaWVicmFoYXJqb0BnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6Imdvb2dsZSIsInByb3ZpZGVycyI6WyJnb29nbGUiXSwicm9sZXMiOlsiYWRtaW4iXX0sInVzZXJfbWV0YWRhdGEiOnsiYXZhdGFyX3VybCI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0lqa19tTEV6cTJQNlN5VS1FdTcteF9KeWRiZjIyb2xoZWszYUc3aVBNNGpvMk9jYzZvPXM5Ni1jIiwiZW1haWwiOiJoYWJpZWJyYWhhcmpvQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiI0NSBNdWhhbW1hZCBIYXNoZnkgSGFiaWViIEF1c3RyYWxpYSIsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsIm5hbWUiOiI0NSBNdWhhbW1hZCBIYXNoZnkgSGFiaWViIEF1c3RyYWxpYSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0lqa19tTEV6cTJQNlN5VS1FdTcteF9KeWRiZjIyb2xoZWszYUc3aVBNNGpvMk9jYzZvPXM5Ni1jIiwicHJvdmlkZXJfaWQiOiIxMTQwMjU1NzE1NDg0NzAxNzU1MDgiLCJzdWIiOiIxMTQwMjU1NzE1NDg0NzAxNzU1MDgifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvYXV0aCIsInRpbWVzdGFtcCI6MTc2MDE1MTY5N31dLCJzZXNzaW9uX2lkIjoiZGVhNDAyMjMtMDg4My00NGU3LTllNWEtYjZjMjRlYWFkOGUzIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.0F8lXaf6yW-2LsW_3_7bjwVwHs8YL537z-zeDOHQNSY';
const SUPABASE_URL = 'https://eecdbddpzwedficnpenm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTYxODc2MTQsImV4cCI6MjAxMTc2MzYxNH0.CBlVVu41QWnrfJbh_-c5LUAh2L3zP5Xk_GXwq4Hoaag';

async function testUpdateActualTraining() {
  const today = new Date().toISOString().split('T')[0];
  
  console.log('Testing update-actual-training endpoint...');
  console.log('Date:', today);
  
  try {
    // Test 1: Update actual training
    console.log('\n1. Testing update actual training:');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${USER_JWT}`,
      'apikey': ANON_KEY,
      'Accept': 'application/json',
      'Origin': 'http://localhost:5173'
    };
    console.log('Request Headers:', headers);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-actual-training`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ date: today })
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', data);

  } catch (error) {
    console.error('Error:', error);
  }
}

testUpdateActualTraining();