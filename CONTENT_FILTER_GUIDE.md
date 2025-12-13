# Content Filter Guide

## What is Content Filter?

OpenAI's content filter is a safety system that automatically blocks responses that may violate their usage policies. When triggered, the API returns `status: "incomplete"` with `reason: "content_filter"`.

## Why Does It Trigger?

The content filter can be triggered by:

1. **Page Content**: Historical articles, news, or documentation that mentions:
   - Violence, war, weapons
   - Sensitive political topics
   - Controversial historical events
   - Potentially harmful instructions

2. **User Prompts**: Requests that might be interpreted as asking for:
   - Harmful content
   - Instructions for dangerous activities
   - Content about sensitive topics

3. **Model Responses**: The model's generated text that:
   - Contains language that triggers safety filters
   - References sensitive topics in certain ways
   - Uses phrasing that matches filter patterns

4. **Conversation Context**: Previous messages in the conversation that:
   - Contain flagged content
   - Build up context that triggers filters
   - Reference sensitive topics repeatedly

## Important Notes

⚠️ **You cannot bypass or disable the content filter** - it's a mandatory safety feature.

⚠️ **The filter is inconsistent** - the same prompt may work on retry due to:
   - Non-deterministic model behavior
   - Filter sensitivity variations
   - API load/processing differences

## How to Debug Content Filter Issues

### 1. Check Browser Console

When a content filter error occurs, the extension now logs detailed information:

1. Open Chrome DevTools (F12)
2. Go to the **Console** tab
3. Look for error messages starting with `[Docs Summarizer] ⚠️ CONTENT FILTER TRIGGERED ⚠️`

The logs will show:
- **Partial response text**: What the model generated before the filter triggered
- **Input sent**: The last portion of the page text and instructions sent
- **Conversation history**: Previous messages that might have triggered the filter
- **Full response data**: Complete API response for analysis

### 2. Analyze the Partial Response

The partial response text shows what the model was trying to say before being cut off. Look for:
- Phrases that might trigger filters
- References to sensitive topics
- Language patterns that could be flagged

### 3. Check Conversation History

If the error occurs in a follow-up question, the previous conversation might be the trigger:
- Long conversations about sensitive topics can accumulate context
- Previous responses might contain flagged language
- The combination of history + new prompt might trigger the filter

## Workarounds and Solutions

### 1. Simplify Your Prompts

**Instead of:**
```
Write a compelling 10-paragraph essay regarding the information on this page, 
and what the world learned about this event. Cite all your sources at the end.
```

**Try:**
```
Summarize this page in 10 paragraphs. Include key takeaways.
```

**Why:** Shorter, simpler prompts are less likely to trigger filters.

### 2. Break Into Smaller Requests

Instead of one complex request, break it into parts:

1. First: "Summarize the main points of this page"
2. Then: "What are the key takeaways?"
3. Finally: "List the important dates mentioned"

**Why:** Smaller requests have less context and are less likely to trigger filters.

### 4. Avoid Sensitive Keywords

When possible, rephrase to avoid words that might trigger filters:
- "war" → "conflict" or "historical event"
- "weapons" → "military equipment" or "defense systems"
- "attack" → "event" or "incident"

**Note:** This isn't always possible with historical content, but can help.

### 5. Try Different Prompt Voices

Some prompt voices may phrase responses differently:
- Try "Technical Report" for more neutral language
- Try "Simplifier" for simpler phrasing
- Avoid voices that might use more dramatic language

### 6. Start Fresh Conversations

If follow-up questions keep triggering filters:
- Close the drawer and start a new conversation
- The accumulated context might be causing issues
- A fresh start resets the conversation context

### 7. Wait and Retry

Since the filter is inconsistent:
- Wait a few seconds and try the same prompt again
- The filter might not trigger on retry
- This is a known limitation of the current system

## Understanding the Logs

When content_filter triggers, you'll see logs like:

```
[Docs Summarizer] ⚠️ CONTENT FILTER TRIGGERED ⚠️
Partial response text (before filter): "The Cuban Missile Crisis was..."
Partial text length: 1234 chars
First 500 chars of partial response: ...
Last 500 chars of partial response: ...
```

**What to look for:**
- The last few words before the filter triggered
- Any phrases that might be sensitive
- Patterns in the text that could trigger filters

## When to Report Issues

If you consistently get content_filter errors for:
- Non-sensitive documentation pages
- Simple, neutral prompts
- Technical content without sensitive topics

This might indicate:
- A bug in the extension
- An issue with how content is being sent to OpenAI
- A problem with the OpenAI API itself

## Technical Details

### How the Extension Handles Content Filter

1. **Detection**: The extension checks for `status: "incomplete"` with `reason: "content_filter"`

2. **Partial Text Extraction**: Before throwing an error, the extension tries to extract any partial text that was generated

3. **Enhanced Logging**: Detailed logs are written to the console to help debug

4. **Error Display**: The error message includes:
   - Status and reason
   - Token usage (if available)
   - Partial response text (if available)
   - Full incomplete_details from OpenAI

### API Parameters That Might Help

Currently, the extension doesn't expose these, but OpenAI's API supports:

- **Moderation**: Some endpoints allow you to check content before sending
- **System Messages**: Adjusting system instructions might help
- **Temperature**: Lower temperature = more deterministic (but we don't control this)

**Note:** These are not guaranteed to help, as the content filter is mandatory.

## Future Improvements

Potential enhancements to reduce content_filter issues:

1. **Content Pre-filtering**: Check page text for sensitive content before sending
2. **Prompt Sanitization**: Automatically rephrase prompts to avoid triggers
3. **Conversation Truncation**: Limit conversation history for sensitive topics
4. **Retry Logic**: Automatically retry on content_filter with slight prompt variations
5. **User Warnings**: Warn users when page content might trigger filters

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [OpenAI Usage Policies](https://openai.com/policies/usage-policies)
- [OpenAI Safety Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)

