---
name: xlsx
description: Create, edit, inspect and validate Excel .xlsx workbooks - trackers, budgets, models, exports. Handles formulas, multiple sheets and column sizing. Use for any spreamonolitheet request, including editing a workbook the user supplies.
whenToUse: The user wants a spreamonolitheet produced or modified, or wants to see what is inside one.
metadata:
  category: documents
  version: 1.0.0
  license: MIT
---

# Excel workbooks

One tool: `{{SKILL_DIR}}/scripts/xlsx_tool.py`. That path is absolute and
already correct - **use it exactly as written**, never shortened.

## Create

```bash
python "{{SKILL_DIR}}/scripts/xlsx_tool.py" create - sales.xlsx <<'JSON'
{"sheets": [
  {"name": "Sales",
   "headers": ["Region", "Q1", "Q2"],
   "rows": [["North", 120, 135], ["South", 90, 110]],
   "formulas": {"B4": "=SUM(B2:B3)", "C4": "=SUM(C2:C3)"}}
]}
JSON
```

Headers are bolded and frozen, an autofilter is applied, and columns are sized
to their content automatically.

## Formulas stay formulas

Write `"=SUM(B2:B10)"` and Excel evaluates it on open. **Never compute a total
yourself and write the number in.** That turns a live model into stale text, and
the user will not know until the figures silently stop updating.

`inspect` shows formulas; `inspect --values` shows the last cached results.

## Edit

```bash
python "{{SKILL_DIR}}/scripts/xlsx_tool.py" inspect theirs.xlsx
python "{{SKILL_DIR}}/scripts/xlsx_tool.py" edit theirs.xlsx out.xlsx - <<'JSON'
{"ops": [
  {"op": "set_cell", "sheet": "Sales", "ref": "B2", "value": 150},
  {"op": "append_row", "values": ["West", 60, 71]},
  {"op": "add_sheet", "name": "Notes", "headers": ["Item"], "rows": [["Reviewed"]]},
  {"op": "rename_sheet", "sheet": "Sheet1", "to": "Archive"}
]}
JSON
```

Omitting `sheet` targets the first sheet. Naming a sheet that does not exist
fails with the list of real sheet names.

## Numbers discipline

- Put one table per sheet. Two tables on one sheet break sorting and filtering.
- Keep raw data and presentation apart: a `Data` sheet feeding a `Summary` sheet
  beats a single sheet with totals wedged between the rows.
- Dates as real dates, not strings. Text dates will not sort.

## Reading data instead of editing it

For analysis - profiling, grouping, filtering, correlations - use the
`data-analysis` skill, which reads .xlsx directly. This skill is for producing
and modifying workbook files.

## Related

- `data-analysis` to explore the numbers, `chart` to plot them
- `office-repair` to recover sheets from a damaged workbook
