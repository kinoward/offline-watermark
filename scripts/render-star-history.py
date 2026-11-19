"""Render pages from GitHub's /stargazers/history endpoint as a README chart."""

import json
import sys
from datetime import datetime, timedelta, timezone


def cumulative_history(pages):
    daily = []
    for page in pages:
        for week in page:
            utc_day = datetime.fromtimestamp(week["week"], timezone.utc).date()
            # A local Sunday boundary can fall on Saturday or Monday in UTC.
            sunday = utc_day + timedelta(days={5: 1, 6: 0, 0: -1}[utc_day.weekday()])
            for offset, count in enumerate(week["days"]):
                if count:
                    daily.append((sunday + timedelta(days=offset), count))

    total = 0
    for day, count in sorted(daily):
        total += count
        yield day, total


def render(history):
    description = "No stars recorded."
    if history:
        first, last = history[0][0], history[-1][0]
        total = history[-1][1]
        period = f"on {last}" if first == last else f"from {first} through {last}"
        description = f"Stars received {period}: {total}."
    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="680" height="220" '
        'viewBox="0 0 680 220" role="img" aria-labelledby="title desc">',
        '<title id="title">GitHub star history</title>',
        f'<desc id="desc">{description}</desc>',
        '''<style>
  svg { font: 13px system-ui, sans-serif; color: #424a53; }
  text { fill: currentColor; }
  .grid { stroke: #d1d9e0; }
  .line { fill: none; stroke: #0969da; stroke-width: 3; }
  .point { fill: #0969da; }
  @media (prefers-color-scheme: dark) {
    svg { color: #c9d1d9; }
    .grid { stroke: #3d444d; }
    .line { stroke: #58a6ff; }
    .point { fill: #58a6ff; }
  }
</style>''',
    ]
    if not history:
        svg.append('<text x="340" y="110" text-anchor="middle">No stars recorded.</text>')
        return "\n".join([*svg, "</svg>"])

    left, right, top, bottom = 60, 632, 30, 165
    step = (total + 4) // 5
    ceiling = ((total + step - 1) // step) * step
    span = (last - first).days

    def x(day):
        if span == 0:
            return (left + right) / 2
        return left + (right - left) * (day - first).days / span

    def y(count):
        return bottom - (bottom - top) * count / ceiling

    svg.append(f'<text x="{left}" y="18">Stars</text>')
    for tick in range(0, ceiling + 1, step):
        height = y(tick)
        svg.append(f'<path class="grid" d="M {left} {height:.2f} H {right}"/>')
        svg.append(f'<text x="{left - 8}" y="{height + 4:.2f}" text-anchor="end">{tick}</text>')

    if span:
        path = [f"M {left} {y(history[0][1]):.2f}"]
        path.extend(f"H {x(day):.2f} V {y(count):.2f}" for day, count in history[1:])
        svg.append(f'<path class="line" d="{" ".join(path)}"/>')
    svg.append(f'<circle class="point" cx="{x(last):.2f}" cy="{y(total):.2f}" r="4.5"/>')

    # Keep both endpoints and label intermediate dates only when they fit.
    previous = left
    for day, _ in history:
        position = x(day)
        if day in (first, last) or (position - previous >= 95 and right - position >= 95):
            svg.append(f'<path class="grid" d="M {position:.2f} {bottom} v 5"/>')
            svg.append(f'<text x="{position:.2f}" y="{bottom + 21}" text-anchor="middle">{day}</text>')
            previous = position
    svg.append(f'<text x="{(left + right) // 2}" y="211" text-anchor="middle">Date</text>')
    return "\n".join([*svg, "</svg>"])


if __name__ == "__main__":
    print(render(list(cumulative_history(json.load(sys.stdin)))))
