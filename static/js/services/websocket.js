const websocketService = {
    socket: null,
    listeners: {},

    /**
     * Inicia a conexão WebSocket com o servidor usando sessão.
     */
    connect(roomId) {
        if (this.socket) {
            this.socket.close();
        }

        const token = api.getAuthToken();
        if (!token) {
            throw new Error('Token de sessão não encontrado');
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/${roomId}?session_id=${token}`;
        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type && this.listeners[data.type]) {
                this.listeners[data.type].forEach(callback => callback(data));
            }
        };

        this.socket.onclose = () => {
            if (this.listeners['close']) {
                this.listeners['close'].forEach(callback => callback());
            }
        };

        this.socket.onerror = (error) => {
            console.error("Erro no WebSocket:", error);
            if (this.listeners['error']) {
                this.listeners['error'].forEach(callback => callback(error));
            }
        };
    },

    /**
     * Registra um callback para um tipo de evento específico.
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    },

    /**
     * Remove todos os listeners de um evento específico.
     */
    off(eventName) {
        if (this.listeners[eventName]) {
            delete this.listeners[eventName];
        }
    },

    /**
     * Envia uma mensagem para o servidor.
     */
    sendMessage(payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
        }
    },

    /**
     * Fecha a conexão.
     */
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        // Limpa todos os listeners
        this.listeners = {};
    }
};