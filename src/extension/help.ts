// src/extension/help.ts
import { PROMPT_VOICES, type PromptVoice } from "./prompts/voices";
import { AVAILABLE_REASONING_LEVELS } from "./constants";

export interface HelpCommand {
  command: string;
  aliases?: string[];
  description: string;
  content: string; // Markdown content
}

/**
 * Parses user input to check if it's a help command.
 * Returns the help content if it's a help command, null otherwise.
 */
export function parseHelpCommand(input: string): string | null {
  const trimmed = input.trim();
  
  // Check if it's a help command
  if (!trimmed.startsWith("--") && !trimmed.startsWith("-")) {
    return null;
  }
  
  // Extract command (handle --help, -h, etc.)
  const commandParts = trimmed.split(/\s+/);
  const command = commandParts[0]?.toLowerCase() || "";
  
  // Map commands to responses
  const helpMap = getHelpCommands();
  const matched = helpMap.find(cmd => 
    cmd.command === command || 
    cmd.aliases?.includes(command)
  );
  
  return matched ? matched.content : getMainHelpMenu();
}

function getHelpCommands(): HelpCommand[] {
  return [
    {
      command: "--help",
      aliases: ["-h", "help"],
      description: "Show help menu",
      content: getMainHelpMenu(),
    },
    {
      command: "--about",
      description: "About Docs Summarizer",
      content: getAboutContent(),
    },
    {
      command: "--errors",
      description: "Error explanations and troubleshooting",
      content: getErrorsContent(),
    },
    {
      command: "--features",
      aliases: ["--blur", "--feature"],
      description: "Feature descriptions",
      content: getFeaturesContent(),
    },
    {
      command: "--reasoning",
      description: "Reasoning levels explanation",
      content: getReasoningContent(),
    },
    {
      command: "--voices",
      description: "List all prompt voices",
      content: getVoicesListContent(),
    },
    {
      command: "--style",
      aliases: ["--styles", "--modifiers"],
      description: "Style modifier commands",
      content: getStyleCommandsContent(),
    },
    // Individual voice commands
    ...PROMPT_VOICES.map(voice => {
      const baseCommand: Omit<HelpCommand, "aliases"> = {
        command: `--${voice.id.replace(/_/g, "-")}`,
        description: voice.description,
        content: getVoiceDetailContent(voice),
      };
      // Conditionally add aliases only when defined
      if (voice.id.includes("_")) {
        return { ...baseCommand, aliases: [`--${voice.id}`] };
      }
      return baseCommand;
    }),
  ];
}

function getMainHelpMenu(): string {
  return `# Docs Summarizer Help

## Available Commands

### General
- \`--help\` or \`-h\` - Show this help menu
- \`--about\` - Learn about Docs Summarizer
- \`--errors\` - Error explanations and troubleshooting
- \`--features\` - Feature descriptions

### Settings
- \`--reasoning\` - Explanation of reasoning levels
- \`--voices\` - List all prompt voices
- \`--style\` - Style modifier commands

### Style Modifiers
- \`--N-paragraphs\` - Limit response to N paragraphs (e.g., \`--3-paragraphs\`)

### Prompt Voices
${PROMPT_VOICES.map(v => `- \`--${v.id.replace(/_/g, "-")}\` - ${v.description}`).join("\n")}

## Usage

Type any command in the chat input (e.g., \`--help\`) to get detailed information.
Style modifiers can be used with your question: "Explain React --3-paragraphs"

Commands are case-insensitive and can use either \`--\` or \`-\` prefix.
`;
}

function getAboutContent(): string {
  return `# About Docs Summarizer

Docs Summarizer is a Chrome extension that helps you understand and navigate web documentation using AI.

## Features

- **Smart Summarization**: Get AI-powered summaries of any web page
- **Interactive Chat**: Ask questions about the page content
- **Scroll Links**: AI-generated links that scroll to relevant sections
- **Multiple Voices**: Choose from different AI personas for different use cases
- **Detached Window**: Work in a separate window while keeping the original page open
- **Page Blur**: Focus mode to reduce distractions

## How It Works

1. Click the drawer handle on the right side of any page
2. Click "Summarize" to get an AI summary
3. Ask follow-up questions in the chat
4. Click scroll links to jump to relevant sections

## Privacy

- Your API key is stored locally in Chrome
- Page content is sent to OpenAI for processing
- No data is stored on external servers
`;
}

function getErrorsContent(): string {
  return `# Error Explanations

## Content Filter Errors

OpenAI's content filter is a safety system that blocks responses that may violate usage policies.

### What Triggers It?

- Historical articles about wars, conflicts, or sensitive events
- Prompts that might be interpreted as requesting harmful content
- Model responses containing flagged language
- Conversation context that builds up sensitive topics

### What to Do

1. **Rephrase your prompt**: Try different wording or break it into smaller questions
2. **Refresh the page**: Sometimes retrying works
3. **Summarize first**: Get a summary, then ask follow-up questions
4. **Check console**: Open DevTools (F12) for detailed error logs

### Important Notes

⚠️ The content filter cannot be bypassed - it's mandatory for safety
⚠️ The filter is inconsistent - the same prompt may work on retry

## Other Errors

### "Phrase Not Found"
The AI referenced text that doesn't exist on the page. This can happen when:
- The model generates scroll links to non-existent phrases
- Page content has changed
- The phrase uses slightly different wording

The link will automatically be converted to plain text, so you can still read the content.

### Connection Errors
If scroll links stop working:
- The main page may have been refreshed
- The detached window connection may have been lost
- Try clicking the link again
`;
}

