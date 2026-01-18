const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('=== OpenCode GLM-4.7 Diagnostic ===\n');

// Check providers.json
const configPath = path.join(os.homedir(), '.config', 'opencode', 'providers.json');
console.log('1. Checking providers.json at:', configPath);

if (fs.existsSync(configPath)) {
    console.log('   ✓ File exists\n');

    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(content);

        console.log('2. Looking for GLM-4.7 configuration...\n');

        // Check for GLM models
        let foundGLM = false;
        for (const [providerKey, provider] of Object.entries(config)) {
            if (provider.models) {
                for (const [modelKey, model] of Object.entries(provider.models)) {
                    if (modelKey.includes('glm') || modelKey.includes('GLM')) {
                        foundGLM = true;
                        console.log(`   Found: ${providerKey}/${modelKey}`);
                        console.log(`   Name: ${model.name || 'N/A'}`);
                        console.log(`   Enabled: ${model.enabled !== false ? 'Yes' : 'No'}`);

                        // Check for API key
                        if (provider.apiKey) {
                            console.log(`   API Key: ${provider.apiKey.substring(0, 10)}...`);
                        } else if (provider.apiKeyEnv) {
                            const envKey = process.env[provider.apiKeyEnv];
                            console.log(`   API Key Env: ${provider.apiKeyEnv} (${envKey ? 'SET' : 'NOT SET'})`);
                        } else {
                            console.log('   ⚠️  API Key: NOT CONFIGURED');
                        }

                        // Check endpoint
                        if (provider.endpoint || provider.baseURL) {
                            console.log(`   Endpoint: ${provider.endpoint || provider.baseURL}`);
                        } else {
                            console.log('   ⚠️  Endpoint: NOT CONFIGURED');
                        }

                        console.log('');
                    }
                }
            }
        }

        if (!foundGLM) {
            console.log('   ❌ No GLM models found in providers.json\n');
            console.log('   Available providers:', Object.keys(config).join(', '));
            console.log('\n   To add GLM-4.7, you need to configure it in providers.json');
            console.log('   Example configuration:\n');
            console.log('   {');
            console.log('     "zai": {');
            console.log('       "name": "ZhipuAI",');
            console.log('       "endpoint": "https://open.bigmodel.cn/api/paas/v4",');
            console.log('       "apiKey": "YOUR_API_KEY_HERE",');
            console.log('       "models": {');
            console.log('         "glm-4.7-free": {');
            console.log('           "name": "GLM-4.7 Free",');
            console.log('           "enabled": true');
            console.log('         }');
            console.log('       }');
            console.log('     }');
            console.log('   }');
        }

        console.log('\n3. Full providers.json structure:');
        console.log(JSON.stringify(config, null, 2));

    } catch (error) {
        console.log('   ❌ Error reading/parsing file:', error.message);
    }
} else {
    console.log('   ❌ File does not exist\n');
    console.log('   You need to create:', configPath);
    console.log('   And configure your GLM-4.7 API credentials');
}

console.log('\n=== End Diagnostic ===');
