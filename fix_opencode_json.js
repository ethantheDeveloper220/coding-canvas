const fs = require('fs');
const path = require('path');
const os = require('os');
const configPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');

const data = {
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
            "gpt-4-turbo": { "name": "gpt-5.1-codex-max" },
            "gpt-5.1-codex-mini": { "name": "gpt-5.1-codex-mini" },
            "gpt-5.2": { "name": "gpt-5.2" },
            "gpt-5.2-codex": { "name": "gpt-5.2-codex" },
            "gpt-3.5-turbo": { "name": "GPT-3.5 Turbo" }
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
            "anthropic/claude-3-opus": { "name": "Claude 3 Opus (Router)" },
            "anthropic/claude-3.5-sonnet": { "name": "Claude 3.5 Sonnet (Router)" }
        }
    },
    "lmstudio": {
        "name": "LM Studio",
        "models": {
            "local-model": { "name": "Local Model" }
        }
    },
    "autoupdate": true,
    "$schema": "https://opencode.ai/config.json"
};

fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
console.log("Fixed opencode.json with proper commas and structure.");
