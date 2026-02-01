from flask import Flask, render_template, request, jsonify, send_file
import yt_dlp
import os
import threading
import uuid
from datetime import datetime

app = Flask(__name__)

# Configuration
DOWNLOAD_FOLDER = os.path.join(os.getcwd(), 'downloads')
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# Store download progress
download_progress = {}

class ProgressHook:
    def __init__(self, download_id):
        self.download_id = download_id
    
    def __call__(self, d):
        if d['status'] == 'downloading':
            try:
                percent = d.get('_percent_str', '0%').replace('%', '')
                speed = d.get('_speed_str', 'N/A')
                download_progress[self.download_id] = {
                    'status': 'downloading',
                    'percent': float(percent) if percent != 'N/A' else 0,
                    'speed': speed,
                    'filename': d.get('filename', 'Unknown')
                }
            except:
                pass
        elif d['status'] == 'finished':
            download_progress[self.download_id] = {
                'status': 'finished',
                'percent': 100,
                'filename': d.get('filename', 'Unknown'),
                'filepath': d.get('filename', '')
            }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_info', methods=['POST'])
def get_info():
    url = request.json.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    try:
        ydl_opts = {'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            formats = []
            for f in info.get('formats', []):
                if f.get('vcodec') != 'none' or f.get('acodec') != 'none':
                    formats.append({
                        'format_id': f.get('format_id'),
                        'ext': f.get('ext'),
                        'quality': f.get('format_note', 'Unknown'),
                        'filesize': f.get('filesize'),
                        'vcodec': f.get('vcodec', 'none'),
                        'acodec': f.get('acodec', 'none'),
                        'resolution': f.get('resolution', 'audio only' if f.get('vcodec') == 'none' else 'Unknown')
                    })
            
            return jsonify({
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'formats': formats[:20]  # Limit to 20 formats
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id', 'best')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    download_id = str(uuid.uuid4())
    download_progress[download_id] = {'status': 'starting', 'percent': 0}
    
    def download_video():
        try:
            ydl_opts = {
                'format': format_id,
                'outtmpl': os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s'),
                'progress_hooks': [ProgressHook(download_id)],
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
        except Exception as e:
            download_progress[download_id] = {
                'status': 'error',
                'error': str(e)
            }
    
    thread = threading.Thread(target=download_video)
    thread.start()
    
    return jsonify({'download_id': download_id})

@app.route('/progress/<download_id>')
def get_progress(download_id):
    return jsonify(download_progress.get(download_id, {'status': 'not_found'}))

@app.route('/downloads')
def list_downloads():
    files = []
    for filename in os.listdir(DOWNLOAD_FOLDER):
        filepath = os.path.join(DOWNLOAD_FOLDER, filename)
        if os.path.isfile(filepath):
            files.append({
                'name': filename,
                'size': os.path.getsize(filepath),
                'modified': datetime.fromtimestamp(os.path.getmtime(filepath)).strftime('%Y-%m-%d %H:%M:%S')
            })
    return jsonify(files)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)