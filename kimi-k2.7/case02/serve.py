#!/usr/bin/env python3
"""Tiny local HTTP server for viewing the sandbox at http://localhost:8765/"""
import http.server
import socketserver
import webbrowser

PORT = 8765

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/"
        print(f"Serving at {url}")
        print("Press Ctrl+C to stop")
        webbrowser.open(url)
        httpd.serve_forever()