function getFeaturesContent(): string {
  return `# Features

## Page Blur

The blur feature dims the main page content to help you focus on the AI responses.

**How to use**: Check the "Blur page" checkbox in the footer.

When enabled, the top and bottom portions of the page are blurred, creating a focus area around the drawer.

## Detached Window

Open the drawer in a separate window that you can position independently.

**How to use**: Click the "New Window" icon button.

**Features**:
- Works independently from the main page
- Maintains connection for scroll links
- State persists across refreshes
- Can be moved, resized, or positioned anywhere

## Scroll Links

AI-generated links that automatically scroll to relevant sections on the page.

**How it works**:
- The AI creates links like \`[Section Name](#scroll:exact phrase)\`
- Clicking a link scrolls to and highlights the matching text
- Links are validated before being made clickable

**Note**: If a phrase isn't found, the link becomes plain text.
`;
}

function getReasoningContent(): string {
  return `# Reasoning Levels

Reasoning effort controls how much the AI "thinks" before responding.

## Available Levels

${AVAILABLE_REASONING_LEVELS.map(level => `
### ${level.label}

${level.id === "low" 
  ? "Fast, cost-effective responses. Good for simple questions and summaries. Default setting."
  : "More thorough analysis. Better for complex questions requiring deeper understanding. Slower and uses more tokens."
}
`).join("\n")}

## When to Use Each

- **Low**: Most use cases - summaries, simple questions, quick explanations
- **Medium**: Complex topics, multi-step reasoning, detailed analysis

## Cost Impact

Higher reasoning levels use more tokens, which increases cost. Low reasoning is optimized for speed and cost.
`;
}

function getVoicesListContent(): string {
  return `# Prompt Voices

Prompt voices change how the AI responds to match different use cases and learning styles.

## Available Voices

${PROMPT_VOICES.map(voice => `
### ${voice.label}
**Description**: ${voice.description}

**Use when**: ${getVoiceUseCase(voice.id)}

**Command**: \`--${voice.id.replace(/_/g, "-")}\`
`).join("\n\n")}

## Learn More

Type \`--<voice-name>\` to get detailed information about any voice (e.g., \`--teacher\`, \`--simplifier\`).
`;
}

function getVoiceDetailContent(voice: PromptVoice): string {
  return `# ${voice.label}

**Description**: ${voice.description}

## When to Use

${getVoiceUseCase(voice.id)}

## Style Characteristics

${voice.instructions.split("\n").filter(line => line.trim()).slice(0, 5).join("\n")}

## Example Use Cases

${getVoiceExamples(voice.id)}
`;
}

function getStyleCommandsContent(): string {
  return `# Style Modifiers

Style modifiers change how the AI responds, allowing you to control the format of the response.

## Paragraph Limits

Use \`--N-paragraphs\` to control the length of the response:

- \`--1-paragraph\` - Single paragraph response
- \`--3-paragraphs\` - Exactly 3 paragraphs
- \`--5-paragraphs\` - Exactly 5 paragraphs

**Example**: "Summarize this page --3-paragraphs"

The response will be exactly the specified number of paragraphs. Do not exceed or fall short of this requirement.
`;
}

// Helper functions
function getVoiceUseCase(voiceId: string): string {
  const useCases: Record<string, string> = {
    default: "General use - balanced explanations with context",
    teacher: "Learning new concepts - step-by-step with encouragement",
    senior_engineer: "Technical deep dives - trade-offs and best practices",
    simplifier: "Complex topics - plain language, minimal jargon",
    organizer: "Structured learning - outlines, checklists, memory aids",
    socratic: "Active learning - questions to test understanding",
    in_depth: "Comprehensive analysis - detailed, expert-level explanations",
    mla_essay: "Academic writing - formal essay structure",
    technical_report: "Technical documentation - formal, structured",
    research_abstract: "Scientific content - concise, research-focused",
    retrieval_coach: "Active recall practice - quiz format with spaced repetition",
    visual_mapper: "Visual learners - concept maps and spatial organization",
    setup_guide: "Getting started - step-by-step setup instructions",
  };
  return useCases[voiceId] || "General purpose";
}

function getVoiceExamples(voiceId: string): string {
  const examples: Record<string, string> = {
    default: "Understanding a new framework, getting an overview of a topic, general questions",
    teacher: "Learning programming concepts, understanding complex algorithms, step-by-step tutorials",
    senior_engineer: "Code reviews, architecture decisions, best practices, trade-off analysis",
    simplifier: "Complex documentation, technical jargon, ESL-friendly explanations",
    organizer: "Study guides, exam prep, structured learning, memory retention",
    socratic: "Active learning, testing understanding, guided discovery",
    in_depth: "Research papers, detailed analysis, comprehensive explanations",
    mla_essay: "Academic writing, formal essays, research papers",
    technical_report: "Technical documentation, API references, formal reports",
    research_abstract: "Scientific papers, research summaries, academic content",
    retrieval_coach: "Active recall practice, quiz-based learning, exam prep",
    visual_mapper: "Concept mapping, spatial learning, visual organization",
    setup_guide: "Installation guides, getting started tutorials, project setup",
  };
  return examples[voiceId] || "See the voice description above for specific use cases.";
}

