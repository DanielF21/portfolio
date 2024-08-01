from http.server import BaseHTTPRequestHandler
import json
from scheme_interp import interpret  # Import your interpreter function

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        code = data.get('code', '')
        
        try:
            result = interpret(code)  # Call your interpreter function
            response = {'result': str(result)}
        except Exception as e:
            response = {'error': str(e)}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))