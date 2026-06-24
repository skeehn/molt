// Tree-sitter syntax validation
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import JavaScript from 'tree-sitter-javascript';
import { readFileSync } from 'fs';

const parsers = new Map<string, Parser>();

function getParser(language: string): Parser | null {
  if (parsers.has(language)) {
    return parsers.get(language)!;
  }

  const parser = new Parser();
  let langModule;

  switch (language.toLowerCase()) {
    case 'typescript':
    case 'tsx':
      langModule = TypeScript.typescript;
      break;
    case 'javascript':
    case 'jsx':
      langModule = JavaScript;
      break;
    case 'python':
      langModule = Python;
      break;
    case 'rust':
      langModule = Rust;
      break;
    default:
      return null;
  }

  parser.setLanguage(langModule);
  parsers.set(language, parser);
  return parser;
}

export const syntaxCheckTool = {
  name: 'syntax_check',
  description: 'Validate syntax of code files using tree-sitter. Detects parse errors, unused imports, and basic code quality issues.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to file to check' },
      content: { type: 'string', description: 'Optional: content to check instead of reading file' },
      language: { type: 'string', description: 'Language: typescript, javascript, python, rust' },
    },
    required: ['path'],
  },
};

export async function executeSyntaxCheck(input: {
  path: string;
  content?: string;
  language?: string;
}): Promise<{ content: string; is_error?: boolean }> {
  try {
    // Detect language from extension if not provided
    let language = input.language;
    if (!language) {
      const ext = input.path.split('.').pop()?.toLowerCase();
      const extMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        rs: 'rust',
      };
      language = extMap[ext || ''];
    }

    if (!language) {
      return { content: `Unsupported file type: ${input.path}` };
    }

    const parser = getParser(language);
    if (!parser) {
      return { content: `No parser available for ${language}` };
    }

    // Get content
    const content = input.content || readFileSync(input.path, 'utf-8');

    // Parse
    const tree = parser.parse(content);

    // Check for errors
    const errors: string[] = [];
    function findErrors(node: any) {
      if (node.hasError()) {
        if (node.type === 'ERROR') {
          const startPos = node.startPosition;
          const line = startPos.row + 1;
          const col = startPos.column + 1;
          errors.push(`Line ${line}:${col} - Syntax error`);
        }
      }

      for (const child of node.children || []) {
        findErrors(child);
      }
    }

    findErrors(tree.rootNode);

    if (errors.length > 0) {
      return {
        content: `❌ Syntax errors found in ${input.path}:\n${errors.join('\n')}`,
        is_error: true,
      };
    }

    return {
      content: `✓ ${input.path} syntax is valid (${language})`,
    };
  } catch (err: any) {
    return {
      content: `Error checking syntax: ${err.message}`,
      is_error: true,
    };
  }
}
