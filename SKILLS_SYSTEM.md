# Skills System

The skills system allows grain to learn from successful problem-solving and reuse patterns.

## Structure

```
src/skills/
├── types.ts       - TypeScript interfaces for skills
├── manager.ts     - SkillManager class for loading, matching, executing
└── index.ts       - Public exports

~/.grain/skills/   - JSON files containing learned skills
```

## Skill Format

Skills are stored as JSON files in `~/.grain/skills/`:

```json
{
  "id": "uuid",
  "name": "Skill Name",
  "description": "What this skill does",
  "pattern": {
    "regex": ["pattern1", "pattern2"],
    "keywords": ["keyword1", "keyword2"],
    "semantic": "semantic description for matching"
  },
  "approach": "Markdown steps to execute",
  "code": ["command1", "command2"],
  "examples": [
    {
      "problem": "User's problem",
      "execution": "What was done",
      "outcome": "Result",
      "timestamp": "ISO date"
    }
  ],
  "metadata": {
    "times_used": 3,
    "success_rate": 1.0,
    "created_at": "ISO date",
    "last_used": "ISO date",
    "updated_at": "ISO date",
    "tags": ["tag1", "tag2"],
    "complexity": 2
  }
}
```

## Usage

```typescript
import { SkillManager } from './skills';

const manager = new SkillManager();
await manager.initialize();

// Match skills against user input
const matches = await manager.matchSkills('setup tests');
if (matches.length > 0) {
  console.log(`Found skill: ${matches[0].skill.name}`);
}

// Create a new skill
await manager.createSkill({
  name: 'My Skill',
  description: 'Does something useful',
  pattern: {
    keywords: ['keyword1', 'keyword2'],
    semantic: 'semantic description'
  },
  approach: '# Steps\n1. Do this\n2. Do that',
  example: {
    problem: 'User asked...',
    execution: 'I did...',
    outcome: 'Success!'
  },
  tags: ['tag1']
});

// Record execution
await manager.recordExecution(skillId, true, {
  problem: 'New problem',
  execution: 'What was done',
  outcome: 'Result'
});
```

## Matching Algorithm

Skills are matched using three strategies:

1. **Regex** - Match input against regex patterns (confidence: 0.9)
2. **Keywords** - Match keywords in input (confidence: 0.7-0.95)
3. **Semantic** - Word overlap with semantic description (confidence: 0.5-0.85)

Results are sorted by confidence and filtered by threshold (default: 0.6).

## Next Steps

- [ ] Wire into agent loop to suggest skills
- [ ] Add "save as skill" prompt after successful executions
- [ ] Implement semantic matching with embeddings
- [ ] Add CLI commands for managing skills
- [ ] Add skill validation and testing
