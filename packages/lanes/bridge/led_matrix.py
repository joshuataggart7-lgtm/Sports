#!/usr/bin/env python3
"""
Lanes -> HUB75 LED matrix bridge for Raspberry Pi.

Streams frames from a running Lanes server and pushes them to real panels with
hzeller's rpi-rgb-led-matrix (https://github.com/hzeller/rpi-rgb-led-matrix).

    sudo pip3 install websockets pillow
    sudo python3 bridge/led_matrix.py --server ws://lanes.local:8787 --fps 30 \
        --rows 32 --cols 64 --chain 4 --parallel 2 --hardware-mapping adafruit-hat

Set matrix.width/height in lanes.yaml to cols*chain by rows*parallel so the renderer
draws at the panel's native resolution. Without the rgbmatrix module the bridge runs
in --preview mode and prints frame statistics so you can test the stream anywhere.

This file is untested on hardware in this repository; the frame protocol is simple:
one JSON header {"w","h","fps"} then binary frames of w*h*3 RGB bytes.
"""
import argparse
import asyncio
import json
import sys
import time

try:
    import websockets
except ImportError:
    sys.exit("pip install websockets")


def make_matrix(args, w, h):
    try:
        from rgbmatrix import RGBMatrix, RGBMatrixOptions  # type: ignore
    except ImportError:
        return None
    o = RGBMatrixOptions()
    o.rows = args.rows
    o.cols = args.cols
    o.chain_length = args.chain
    o.parallel = args.parallel
    o.hardware_mapping = args.hardware_mapping
    o.gpio_slowdown = args.gpio_slowdown
    o.brightness = args.brightness
    m = RGBMatrix(options=o)
    if m.width != w or m.height != h:
        print(f"warning: panel is {m.width}x{m.height} but Lanes renders {w}x{h}; set matrix in lanes.yaml", file=sys.stderr)
    return m


async def run(args):
    url = f"{args.server.rstrip('/')}/frames?fps={args.fps}"
    async with websockets.connect(url, max_size=None) as ws:
        header = json.loads(await ws.recv())
        w, h = header["w"], header["h"]
        print(f"connected: {w}x{h} @ {header['fps']}fps")
        matrix = None if args.preview else make_matrix(args, w, h)
        canvas = matrix.CreateFrameCanvas() if matrix else None
        if matrix:
            from PIL import Image
        n, t0 = 0, time.time()
        async for msg in ws:
            if isinstance(msg, str):
                continue
            if matrix:
                img = Image.frombytes("RGB", (w, h), bytes(msg))
                canvas.SetImage(img)
                canvas = matrix.SwapOnVSync(canvas)
            n += 1
            if n % (args.fps * 5) == 0:
                lit = sum(1 for i in range(0, len(msg), 3) if msg[i] or msg[i + 1] or msg[i + 2])
                print(f"{n} frames, {n / (time.time() - t0):.1f} fps, {lit} lit pixels in last frame")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--server", default="ws://localhost:8787")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--preview", action="store_true", help="no hardware, just count frames")
    p.add_argument("--rows", type=int, default=32)
    p.add_argument("--cols", type=int, default=64)
    p.add_argument("--chain", type=int, default=4)
    p.add_argument("--parallel", type=int, default=2)
    p.add_argument("--hardware-mapping", default="adafruit-hat")
    p.add_argument("--gpio-slowdown", type=int, default=2)
    p.add_argument("--brightness", type=int, default=70)
    a = p.parse_args()
    while True:
        try:
            asyncio.run(run(a))
        except KeyboardInterrupt:
            break
        except Exception as e:  # reconnect forever; the display should never stay dark
            print(f"disconnected: {e}; retrying in 2s", file=sys.stderr)
            time.sleep(2)
