const api = {
    token: null,

    // Gerenciamento de token
    setAuthToken(token) {
        this.token = token;
        sessionStorage.setItem('authToken', token);
    },

    getAuthToken() {
        if (!this.token) {
            this.token = sessionStorage.getItem('authToken');
        }
        return this.token;
    },

    clearAuthToken() {
        this.token = null;
        sessionStorage.removeItem('authToken');
    },

    // Método auxiliar para requisições autenticadas
    async request(url, options = {}) {
        const token = this.getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Se receber 401, limpa token e redireciona para home
        if (response.status === 401) {
            this.clearAuthToken();
            window.location.href = '/';
            throw new Error('Sessão expirada');
        }

        return response;
    },

    // === SESSÕES ===
    async createSession(username) {
        const response = await this.request('/sessions', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Falha ao criar sessão');
        }
        
        const data = await response.json();
        this.setAuthToken(data.session_id);
        return data;
    },

    async getCurrentSession() {
        const response = await this.request('/sessions/me');
        if (!response.ok) {
            throw new Error('Sessão inválida');
        }
        return response.json();
    },

    async deleteSession() {
        const response = await this.request('/sessions/me', { method: 'DELETE' });
        this.clearAuthToken();
        return response.ok;
    },

    // === SALAS ===
    async criarNovaSala() {
        const response = await this.request('/rooms', { method: 'POST' });
        if (!response.ok) {
            throw new Error('Falha ao criar a sala');
        }
        return response.json();
    },

    async getUserRooms() {
        const response = await this.request('/rooms');
        if (!response.ok) {
            throw new Error('Falha ao obter salas do usuário');
        }
        return response.json();
    },

    async verificarSeSalaExiste(roomId) {
        try {
            const response = await fetch(`/rooms/${roomId}`); // Sem auth necessária
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    async joinRoom(roomId) {
        const response = await this.request(`/rooms/${roomId}/join`, { method: 'POST' });
        return response.ok;
    },

    async leaveRoom(roomId) {
        const response = await this.request(`/rooms/${roomId}/leave`, { method: 'DELETE' });
        return response.ok;
    },

    async getRoomMessages(roomId, limit = 50) {
        const response = await this.request(`/rooms/${roomId}/messages?limit=${limit}`);
        if (!response.ok) {
            throw new Error('Falha ao obter mensagens');
        }
        return response.json();
    },

    // === UTILITÁRIOS ===
    isAuthenticated() {
        return !!this.getAuthToken();
    }
};