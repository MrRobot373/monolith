#!/usr/bin/env python3
"""Render a chart to PNG or SVG for embedding in a deck, doc or report.

    python chart.py - out.png < chart.json

Spec:
  {"type": "bar"|"barh"|"line"|"pie"|"scatter"|"stacked_bar",
   "title": "...", "xlabel": "...", "ylabel": "...",
   "labels": ["Q1","Q2","Q3"],
   "series": [{"name": "Revenue", "values": [1,2,3]}],
   "width": 10, "height": 5.5, "dpi": 160, "annotate": true}

One chart, one message. A chart with five series and no clear question is a
table wearing a costume — if the reader has to hunt for the point, split it.

Colours come from a fixed, colour-blind-safe sequence and gridlines sit behind
the data, so charts from different runs look like one family.
"""

import json
import sys
from pathlib import Path

try:
    import matplotlib
    matplotlib.use("Agg")  # No display on a server; must precede pyplot.
    import matplotlib.pyplot as plt
except ImportError:
    sys.exit("error: matplotlib is not installed. Run: python -m pip install matplotlib")

# Okabe-Ito: distinguishable with the common forms of colour blindness.
PALETTE = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#8C8C8C"]


def fail(message):
    sys.exit(f"error: {message}")


def read_json(source):
    raw = sys.stdin.read() if source == "-" else None
    if raw is None:
        try:
            raw = Path(source).read_text(encoding="utf-8")
        except OSError as exc:
            fail(f"cannot read {source}: {exc}")
    if not raw.strip():
        fail("no JSON received; pipe it in on stdin or pass a file path")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"input is not valid JSON: {exc}")


def series_values(spec):
    series = spec.get("series")
    if not isinstance(series, list) or not series:
        fail('"series" must be a non-empty list of {"name","values"}')
    for index, item in enumerate(series):
        if not isinstance(item, dict) or not isinstance(item.get("values"), list):
            fail(f'series[{index}] needs "values" as a list of numbers')
    return series


def annotate_bars(axes, bars, fmt="{:.figs}"):
    for bar in bars:
        height = bar.get_height()
        axes.annotate(f"{height:,.0f}", (bar.get_x() + bar.get_width() / 2, height),
                      ha="center", va="bottom", fontsize=8, xytext=(0, 2),
                      textcoords="offset points")


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: chart.py <chart.json|-> <out.png|out.svg>")
    spec, target = read_json(sys.argv[1]), sys.argv[2]
    if not isinstance(spec, dict):
        fail("the chart spec must be a JSON object")

    kind = spec.get("type", "bar")
    labels = spec.get("labels") or []
    series = series_values(spec)
    for index, item in enumerate(series):
        if labels and len(item["values"]) != len(labels):
            fail(f'series[{index}] has {len(item["values"])} values but there are '
                 f'{len(labels)} labels - they must match')

    figure, axes = plt.subplots(
        figsize=(float(spec.get("width", 9)), float(spec.get("height", 5))))
    axes.set_axisbelow(True)  # Gridlines behind the data, never over it.

    if kind == "pie":
        values = series[0]["values"]
        axes.pie(values, labels=labels or None, colors=PALETTE[:len(values)],
                 autopct="%1.0f%%", startangle=90, counterclock=False)
        axes.axis("equal")
    elif kind == "line":
        for index, item in enumerate(series):
            axes.plot(labels or range(len(item["values"])), item["values"],
                      marker="o", linewidth=2, color=PALETTE[index % len(PALETTE)],
                      label=item.get("name"))
        axes.grid(True, axis="y", alpha=0.3)
    elif kind == "scatter":
        for index, item in enumerate(series):
            xs = item.get("x") or list(range(len(item["values"])))
            axes.scatter(xs, item["values"], color=PALETTE[index % len(PALETTE)],
                         label=item.get("name"), s=38)
        axes.grid(True, alpha=0.3)
    elif kind in ("bar", "barh", "stacked_bar"):
        positions = range(len(labels or series[0]["values"]))
        if kind == "stacked_bar":
            bottom = [0] * len(series[0]["values"])
            for index, item in enumerate(series):
                axes.bar(positions, item["values"], bottom=bottom,
                         color=PALETTE[index % len(PALETTE)], label=item.get("name"))
                bottom = [b + v for b, v in zip(bottom, item["values"])]
            axes.set_xticks(list(positions), labels or None)
        elif kind == "barh":
            axes.barh(list(positions), series[0]["values"], color=PALETTE[0])
            axes.set_yticks(list(positions), labels or None)
            axes.invert_yaxis()
        else:
            width = 0.8 / len(series)
            for index, item in enumerate(series):
                offset = [p + index * width - 0.4 + width / 2 for p in positions]
                bars = axes.bar(offset, item["values"], width,
                                color=PALETTE[index % len(PALETTE)], label=item.get("name"))
                if spec.get("annotate") and len(series) == 1:
                    annotate_bars(axes, bars)
            axes.set_xticks(list(positions), labels or None)
        axes.grid(True, axis="x" if kind == "barh" else "y", alpha=0.3)
    else:
        fail(f"unknown chart type {kind!r}. Supported: bar, barh, line, pie, "
             "scatter, stacked_bar")

    if spec.get("title"):
        axes.set_title(str(spec["title"]), fontsize=13, pad=12)
    if spec.get("xlabel"):
        axes.set_xlabel(str(spec["xlabel"]))
    if spec.get("ylabel"):
        axes.set_ylabel(str(spec["ylabel"]))
    if len(series) > 1 and kind != "pie":
        axes.legend(frameon=False)
    for side in ("top", "right"):
        axes.spines[side].set_visible(False)

    out = Path(target).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    figure.tight_layout()
    try:
        figure.savefig(out, dpi=int(spec.get("dpi", 160)), bbox_inches="tight",
                       transparent=False, facecolor="white")
    except (OSError, ValueError) as exc:
        fail(f"cannot write {out}: {exc}")
    plt.close(figure)
    print(f"wrote {out} ({kind}, {len(series)} series)")


if __name__ == "__main__":
    main()
