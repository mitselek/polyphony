#!/bin/bash
# Complexity assessment script for Polyphony development workflow
# Usage: ./github/scripts/check-complexity.sh <file1> [file2] ...

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> [file2] ..."
    echo "Example: $0 apps/vault/src/lib/server/db/roster.ts"
    exit 1
fi

echo "=== Polyphony Complexity Assessment ==="
echo ""

for file in "$@"; do
    if [ ! -f "$file" ]; then
        echo "⚠️  File not found: $file"
        echo ""
        continue
    fi

    # Basic metrics
    lines=$(wc -l < "$file")
    
    # Count functions (TypeScript/JavaScript)
    functions=$(grep -cE "^export (async )?function|^(async )?function|^\s+(async )?[a-zA-Z_]+\s*\(" "$file" 2>/dev/null || echo 0)
    
    # Count exported items
    exports=$(grep -c "^export " "$file" 2>/dev/null || echo 0)
    
    # Count imports
    imports=$(grep -c "^import " "$file" 2>/dev/null || echo 0)
    
    # Estimate nesting depth (opening braces)
    max_nesting=$(grep -o "{" "$file" | wc -l)
    
    # Count async/await usage
    async_count=$(grep -c "async\|await" "$file" 2>/dev/null || echo 0)
    
    # Count database queries
    db_queries=$(grep -c "\.prepare\|\.all\|\.first\|\.run" "$file" 2>/dev/null || echo 0)
    
    # Determine complexity rating
    complexity="Simple"
    recommend="Proceed ✅"
    
    if [ "$lines" -gt 400 ] || [ "$functions" -gt 15 ]; then
        complexity="HIGH"
        recommend="Refactor first 🔴"
    elif [ "$lines" -gt 200 ] || [ "$functions" -gt 8 ]; then
        complexity="Medium"
        recommend="Review with lead ⚠️"
    fi
    
    echo "📄 $file"
    echo "   Lines: $lines"
    echo "   Functions: ~$functions"
    echo "   Exports: $exports"
    echo "   Imports: $imports"
    echo "   Async operations: $async_count"
    echo "   DB queries: $db_queries"
    echo "   Complexity: $complexity"
    echo "   👉 $recommend"
    echo ""
done

echo "=== Complexity Thresholds ==="
echo "Simple:  <200 lines, <8 functions"
echo "Medium:  200-400 lines, 8-15 functions → Review"
echo "High:    >400 lines, >15 functions → Refactor"
