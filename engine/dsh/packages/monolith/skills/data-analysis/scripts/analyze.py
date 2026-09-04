#!/usr/bin/env python3
"""Profile and query tabular data (CSV, TSV, Excel) without writing throwaway code.

    python analyze.py profile  data.csv [--sheet Sheet1]
    python analyze.py head     data.csv [--rows 20]
    python analyze.py column   data.csv <column>
    python analyze.py query    data.csv "<pandas query expr>" [--cols a,b]
    python analyze.py agg      data.csv --by region --value revenue --how sum
    python analyze.py export   data.csv out.xlsx

Start with `profile`. It answers the questions that decide every later step —
how many rows, which columns are numeric, where the nulls are, what the
outliers look like — before you commit to an analysis.

Never report a number this tool did not print. If a figure matters, print it.
"""

import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    sys.exit("error: pandas is not installed. Run: python -m pip install pandas")


def fail(message):
    sys.exit(f"error: {message}")


def take_flag(args, name, default=None):
    if name in args:
        at = args.index(name)
        if at + 1 >= len(args):
            fail(f"{name} needs a value")
        return args[at + 1], args[:at] + args[at + 2:]
    return default, args


def load(path_str, sheet=None):
    path = Path(path_str)
    if not path.exists():
        fail(f"{path} does not exist")
    suffix = path.suffix.lower()
    try:
        if suffix in (".xlsx", ".xlsm"):
            return pd.read_excel(path, sheet_name=sheet or 0)
        if suffix == ".tsv":
            return pd.read_csv(path, sep="\t")
        if suffix == ".json":
            return pd.read_json(path)
        return pd.read_csv(path)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="latin-1")
    except Exception as exc:  # noqa: BLE001 - pandas raises many types
        fail(f"cannot read {path}: {exc}")


def show(frame, limit=20):
    with pd.option_context("display.max_columns", 40, "display.width", 200,
                           "display.max_rows", limit):
        print(frame.head(limit).to_string())


def cmd_profile(args):
    sheet, args = take_flag(args, "--sheet")
    if len(args) != 1:
        fail("usage: profile <data> [--sheet NAME]")
    frame = load(args[0], sheet)

    print(f"rows: {len(frame):,}   columns: {len(frame.columns)}")
    print(f"memory: {frame.memory_usage(deep=True).sum() / 1e6:.1f} MB")
    duplicates = frame.duplicated().sum()
    if duplicates:
        print(f"duplicate rows: {duplicates:,}")

    print("\n--- columns ---")
    for name in frame.columns:
        col = frame[name]
        nulls = col.isna().sum()
        share = f"{nulls / max(1, len(frame)):.0%}"
        unique = col.nunique(dropna=True)
        line = f"  {str(name)[:28]:<28} {str(col.dtype):<10} nulls={nulls:>6} ({share:>4}) unique={unique}"
        if pd.api.types.is_numeric_dtype(col) and col.notna().any():
            line += f"  min={col.min():g} max={col.max():g} mean={col.mean():.3g}"
        print(line)

    numeric = frame.select_dtypes("number")
    if not numeric.empty:
        print("\n--- numeric summary ---")
        print(numeric.describe().to_string())
        if numeric.shape[1] > 1:
            strong = []
            corr = numeric.corr(numeric_only=True)
            for i, a in enumerate(corr.columns):
                for b in corr.columns[i + 1:]:
                    value = corr.loc[a, b]
                    if pd.notna(value) and abs(value) >= 0.7:
                        strong.append(f"  {a} ~ {b}: {value:+.2f}")
            if strong:
                print("\n--- strong correlations (|r| >= 0.7) ---")
                print("\n".join(strong))

    # pandas 3 splits str out of "object"; ask for both so this works on 2 and 3.
    objects = frame.select_dtypes(exclude=["number", "datetime", "timedelta", "bool"])
    if not objects.empty:
        print("\n--- top categories ---")
        for name in objects.columns[:8]:
            counts = frame[name].value_counts().head(4)
            joined = ", ".join(f"{index}={value}" for index, value in counts.items())
            print(f"  {str(name)[:28]:<28} {joined}")


def cmd_head(args):
    rows, args = take_flag(args, "--rows", "20")
    sheet, args = take_flag(args, "--sheet")
    if len(args) != 1:
        fail("usage: head <data> [--rows N]")
    show(load(args[0], sheet), int(rows))


def cmd_column(args):
    sheet, args = take_flag(args, "--sheet")
    if len(args) != 2:
        fail("usage: column <data> <column>")
    frame = load(args[0], sheet)
    name = args[1]
    if name not in frame.columns:
        fail(f"no column {name!r}. Present: {', '.join(map(str, frame.columns))}")
    col = frame[name]
    print(f"column: {name}   dtype: {col.dtype}   nulls: {col.isna().sum()}")
    if pd.api.types.is_numeric_dtype(col):
        print(col.describe().to_string())
    else:
        print(col.value_counts().head(25).to_string())


def cmd_query(args):
    cols, args = take_flag(args, "--cols")
    sheet, args = take_flag(args, "--sheet")
    if len(args) != 2:
        fail('usage: query <data> "<expr>" [--cols a,b]')
    frame = load(args[0], sheet)
    try:
        result = frame.query(args[1])
    except Exception as exc:  # noqa: BLE001 - pandas raises many types
        fail(f"bad query {args[1]!r}: {exc}\n"
             f"Columns are: {', '.join(map(str, frame.columns))}")
    if cols:
        wanted = [c.strip() for c in cols.split(",")]
        missing = [c for c in wanted if c not in result.columns]
        if missing:
            fail(f"no such column(s): {', '.join(missing)}")
        result = result[wanted]
    print(f"matched {len(result):,} of {len(frame):,} rows")
    show(result)


def cmd_agg(args):
    by, args = take_flag(args, "--by")
    value, args = take_flag(args, "--value")
    how, args = take_flag(args, "--how", "sum")
    sheet, args = take_flag(args, "--sheet")
    if len(args) != 1 or not by:
        fail('usage: agg <data> --by COL [--value COL] [--how sum|mean|count|min|max]')
    frame = load(args[0], sheet)
    keys = [k.strip() for k in by.split(",")]
    for key in keys:
        if key not in frame.columns:
            fail(f"no column {key!r}. Present: {', '.join(map(str, frame.columns))}")
    grouped = frame.groupby(keys)
    if how == "count" or not value:
        result = grouped.size().rename("count").reset_index()
    else:
        if value not in frame.columns:
            fail(f"no column {value!r}")
        try:
            result = getattr(grouped[value], how)().reset_index()
        except AttributeError:
            fail(f"unknown --how {how!r}. Use sum, mean, count, min or max")
    show(result.sort_values(result.columns[-1], ascending=False), 30)


def cmd_export(args):
    sheet, args = take_flag(args, "--sheet")
    if len(args) != 2:
        fail("usage: export <data> <out.xlsx|out.csv>")
    frame = load(args[0], sheet)
    out = Path(args[1]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix.lower() in (".xlsx", ".xlsm"):
        frame.to_excel(out, index=False)
    else:
        frame.to_csv(out, index=False)
    print(f"wrote {out} ({len(frame):,} rows x {len(frame.columns)} cols)")


COMMANDS = {
    "profile": cmd_profile, "head": cmd_head, "column": cmd_column,
    "query": cmd_query, "agg": cmd_agg, "export": cmd_export,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: analyze.py <{'|'.join(COMMANDS)}> ...")
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
