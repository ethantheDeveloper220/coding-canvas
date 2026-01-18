const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
console.log(`Target: ${configPath}`);

let config = {};
try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (e) {
    console.log("Error reading file");
}

const newModels = {
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
    }
};

// Merge into root
if (!config.opencode) {
    config.opencode = newModels.opencode;
} else {
    if (!config.opencode.models) config.opencode.models = {};
    Object.assign(config.opencode.models, newModels.opencode.models);
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Successfully updated opencode.json");
