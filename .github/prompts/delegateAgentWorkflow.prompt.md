---
name: delegateAgentWorkflow
description: Analyze task and recommend optimal delegation between main agent and subagent
argument-hint: The development task, feature, or issue to be implemented
---

# Agent Workflow Delegation Analysis

Analyze the specified task and recommend the optimal delegation strategy between main agent and subagent capabilities.

## Analysis Framework

Consider these characteristics:

**Subagent Strengths** (one-shot, stateless, research-focused):
- Deep codebase searches and pattern discovery
- Architecture analysis and data flow mapping
- Spec validation and requirement gathering
- Initial code review and issue detection
- Cross-file pattern analysis

**Main Agent Strengths** (iterative, stateful, implementation-focused):
- Iterative development with test feedback loops
- Multi-file changes with debugging
- Real-time user feedback and clarification
- Progressive implementation with checkpoints
- Test-driven development cycles

## Required Output

Provide a **structured workflow plan** that includes:

1. **Task Breakdown**: Decompose the task into discrete subtasks
2. **Agent Assignment**: For each subtask, specify:
   - Which agent (main/subagent)
   - Rationale based on task characteristics
   - Expected output/deliverable
3. **Workflow Sequence**: Define the order and dependencies
4. **Human Checkpoints**: Identify decision points requiring human supervision

## Example Format

```
Phase 1: Research (Subagent)
→ Task: "Search for similar implementations of X"
→ Output: Pattern report with code examples

Phase 2: Implementation (Main Agent)
→ Task: "Implement feature using discovered patterns"
→ Output: Working code with tests

Phase 3: Review (Subagent)
→ Task: "Analyze PR for issues"
→ Output: Review report

Phase 4: Refinement (Main Agent)
→ Task: "Address review feedback"
→ Output: Updated PR

Human Checkpoint: Final review before merge
```

Focus on **maximizing efficiency** while maintaining **visibility and control** for human oversight.
