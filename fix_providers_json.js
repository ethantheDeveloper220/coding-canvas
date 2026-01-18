const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.config', 'opencode', 'providers.json');

const correctConfig = {
    "opencode": {
        "id": "opencode",
        "name": "OpenCode Models",
        "models": {
            "big-pickle": { "name": "Big Pickle", "id": "big-pickle" },
            "glm-4.7-free": { "name": "GLM 4.7 Free", "id": "glm-4.7-free" },
            "gpt-5-nano": { "name": "GPT-5 Nano", "id": "gpt-5-nano" },
            "grok-code": { "name": "Grok Code", "id": "grok-code" },
            "minimax-m2.1-free": { "name": "Minimax M2.1 Free", "id": "minimax-m2.1-free" }
        }
    },
    "openai": {
        "name": "OpenAI",
        "models": {
            "gpt-4o": { "name": "GPT-4o" },
            "gpt-5.1-codex-max": { "name": "GPT-5.1 Codex Max" },
            "gpt-5.1-codex-mini": { "name": "GPT-5.1 Codex Mini" },
            "gpt-5.2": { "name": "GPT-5.2" },
            "gpt-5.2-codex": { "name": "GPT-5.2 Codex" }
        }
    },
    "groq": {
        "name": "Groq",
        "models": {
            "llama3-70b-8192": { "name": "Llama 3 70B" },
            "mixtral-8x7b-32768": { "name": "Mixtral 8x7B" }
        }
    },
    "openrouter": {
        "name": "OpenRouter",
        "models": {
            "anthropic/claude-3.5-sonnet": { "name": "Claude 3.5 Sonnet" }
        }
    },
    "lmstudio": {
        "name": "LM Studio",
        "options": {
            "baseURL": "http://localhost:1234/v1"
        },
        "models": {
            "local-model": { "name": "Local Model" }
        }
    }
};

fs.writeFileSync(configPath, JSON.stringify(correctConfig, null, 2));
console.log("Fixed providers.json");
