#!/bin/bash
# Complexity assessment script for Polyphony development workflow
# Uses ESLint with complexity rules for accurate static analysis
# Usage: ./.github/scripts/check-complexity.sh <file1> [file2] ...

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> [file2] ..."
    echo "Example: $0 apps/vault/src/lib/server/db/roster.ts"
    exit 1
fi

echo "=== Polyphony Complexity Assessment (ESLint) ==="
echo ""

# Run ESLint on all files and capture JSON output
ESLINT_OUTPUT=$(npx eslint "$@" --format json 2>&1 || true)

# Check if ESLint failed completely
if [ $? -eq 2 ]; then
    echo "❌ ESLint configuration error:"
    echo "$ESLINT_OUTPUT"
    exit 1
fi

# Parse JSON output for each file
for file in "$@"; do
    if [ ! -f "$file" ]; then
        echo "⚠️  File not found: $file"
        echo ""
        continue
    fi

    # Basic metrics (still useful)
    lines=$(wc -l < "$file")
    exports=$(grep -c "^export " "$file" 2>/dev/null || echo 0)
    imports=$(grep -c "^import " "$file" 2>/dev/null || echo 0)
    
    # Extract ESLint results for this file
    FILE_RESULT=$(echo "$ESLINT_OUTPUT" | jq -r ".[] | select(.filePath | endswith(\"$file\"))" 2>/dev/null || echo "{}")
    
    if [ "$FILE_RESULT" = "{}" ]; then
        echo "⚠️  No ESLint analysis available for: $file"
        echo ""
        continue
    fi
    
    # Count complexity violations
    complexity_warnings=$(echo "$FILE_RESULT" | jq '[.messages[] | select(.ruleId == "complexity")] | length' 2>/dev/null || echo 0)
    max_lines_warnings=$(echo "$FILE_RESULT" | jq '[.messages[] | select(.ruleId == "max-lines-per-function")] | length' 2>/dev/null || echo 0)
    max_depth_warnings=$(echo "$FILE_RESULT" | jq '[.messages[] | select(.ruleId == "max-depth")] | length' 2>/dev/null || echo 0)
    max_statements_warnings=$(echo "$FILE_RESULT" | jq '[.messages[] | select(.ruleId == "max-statements")] | length' 2>/dev/null || echo 0)
    max_params_warnings=$(echo "$FILE_RESULT" | jq '[.messages[] | select(.ruleId == "max-params")] | length' 2>/dev/null || echo 0)
    
    total_warnings=$(echo "$FILE_RESULT" | jq '.warningCount' 2>/dev/null || echo 0)
    total_errors=$(echo "$FILE_RESULT" | jq '.errorCount' 2>/dev/null || echo 0)
    
    # Determine complexity rating based on ESLint results
    complexity="Simple"
    recommend="Proceed ✅"
    
    if [ "$total_errors" -gt 0 ] || [ "$complexity_warnings" -gt 3 ] || [ "$max_lines_warnings" -gt 3 ]; then
        complexity="HIGH"
        recommend="Refactor first 🔴"
    elif [ "$complexity_warnings" -gt 0 ] || [ "$max_lines_warnings" -gt 0 ] || [ "$lines" -gt 200 ]; then
        complexity="Medium"
        recommend="Review with lead ⚠️"
    fi
    
    echo "📄 $file"
    echo "   Lines: $lines"
    echo "   Exports: $exports"
    echo "   Imports: $imports"
    echo ""
    echo "   ESLint Complexity Analysis:"
    echo "   ├─ Cyclomatic complexity warnings: $complexity_warnings"
    echo "   ├─ Function length warnings: $max_lines_warnings"
    echo "   ├─ Nesting depth warnings: $max_depth_warnings"
    echo "   ├─ Statement count warnings: $max_statements_warnings"
    echo "   └─ Parameter count warnings: $max_params_warnings"
    echo ""
    echo "   Total ESLint warnings: $total_warnings"
    echo "   Total ESLint errors: $total_errors"
    echo ""
    echo "   Complexity: $complexity"
    echo "   👉 $recommend"
    
    # Show detailed warnings if any
    if [ "$total_warnings" -gt 0 ]; then
        echo ""
        echo "   ⚠️  Detailed warnings:"
        echo "$FILE_RESULT" | jq -r '.messages[] | "      \(.ruleId): \(.message) (line \(.line))"' 2>/dev/null | head -10
    fi
    
    echo ""
done

echo "=== Complexity Thresholds (ESLint Rules) ==="
echo "Cyclomatic complexity: max 10 (complexity rule)"
echo "Function length: max 50 lines (max-lines-per-function)"
echo "Nesting depth: max 4 levels (max-depth)"
echo "Statement count: max 15 per function (max-statements)"
echo "Parameter count: max 5 per function (max-params)"
echo ""
echo "Simple:  <200 lines, no ESLint warnings"
echo "Medium:  200-400 lines OR 1-3 warnings → Review"
echo "High:    >400 lines OR >3 warnings → Refactor"
