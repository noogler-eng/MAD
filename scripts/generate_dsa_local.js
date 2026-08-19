#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const topics = [
  { title: 'Arrays', file: 'arrays.md' },
  { title: 'Linked List', file: 'linked-list.md' },
  { title: 'Stack', file: 'stack.md' },
  { title: 'Queue', file: 'queue.md' },
  { title: 'Binary Tree', file: 'binary-tree.md' },
  { title: 'Binary Search Tree', file: 'binary-search-tree.md' },
  { title: 'Heap', file: 'heap.md' },
  { title: 'Hash Table', file: 'hash-table.md' },
  { title: 'Graph', file: 'graph.md' },
  { title: 'Sorting algorithms', file: 'sorting-algorithms.md' },
  { title: 'Dynamic Programming', file: 'dynamic-programming.md' },
  { title: 'Greedy algorithms', file: 'greedy-algorithms.md' }
];

const docsDir = path.join(process.cwd(), 'docs', 'dsa');
fs.mkdirSync(docsDir, { recursive: true });

function topicContent(title) {
  return `---
title: ${title}
---

${title} is a foundational DSA concept used to design efficient algorithms and reason about trade-offs.

## Big-O Summary

| Operation/Approach | Time Complexity | Space Complexity |
| --- | --- | --- |
| Best Case | O(?) | O(?) |
| Average Case | O(?) | O(?) |
| Worst Case | O(?) | O(?) |

## ASCII Diagram (Placeholder)

\`\`\`text
[ Add an ASCII diagram for ${title} here ]
\`\`\`

## Pseudocode

\`\`\`text
procedure solve(input):
  initialize data structure/state
  iterate through input
  update state based on ${title}
  return result
\`\`\`

\`\`\`text
procedure optimizedSolve(input):
  setup optimization strategy
  apply ${title}-specific transitions
  return optimized result
\`\`\`

## Worked Example

Input: [example input]

Step-by-step:
1. Initialize the required state.
2. Process each element using ${title} rules.
3. Track intermediate updates until termination.
4. Return the final output.

Output: [example output]

## Practice Problems

1. **Basic ${title} drill**
   - Prompt: Solve a beginner-friendly problem using ${title}.
   - Hint: Start with a brute-force solution, then optimize.

2. **Advanced ${title} application**
   - Prompt: Solve a constrained variant where performance matters.
   - Hint: Identify the key invariant before coding.
`;
}

let generatedCount = 0;
for (const topic of topics) {
  const filePath = path.join(docsDir, topic.file);
  fs.writeFileSync(filePath, topicContent(topic.title), 'utf8');
  generatedCount += 1;
}

console.log(`Generated ${generatedCount} DSA topic page(s) in docs/dsa`);
