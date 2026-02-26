import http.server
import socketserver
import json
import os
import io
import zipfile
import urllib.parse

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class AdminHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    # Allow CORS if needed for local development
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Endpoint 1: Save `data.json` globally
        if parsed_path.path == '/api/save':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data)
                
                with open(os.path.join(DIRECTORY, 'data.json'), 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "msg": "Saved directly to data.json"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "msg": str(e)}).encode('utf-8'))
            return
            
        self.send_error(404, "Endpoint not found")

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Endpoint 2: Export ZIP containing compiled local files + data
        if parsed_path.path == '/api/export':
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Disposition', 'attachment; filename="oc_universe_build.zip"')
            self.end_headers()
            
            memory_file = io.BytesIO()
            with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
                
                # 2.1 Fetch and package frontend dependencies
                files_to_package = [
                    'index.html',
                    'style.css',
                    'style_v2.css',
                    'js/app.js',
                    'data.json',
                    'themes/theme-ancient.css',
                    'themes/theme-cyberpunk.css',
                    'themes/theme-default.css',
                    'themes/theme-detective.css',
                    'themes/theme-fantasy.css',
                    'themes/theme-kamen-rubik.css',
                    'themes/theme-minimal.css',
                    'themes/theme-stationery.css'
                ]
                
                for file_path in files_to_package:
                    full_path = os.path.join(DIRECTORY, file_path)
                    if os.path.exists(full_path):
                        zf.write(full_path, file_path)
                        
                # 2.2 Re-package js/data.js by injecting the latest data memory directly
                data_js_path = os.path.join(DIRECTORY, 'js', 'data.js')
                if os.path.exists(data_js_path):
                    with open(data_js_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                        
                    with open(os.path.join(DIRECTORY, 'data.json'), 'r', encoding='utf-8') as dj:
                        data_json_text = dj.read()
                        
                    import re
                    # Intercept defaultOCData assignment to include fresh JSON safely using lambda to avoid regex escape issues
                    text = re.sub(r'const defaultOCData = [\s\S]*?(?=\n// 数据状态模块)', lambda _: f'const defaultOCData = {data_json_text};\n\n', text)
                    zf.writestr('js/data.js', text.encode('utf-8'))

                # 2.3 Traverse and Add `img/` folder
                img_dir = os.path.join(DIRECTORY, 'img')
                if os.path.exists(img_dir):
                    for root, dirs, files in os.walk(img_dir):
                        for file in files:
                            full_path = os.path.join(root, file)
                            arcname = os.path.relpath(full_path, DIRECTORY)
                            zf.write(full_path, arcname)

            self.wfile.write(memory_file.getvalue())
            return
            
        # Fallback to default static file serving
        return super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), AdminHTTPRequestHandler) as httpd:
        print(f"Server starting at http://localhost:{PORT}")
        print("Please open http://localhost:8000/admin.html to manage the OC Universe.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
