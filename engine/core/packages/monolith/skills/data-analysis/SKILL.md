---
name: data-analysis
description: Profile, query and aggregate tabular data - CSV, TSV, Excel, JSON. Reports shape, types, nulls, outliers, correlations and top categories without writing throwaway scripts. Use before analysing or charting any dataset.
whenToUse: A dataset needs exploring, summarising, filtering or grouping, or you need to know whether it is clean before trusting it.
metadata:
  category: data
  version: 1.0.0
  license: MIT
---

# Explore tabular data

**Always start with `profile`.** It answers the questions that decide every
later step - how many rows, which columns are numeric, where the nulls are,
what correlates - before you commit to an analysis.

```bash
python "{{SKILL_DIR}}/scripts/analyze.py" profile sales.csv
```

That path is absolute and already correct - **use it exactly as written**.

## Commands

| Command | Use |
|---|---|
| `profile <data>` | shape, dtypes, nulls, duplicates, describe, correlations, top categories |
| `head <data> [--rows N]` | eyeball the actual rows |
| `column <data> <col>` | one column in depth - distribution or value counts |
| `query <data> "expr" [--cols a,b]` | filter with a pandas expression |
| `agg <data> --by col --value col --how sum` | group and aggregate |
| `export <data> out.xlsx` | hand the result to the user as a file |

Excel input works directly; add `--sheet NAME` for a specific sheet.

## Read the profile before believing the numbers

- **Nulls**: a column that is 40% empty cannot support a confident claim.
- **Duplicates**: reported up front, because they silently inflate every total.
- **Correlations** are printed at |r| >= 0.7. Correlation is not causation, and
  a strong r between two columns often just means one is derived from the other.
- **min/max** expose the impossible values - negative ages, 1970 dates,
  placeholder 999s - that quietly wreck an average.

## Reporting discipline

**Never state a number this tool did not print.** If a figure matters, run the
command that produces it and quote it. Estimating from a sample you glanced at
is how a confident, wrong answer gets shipped.

Say what the data cannot support. "The North leads on revenue, but 30% of rows
have no region, so treat the ranking as indicative" is a better answer than a
clean-looking table that hides the gap.

## Related

- `chart` to plot what you found
- `xlsx` to produce a workbook, `docx`/`pdf` to write it up
- `office-inspect` if the file will not load at all
