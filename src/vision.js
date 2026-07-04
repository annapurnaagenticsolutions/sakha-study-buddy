export class VisionService {
    constructor() {
        this.videoElement = null;
        this.stream = null;
    }

    async startCamera(container) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API not supported in this browser.");
        }

        this.videoElement = document.createElement('video');
        this.videoElement.setAttribute('autoplay', '');
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.style.width = '100%';
        this.videoElement.style.borderRadius = '8px';

        container.appendChild(this.videoElement);

        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.videoElement.srcObject = this.stream;
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement && this.videoElement.parentNode) {
            this.videoElement.parentNode.removeChild(this.videoElement);
            this.videoElement = null;
        }
    }

    captureFrame() {
        if (!this.videoElement) return null;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        
        // Return Base64 JPEG
        return canvas.toDataURL('image/jpeg', 0.8);
    }
}
