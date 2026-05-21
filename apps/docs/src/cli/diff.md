# sedim diff

Show detailed line-by-line diffs for files that would be modified by a module install.

```bash
sedim diff <module>
```

**Example:**

```bash
sedim diff auth
```

For each file that would be modified, shows:
- `-` (red): lines that would be removed
- `+` (green): lines that would be added
- Dim lines: unchanged context around the changes

## Navigation

Press **Enter** to advance to the next file.
Press **q** to quit early.

This is the same output as `git diff` — familiar, scannable, and precise.

## Notes

`sedim diff` only shows modified files. New files that would be created are listed separately as `+ <path> (new file)`. Files with `overwriteStrategy: 'skip'` are never modified and won't appear.