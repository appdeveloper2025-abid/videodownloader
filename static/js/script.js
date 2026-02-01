class VideoDownloader {
    constructor() {
        this.currentDownloadId = null;
        this.progressInterval = null;
        this.initializeEventListeners();
        this.loadDownloads();
        this.initTypingAnimation();
    }

    initTypingAnimation() {
        const typingElement = document.querySelector('.typing-text');
        if (typingElement) {
            const texts = ['ABID CINEMA', 'MOVIE HUB', 'VIDEO VAULT'];
            let textIndex = 0;
            let charIndex = 0;
            let isDeleting = false;
            
            const typeText = () => {
                const currentText = texts[textIndex];
                
                if (isDeleting) {
                    typingElement.textContent = currentText.substring(0, charIndex - 1);
                    charIndex--;
                } else {
                    typingElement.textContent = currentText.substring(0, charIndex + 1);
                    charIndex++;
                }
                
                let typeSpeed = isDeleting ? 100 : 150;
                
                if (!isDeleting && charIndex === currentText.length) {
                    typeSpeed = 2000;
                    isDeleting = true;
                } else if (isDeleting && charIndex === 0) {
                    isDeleting = false;
                    textIndex = (textIndex + 1) % texts.length;
                    typeSpeed = 500;
                }
                
                setTimeout(typeText, typeSpeed);
            };
            
            typeText();
        }
    }

    initializeEventListeners() {
        document.getElementById('getInfoBtn').addEventListener('click', () => this.getVideoInfo());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadVideo());
        document.getElementById('refreshDownloads').addEventListener('click', () => this.loadDownloads());
        
        document.getElementById('videoUrl').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.getVideoInfo();
        });
    }

    async getVideoInfo() {
        const url = document.getElementById('videoUrl').value.trim();
        if (!url) {
            this.showNotification('🎬 Please enter a video URL', 'error');
            return;
        }

        const btn = document.getElementById('getInfoBtn');
        btn.disabled = true;
        btn.innerHTML = '🔍 Analyzing...';

        try {
            const response = await fetch('/get_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            
            if (data.error) {
                this.showNotification('❌ Error: ' + data.error, 'error');
                return;
            }

            this.displayVideoInfo(data);
            this.showNotification('✅ Video analyzed successfully!', 'success');
        } catch (error) {
            this.showNotification('🌐 Network error: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔍 Analyze';
        }
    }

    displayVideoInfo(info) {
        document.getElementById('videoTitle').textContent = info.title;
        document.getElementById('videoDuration').textContent = 
            info.duration ? '🕰️ ' + this.formatDuration(info.duration) : '⏱️ Unknown duration';
        
        if (info.thumbnail) {
            document.getElementById('thumbnail').src = info.thumbnail;
        }

        const formatSelect = document.getElementById('formatSelect');
        formatSelect.innerHTML = '<option value="best">🏆 Best Quality (Auto)</option>';
        
        info.formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format.format_id;
            const qualityIcon = this.getQualityIcon(format.resolution);
            option.textContent = `${qualityIcon} ${format.resolution} - ${format.ext.toUpperCase()}`;
            formatSelect.appendChild(option);
        });

        document.getElementById('videoInfo').classList.remove('hidden');
    }

    getQualityIcon(resolution) {
        if (resolution.includes('2160') || resolution.includes('4K')) return '🎆';
        if (resolution.includes('1080')) return '🌟';
        if (resolution.includes('720')) return '⭐';
        if (resolution.includes('480')) return '🔹';
        if (resolution.includes('audio')) return '🎧';
        return '🎥';
    }

    async downloadVideo() {
        const url = document.getElementById('videoUrl').value.trim();
        const formatId = document.getElementById('formatSelect').value;

        if (!url) {
            alert('Please enter a video URL');
            return;
        }

        const btn = document.getElementById('downloadBtn');
        btn.disabled = true;
        btn.textContent = 'Starting...';

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format_id: formatId })
            });

            const data = await response.json();
            
            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            this.currentDownloadId = data.download_id;
            this.startProgressTracking();
            document.getElementById('progressSection').classList.remove('hidden');
        } catch (error) {
            alert('Network error: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Download';
        }
    }

    startProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(async () => {
            try {
                const response = await fetch(`/progress/${this.currentDownloadId}`);
                const progress = await response.json();

                this.updateProgress(progress);

                if (progress.status === 'finished' || progress.status === 'error') {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                    
                    if (progress.status === 'finished') {
                        setTimeout(() => this.loadDownloads(), 1000);
                    }
                }
            } catch (error) {
                console.error('Progress tracking error:', error);
            }
        }, 1000);
    }

    updateProgress(progress) {
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressSpeed = document.getElementById('progressSpeed');
        const progressFilename = document.getElementById('progressFilename');

        if (progress.status === 'downloading') {
            progressFill.style.width = progress.percent + '%';
            progressPercent.textContent = progress.percent.toFixed(1) + '%';
            progressSpeed.textContent = progress.speed || '';
            progressFilename.textContent = progress.filename || '';
        } else if (progress.status === 'finished') {
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressSpeed.textContent = 'Complete!';
            progressFilename.textContent = progress.filename || '';
        } else if (progress.status === 'error') {
            progressPercent.textContent = 'Error!';
            progressSpeed.textContent = progress.error || 'Unknown error';
            progressFill.style.background = '#ff4757';
        }
    }

    async loadDownloads() {
        try {
            const response = await fetch('/downloads');
            const downloads = await response.json();
            
            const downloadsList = document.getElementById('downloadsList');
            downloadsList.innerHTML = '';

            if (downloads.length === 0) {
                downloadsList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No downloads yet</p>';
                return;
            }

            downloads.forEach(download => {
                const item = document.createElement('div');
                item.className = 'download-item';
                const fileIcon = this.getFileIcon(download.name);
                item.innerHTML = `
                    <div class="download-info">
                        <div class="download-name">${fileIcon} ${download.name}</div>
                        <div class="download-meta">
                            📁 ${this.formatFileSize(download.size)} • 🕒 ${download.modified}
                        </div>
                    </div>
                `;
                downloadsList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading downloads:', error);
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `cinema-notification ${type}`;
        notification.textContent = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 25px',
            borderRadius: '12px',
            color: '#fff',
            fontFamily: 'Orbitron, monospace',
            fontWeight: '600',
            fontSize: '14px',
            zIndex: '9999',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });
        
        if (type === 'success') {
            notification.style.background = 'rgba(0, 255, 136, 0.2)';
            notification.style.borderColor = '#00ff88';
        } else if (type === 'error') {
            notification.style.background = 'rgba(255, 107, 107, 0.2)';
            notification.style.borderColor = '#ff6b6b';
        } else {
            notification.style.background = 'rgba(78, 205, 196, 0.2)';
            notification.style.borderColor = '#4ecdc4';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];
        const audioExts = ['mp3', 'wav', 'flac', 'aac', 'm4a'];
        
        if (videoExts.includes(ext)) return '🎥';
        if (audioExts.includes(ext)) return '🎧';
        return '📄';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new VideoDownloader();
});