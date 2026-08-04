#!/usr/bin/env python3
"""
Простий HTTP-сервер для гри «Кафе: Торти за часом»
Запуск: python3 server.py
Потім відкрий у браузері: http://localhost:8080
"""

import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Дозволяємо CORS і кеш-контроль для зручності розробки
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Чистіший лог
        print(f"[{self.log_date_time_string()}] {args[0]}")

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 50)
        print("  🥐 Кафе: Торти за часом — локальний сервер")
        print("=" * 50)
        print(f"  Сервер запущено: http://localhost:{PORT}")
        print(f"  Папка: {DIRECTORY}")
        print("  Натисни Ctrl+C щоб зупинити")
        print("=" * 50)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер зупинено.")
            sys.exit(0)
