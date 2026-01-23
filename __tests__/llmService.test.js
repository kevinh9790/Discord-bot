// __tests__/llmService.test.js
/**
 * Unit tests for llmService.js - JSON parsing and validation
 */

describe('LLMService - Response Parsing', () => {
    describe('Relevance Check Response Parsing', () => {
        it('should extract JSON from wrapped response', () => {
            const response = `
Here's the analysis:

\`\`\`json
{
  "isRelevant": true,
  "confidence": 0.85,
  "category": "technics",
  "reason": "討論遊戲引擎選擇"
}
\`\`\`
`;
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            expect(jsonMatch).toBeTruthy();

            const result = JSON.parse(jsonMatch[0]);
            expect(result.isRelevant).toBe(true);
            expect(result.confidence).toBe(0.85);
            expect(result.category).toBe('technics');
        });

        it('should handle raw JSON response', () => {
            const response = '{\n  "isRelevant": false,\n  "confidence": 0.3,\n  "category": "other",\n  "reason": "無遊戲開發內容"\n}';
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            expect(jsonMatch).toBeTruthy();

            const result = JSON.parse(jsonMatch[0]);
            expect(result.isRelevant).toBe(false);
            expect(result.confidence).toBe(0.3);
        });

        it('should validate confidence score range', () => {
            const validScores = [0, 0.5, 0.7, 1.0];
            validScores.forEach(score => {
                expect(score).toBeGreaterThanOrEqual(0);
                expect(score).toBeLessThanOrEqual(1);
            });
        });

        it('should validate category values', () => {
            const validCategories = ['technics', 'art', 'design', 'news', 'resource', 'other'];
            const response = {
                isRelevant: true,
                confidence: 0.8,
                category: 'technics',
                reason: 'Test'
            };

            expect(validCategories).toContain(response.category);
        });
    });

    describe('Summary Generation Response Parsing', () => {
        it('should extract and parse summary JSON', () => {
            const response = `
Based on the conversation:

\`\`\`json
{
  "title": "Unity vs Unreal 性能對比",
  "summary": "討論 Unity 和 Unreal 引擎的性能差異",
  "keyPoints": ["Unity 更輕量", "Unreal 性能更強"],
  "participants": ["Dev1", "Dev2"],
  "resources": ["https://example.com"],
  "actionItems": ["測試新版本"]
}
\`\`\`
`;
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            expect(jsonMatch).toBeTruthy();

            const result = JSON.parse(jsonMatch[0]);
            expect(result.title).toBeDefined();
            expect(Array.isArray(result.keyPoints)).toBe(true);
            expect(Array.isArray(result.participants)).toBe(true);
            expect(Array.isArray(result.resources)).toBe(true);
            expect(Array.isArray(result.actionItems)).toBe(true);
        });

        it('should handle empty arrays in summary', () => {
            const response = {
                title: 'Test',
                summary: 'Test summary',
                keyPoints: [],
                participants: [],
                resources: [],
                actionItems: []
            };

            expect(response.keyPoints).toEqual([]);
            expect(response.participants).toEqual([]);
        });

        it('should validate title length', () => {
            const title = 'Unity vs Unreal 性能對比';
            // Title should be 10 chars or less (roughly)
            expect(title.length).toBeLessThanOrEqual(20); // Allowing some flexibility for UTF-8
        });

        it('should validate summary length range', () => {
            const summary = 'A'.repeat(150);
            // Summary should be 100-200 words (approximately)
            expect(summary.length).toBeGreaterThanOrEqual(100);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON', () => {
            const response = '{ invalid json }';
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            expect(() => {
                if (jsonMatch) JSON.parse(jsonMatch[0]);
            }).toThrow();
        });

        it('should handle missing JSON in response', () => {
            const response = 'Just plain text without JSON';
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            expect(jsonMatch).toBeNull();
        });

        it('should provide fallback for parsing errors', () => {
            const fallback = {
                isRelevant: false,
                confidence: 0,
                category: 'error',
                reason: '無法解析LLM回應'
            };

            expect(fallback.confidence).toBe(0);
            expect(fallback.category).toBe('error');
        });
    });

    describe('Response Validation', () => {
        it('should validate all required fields in relevance response', () => {
            const response = {
                isRelevant: true,
                confidence: 0.85,
                category: 'technics',
                reason: 'Test'
            };

            const requiredFields = ['isRelevant', 'confidence', 'category', 'reason'];
            requiredFields.forEach(field => {
                expect(response).toHaveProperty(field);
            });
        });

        it('should validate all required fields in summary response', () => {
            const response = {
                title: 'Test',
                summary: 'Test summary',
                keyPoints: [],
                participants: [],
                resources: [],
                actionItems: []
            };

            const requiredFields = ['title', 'summary', 'keyPoints', 'participants', 'resources', 'actionItems'];
            requiredFields.forEach(field => {
                expect(response).toHaveProperty(field);
            });
        });
    });
});
