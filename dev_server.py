"""Tiny local dev server (standard library only).

Serves this folder as a static site and stands in for the serverless form endpoints:
POST /api/register and POST /api/contact append the JSON body to data/submissions.json
and reply {"ok": true}.

Run from this folder:  python dev_server.py 8765
"""
import json
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SUBMISSIONS = ROOT / "data" / "submissions.json"
ENDPOINTS = {"/api/register", "/api/contact"}
MAX_BODY = 64 * 1024
_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Always serve fresh files while developing.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        # Byte ranges, so videos can seek (the stdlib handler only serves whole files).
        rng = self.headers.get("Range", "")
        path = Path(self.translate_path(self.path))
        if not rng.startswith("bytes=") or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        start_s, _, end_s = rng[6:].split(",")[0].partition("-")
        try:
            start = int(start_s) if start_s else max(0, size - int(end_s))
            end = min(int(end_s), size - 1) if end_s and start_s else size - 1
        except ValueError:
            return super().send_head()
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        self._remaining = None
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path not in ENDPOINTS:
            return self._json(404, {"ok": False, "error": "Not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {"ok": False, "error": "Empty or oversized body"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json(400, {"ok": False, "error": "Body must be JSON"})
        if not isinstance(data, dict):
            return self._json(400, {"ok": False, "error": "Body must be a JSON object"})

        entry = {
            "endpoint": path,
            "receivedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "data": data,
        }
        with _lock:
            try:
                existing = json.loads(SUBMISSIONS.read_text(encoding="utf-8"))
                if not isinstance(existing, list):
                    existing = []
            except (FileNotFoundError, json.JSONDecodeError):
                existing = []
            existing.append(entry)
            SUBMISSIONS.write_text(json.dumps(existing, indent=2), encoding="utf-8")
        print(f"[submission] {path}: {json.dumps(data)[:300]}")
        return self._json(200, {"ok": True})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving {ROOT} at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
