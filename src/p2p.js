export class P2PService {
    constructor(onMessage) {
        this.peer = null;
        this.connection = null;
        this.onMessage = onMessage;
        this.peerId = null;
    }

    async loadPeerJS() {
        if (window.Peer) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'lib/peerjs.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async init() {
        await this.loadPeerJS();
        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') {
                reject("PeerJS not loaded");
                return;
            }
            this.peer = new Peer();
            this.peer.on('open', (id) => {
                this.peerId = id;
                console.log("My peer ID is: " + id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.connection = conn;
                this.setupConnection();
            });

            this.peer.on('error', (err) => {
                console.error(err);
                reject(err);
            });
        });
    }

    connectTo(peerId) {
        if (!this.peer) return;
        this.connection = this.peer.connect(peerId);
        this.setupConnection();
    }

    setupConnection() {
        this.connection.on('open', () => {
            console.log("Connected to peer");
            this.send({ type: 'sys', data: 'Peer connected' });
        });
        
        this.connection.on('data', (data) => {
            if (this.onMessage) this.onMessage(data);
        });
    }

    send(dataObj) {
        if (this.connection && this.connection.open) {
            this.connection.send(dataObj);
        }
    }
}
