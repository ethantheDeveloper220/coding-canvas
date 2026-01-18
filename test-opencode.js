// Test OpenCode Server
// Run this to check if OpenCode server is working

const testOpenCode = async () => {
    const apiUrl = 'http://localhost:52313';

    console.log('Testing OpenCode server at:', apiUrl);
    console.log('');

    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    try {
        const healthResponse = await fetch(`${apiUrl}/health`);
        console.log('   Status:', healthResponse.status);
        const healthText = await healthResponse.text();
        console.log('   Response:', healthText);
    } catch (e) {
        console.log('   Error:', e.message);
    }
    console.log('');

    // Test 2: Chat completions without auth
    console.log('2. Testing /v1/chat/completions without auth...');
    try {
        const response = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Hello' }],
                stream: false,
            }),
        });
        console.log('   Status:', response.status);
        const text = await response.text();
        console.log('   Response:', text.substring(0, 200));
    } catch (e) {
        console.log('   Error:', e.message);
    }
    console.log('');

    // Test 3: List available endpoints
    console.log('3. Testing root endpoint...');
    try {
        const response = await fetch(`${apiUrl}/`);
        console.log('   Status:', response.status);
        const text = await response.text();
        console.log('   Response:', text.substring(0, 200));
    } catch (e) {
        console.log('   Error:', e.message);
    }
};

testOpenCode().catch(console.error);
