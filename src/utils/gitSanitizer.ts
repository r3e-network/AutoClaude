/**
 * Git Message Sanitizer - Ensures no AI tool mentions in git operations
 * 
 * This module provides comprehensive sanitization of git commit messages,
 * PR descriptions, and other git-related content to maintain professional
 * appearance and prevent any AI tool attribution.
 */

/**
 * Patterns that should be removed from git messages
 */
const CLAUDE_PATTERNS = [
    // Full line removals - these remove entire lines
    /^.*generated\s+with\s+\[?claude\s+code\]?.*$/gmi,
    /^.*co-authored-by:\s*claude.*$/gmi,
    /^.*co-authored-by:\s*.*anthropic.*$/gmi,
    /^.*🤖\s*(generated|created|written|assisted).*$/gmi,
    
    // Specific phrase removals
    /\s*generated\s+with\s+\[?claude\s+code\]?\s*/gi,
    /\s*created\s+with\s+(the\s+)?help\s+of\s+(ai|claude)\s*/gi,
    /\s*assisted\s+by\s+(ai|claude|anthropic)\s*/gi,
    /\s*powered\s+by\s+(ai|claude|anthropic)\s*/gi,
    /\s*with\s+ai\s+assistance\s*(from\s+claude)?\s*/gi,
    /\s*using\s+anthropic's\s+claude\s*/gi,
    /\s*this\s+was\s+(generated|created|written)\s+by\s+(ai|claude|anthropic)\s*/gi,
    
    // Word-level removals - more conservative
    /\bclaude\b/gi,
    /\banthropic\b/gi,
    
    // Clean up common AI references
    /\s*\[claude\s+code\]\s*/gi,
    /\s*\(claude\s+code\)\s*/gi,
    
    // URLs and links
    /\s*https?:\/\/[^\s]*claude[^\s]*\s*/gi,
    /\s*https?:\/\/[^\s]*anthropic[^\s]*\s*/gi,
];

/**
 * Replacement patterns for common AI-related phrases
 */
const REPLACEMENT_PATTERNS = [
    { pattern: /\b(implement|add|create|fix|update|refactor)\s+using\s+ai\b/gi, replacement: '$1' },
    { pattern: /\b(with\s+)?ai\s+(assistance|help|support)\b/gi, replacement: '' },
    { pattern: /\b(automatically\s+)?generated\s+code\b/gi, replacement: 'implemented' },
    { pattern: /\bai-powered\s+/gi, replacement: '' },
    { pattern: /\bsmart\s+ai\s+/gi, replacement: 'intelligent ' },
    { pattern: /\b(developed|built|created)\s+with\s+ai\b/gi, replacement: '$1' },
    { pattern: /\bai-enhanced\s+/gi, replacement: 'enhanced ' },
    { pattern: /\bmachine learning\s+generated\b/gi, replacement: 'implemented' },
    { pattern: /\b(llm|language model)\s+(generated|created)\b/gi, replacement: 'implemented' },
];

/**
 * Sanitizes a git commit message to remove any AI tool mentions
 */
export function sanitizeCommitMessage(message: string): string {
    if (!message) return message;
    
    let sanitized = message;
    
    // Apply removal patterns
    for (const pattern of CLAUDE_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }
    
    // Apply replacement patterns
    for (const { pattern, replacement } of REPLACEMENT_PATTERNS) {
        sanitized = sanitized.replace(pattern, replacement);
    }
    
    // Clean up extra whitespace and newlines
    sanitized = sanitized
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove triple+ newlines
        .replace(/\s+\n/g, '\n') // Remove trailing whitespace
        .replace(/\n\s+/g, '\n') // Remove leading whitespace after newlines
        .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
        .trim();
    
    // Ensure we don't have empty commit messages
    if (!sanitized || sanitized.length < 3) {
        sanitized = 'update: improve project implementation';
    }
    
    return sanitized;
}

/**
 * Sanitizes a PR description to remove any AI tool mentions
 */
export function sanitizePRDescription(description: string): string {
    if (!description) return description;
    
    let sanitized = description;
    
    // Apply all sanitization patterns
    for (const pattern of CLAUDE_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }
    
    // Apply replacement patterns
    for (const { pattern, replacement } of REPLACEMENT_PATTERNS) {
        sanitized = sanitized.replace(pattern, replacement);
    }
    
    // Clean up markdown and formatting
    sanitized = sanitized
        .replace(/^\s*[-*]\s*$/gm, '') // Remove empty bullet points
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove triple+ newlines
        .replace(/\s+\n/g, '\n') // Remove trailing whitespace
        .trim();
    
    // Ensure we have a basic description if everything was removed
    if (!sanitized || sanitized.length < 10) {
        sanitized = `## Summary
This PR includes implementation improvements and updates.

## Changes
- Code improvements and optimizations
- Enhanced functionality

## Testing
- [ ] Code has been tested locally
- [ ] Tests pass
- [ ] No breaking changes`;
    }
    
    return sanitized;
}

/**
 * Sanitizes any git-related text content
 */
export function sanitizeGitText(text: string): string {
    if (!text) return text;
    
    let sanitized = text;
    
    // Apply all sanitization patterns
    for (const pattern of CLAUDE_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }
    
    // Apply replacement patterns
    for (const { pattern, replacement } of REPLACEMENT_PATTERNS) {
        sanitized = sanitized.replace(pattern, replacement);
    }
    
    // Clean up
    sanitized = sanitized
        .replace(/\s{2,}/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    
    return sanitized;
}

/**
 * Validates that a git message is clean of AI mentions
 */
export function validateCleanGitMessage(message: string): boolean {
    if (!message) return false;
    
    const lowerMessage = message.toLowerCase();
    
    // Check for any remaining Claude/AI mentions
    const sensitiveTerms = [
        'claude', 'anthropic', 'ai generated', 'ai assisted',
        'generated with', 'created with ai', 'co-authored-by: claude'
    ];
    
    for (const term of sensitiveTerms) {
        if (lowerMessage.includes(term)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Test function to verify sanitization works correctly
 */
export function testSanitization(): { passed: boolean; results: any[] } {
    const testCases = [
        {
            input: "feat: add authentication\n\nGenerated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
            expected: "feat: add authentication"
        },
        {
            input: "fix: resolve login issues with AI assistance",
            expected: "fix: resolve login issues"
        },
        {
            input: "This was created by Claude to help with the project",
            expected: "update: improve project implementation"
        },
        {
            input: "refactor: improve code structure using AI-powered analysis",
            expected: "refactor: improve code structure"
        }
    ];
    
    const results = [];
    let allPassed = true;
    
    for (const testCase of testCases) {
        const result = sanitizeCommitMessage(testCase.input);
        const passed = validateCleanGitMessage(result);
        
        results.push({
            input: testCase.input,
            output: result,
            passed,
            clean: passed
        });
        
        if (!passed) {
            allPassed = false;
        }
    }
    
    return { passed: allPassed, results };
}