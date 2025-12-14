// src/extension/styleCommands.ts

export interface StyleCommand {
  type: 'paragraphs';
  value: number;
}

export interface ParsedUserInput {
  text: string; // User message with commands removed
  styleCommands: StyleCommand[]; // Extracted style commands
}

/**
 * Parses style commands from user input and removes them from the text
 * Examples:
 * - "Summarize this --3-paragraphs" → { text: "Summarize this", commands: [{type: 'paragraphs', value: 3}] }
 */
export function parseStyleCommands(input: string): ParsedUserInput {
  const commands: StyleCommand[] = [];
  let text = input;

  // Match --N-paragraphs or --N-paragraph (e.g., --3-paragraphs, --1-paragraph)
  const paragraphRegex = /--(\d+)-paragraphs?/gi;
  text = text.replace(paragraphRegex, (match, num) => {
    commands.push({ type: 'paragraphs', value: parseInt(num, 10) });
    return '';
  });

  // Clean up extra spaces
  text = text.replace(/\s+/g, ' ').trim();

  return { text, styleCommands: commands };
}

/**
 * Converts style commands into prompt instructions
 */
export function buildStyleInstructions(commands: StyleCommand[]): string {
  if (commands.length === 0) return '';

  const instructions: string[] = [];

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'paragraphs':
        instructions.push(
          `Your response must be exactly ${cmd.value} paragraph${cmd.value === 1 ? '' : 's'} long. ` +
          `Do not exceed or fall short of this requirement.`
        );
        break;
    }
  }

  return instructions.join('\n\n');
}

