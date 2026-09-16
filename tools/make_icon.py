"""Draw icon.png, the marketplace icon.

Kept as a script rather than a committed-and-forgotten binary, so the icon can be
changed by editing numbers. No third-party dependencies: it rasterises a handful of
rounded rectangles with 4x4 supersampling and writes the PNG with zlib and struct.

Usage: python3 tools/make_icon.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIZE = 128
SUPERSAMPLE = 4
Colour = tuple[int, int, int]

BACKGROUND: Colour = (0x1C, 0x21, 0x28)
PANE: Colour = (0x2D, 0x33, 0x3B)
NEUTRAL: Colour = (0x76, 0x83, 0x90)
REMOVED: Colour = (0xF4, 0x70, 0x67)
ADDED: Colour = (0x57, 0xAB, 0x5A)


class Canvas:
    """A supersampled RGB canvas that only knows how to fill rounded rectangles."""

    def __init__(self, size: int, scale: int) -> None:
        self.size = size * scale
        self.scale = scale
        self.pixels: list[list[Colour]] = [
            [BACKGROUND] * self.size for _ in range(self.size)
        ]

    def rounded_rect(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
        radius: float,
        colour: Colour,
    ) -> None:
        s = self.scale
        left, top = x * s, y * s
        right, bottom = left + width * s, top + height * s
        # A radius past half the shorter side would make left+r exceed right-r, and the
        # clamp below would then collapse to a single point instead of tracing a corner.
        r = min(radius, width / 2, height / 2) * s
        for py in range(max(0, int(top)), min(self.size, int(bottom) + 1)):
            for px in range(max(0, int(left)), min(self.size, int(right) + 1)):
                # Clamp the point into the inner rectangle; outside the corners that
                # clamped point is the corner centre, so one distance test covers all four.
                cx = min(max(px + 0.5, left + r), right - r)
                cy = min(max(py + 0.5, top + r), bottom - r)
                dx, dy = px + 0.5 - cx, py + 0.5 - cy
                if dx * dx + dy * dy <= r * r:
                    self.pixels[py][px] = colour

    def downsample(self) -> list[list[Colour]]:
        s = self.scale
        out: list[list[Colour]] = []
        for y in range(self.size // s):
            row: list[Colour] = []
            for x in range(self.size // s):
                totals = [0, 0, 0]
                for sy in range(s):
                    for sx in range(s):
                        pixel = self.pixels[y * s + sy][x * s + sx]
                        for i in range(3):
                            totals[i] += pixel[i]
                count = s * s
                row.append((totals[0] // count, totals[1] // count, totals[2] // count))
            out.append(row)
        return out


def write_png(path: Path, rows: list[list[Colour]]) -> None:
    height, width = len(rows), len(rows[0])
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("3B", *pixel) for pixel in row) for row in rows
    )

    def chunk(kind: bytes, payload: bytes) -> bytes:
        body = kind + payload
        return (
            struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body))
        )

    header = struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def draw() -> list[list[Colour]]:
    # The canvas starts filled with BACKGROUND, and the PNG is truecolour with no alpha,
    # so the icon is a square by construction. Both marketplaces round it themselves.
    canvas = Canvas(SIZE, SUPERSAMPLE)
    # Two panes side by side with a few lines each: a diff, readable at 32px.
    for pane_x in (18.0, 68.0):
        canvas.rounded_rect(pane_x, 26, 42, 76, 7, PANE)

    left_lines: list[tuple[float, float, Colour]] = [
        (38, 22, NEUTRAL),
        (52, 26, REMOVED),
        (66, 18, NEUTRAL),
        (80, 24, NEUTRAL),
    ]
    right_lines: list[tuple[float, float, Colour]] = [
        (38, 22, NEUTRAL),
        (52, 26, ADDED),
        (66, 20, ADDED),
        (80, 16, NEUTRAL),
    ]
    for pane_x, lines in ((18.0, left_lines), (68.0, right_lines)):
        for y, length, colour in lines:
            canvas.rounded_rect(pane_x + 8, y, length, 6, 3, colour)
    return canvas.downsample()


if __name__ == "__main__":
    target = Path(__file__).resolve().parent.parent / "icon.png"
    write_png(target, draw())
    print(f"wrote {target}")
