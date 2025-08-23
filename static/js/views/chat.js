document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DO DOM ---
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const typingIndicator = document.getElementById('typing-indicator');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const roomListElement = document.querySelector('.room-list');
    const newRoomIdInput = document.getElementById('new-room-id-input');
    const joinNewRoomBtn = document.getElementById('join-new-room-btn');
    const createNewRoomBtn = document.getElementById('create-new-room-btn');

    // --- ESTADO DA APLICAÇÃO ---
    const roomId = window.salaId;
    let currentUser = '';
    let typingTimer;
    let userRooms = [];

    // --- VERIFICAÇÕES INICIAIS ---
    if (!api.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    try {
        const session = await api.getCurrentSession();
        currentUser = session.username;
        userRooms = session.joined_rooms;
    } catch (error) {
        console.error('Erro ao obter sessão:', error);
        window.location.href = '/';
        return;
    }

    // Verifica se a sala existe
    try {
        const salaExiste = await api.verificarSeSalaExiste(roomId);
        if (!salaExiste) {
            alert('Sala não encontrada!');
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar sala:', error);
        window.location.href = '/';
        return;
    }

    // --- FUNÇÕES DE UI ---
    function handleLeaveRoom(roomToLeaveId) {
        api.leaveRoom(roomToLeaveId).then(() => {
            // Remove da lista local
            userRooms = userRooms.filter(id => id !== roomToLeaveId);
            
            if (roomToLeaveId === roomId) {
                // Se saiu da sala atual
                if (userRooms.length > 0) {
                    window.location.href = `/sala/${userRooms[0]}`;
                } else {
                    window.location.href = '/';
                }
            } else {
                // Apenas atualiza a lista
                renderRoomList(userRooms, roomId);
            }
        }).catch(error => {
            console.error('Erro ao sair da sala:', error);
        });
    }

    function renderRoomList(rooms, currentRoomId) {
        if (!roomListElement) return;
        
        roomListElement.innerHTML = '';
        rooms.forEach(id => {
            const item = document.createElement('li');
            item.className = 'room-item';
            if (id === currentRoomId) item.classList.add('active');

            item.innerHTML = `
                <div class="room-icon">#</div>
                <div class="room-details">
                    <h3>Sala</h3>
                    <p>${id}</p>
                </div>
                <button class="delete-room-btn" title="Sair da sala">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            const detailsDiv = item.querySelector('.room-details');
            detailsDiv.addEventListener('click', () => {
                if (id !== currentRoomId) {
                    window.location.href = `/sala/${id}`;
                }
            });

            const deleteBtn = item.querySelector('.delete-room-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleLeaveRoom(id);
            });

            roomListElement.appendChild(item);
        });
    }

    function addMessage(data, fromHistory = false) {
        const { type, user, message, timestamp } = data;
        const div = document.createElement('div');

        if (type === 'user_joined' || type === 'user_left') {
            div.className = 'message system';
            div.textContent = message;
        } else if (type === 'chat') {
            const messageType = (user === currentUser) ? 'sent' : 'received';
            div.className = `message ${messageType}`;
            const prefix = (messageType === 'received') ? `${user}: ` : '';
            div.textContent = `${prefix}${message}`;
        }

        if (div.className) {
            // Se for do histórico, adiciona antes do indicador de digitação
            // Se for nova mensagem, também adiciona antes do indicador
            messagesArea.insertBefore(div, typingIndicator);
            
            // Só faz scroll se não for do histórico ou se estiver perto do final
            if (!fromHistory || messagesArea.scrollTop > messagesArea.scrollHeight - messagesArea.clientHeight - 100) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }
    }

    async function loadMessageHistory() {
        try {
            const response = await api.getRoomMessages(roomId, 50);
            response.messages.forEach(msg => addMessage(msg, true));
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }
    }

    // --- INICIALIZAÇÃO ---
    
    // Carrega histórico de mensagens
    await loadMessageHistory();

    // Atualiza lista de salas (garante que a sala atual esteja na lista)
    try {
        const roomsResponse = await api.getUserRooms();
        userRooms = roomsResponse.rooms;
        
        // Se a sala atual não estiver na lista, adiciona
        if (!userRooms.includes(roomId)) {
            await api.joinRoom(roomId);
            userRooms.push(roomId);
        }
        
        renderRoomList(userRooms, roomId);
    } catch (error) {
        console.error('Erro ao carregar salas:', error);
    }

    // Conecta WebSocket
    try {
        websocketService.connect(roomId);
    } catch (error) {
        console.error('Erro ao conectar WebSocket:', error);
        alert('Erro de conexão. Redirecionando...');
        window.location.href = '/';
        return;
    }

    // --- EVENT LISTENERS DO WEBSOCKET ---
    
    websocketService.on('chat', (data) => {
        if (data.user !== currentUser) {
            typingIndicator.textContent = '';
            clearTimeout(typingTimer);
        }
        addMessage(data);
    });

    websocketService.on('user_joined', (data) => {
        addMessage(data);
    });

    websocketService.on('user_left', (data) => {
        addMessage(data);
    });

    websocketService.on('typing', (data) => {
        if (data.user !== currentUser) {
            typingIndicator.textContent = `${data.user} está a digitar...`;
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                typingIndicator.textContent = '';
            }, 2000);
        }
    });

    websocketService.on('close', () => {
        addMessage({
            type: 'system',
            user: 'Sistema',
            message: 'Você foi desconectado.'
        });
    });

    websocketService.on('error', () => {
        addMessage({
            type: 'system',
            user: 'Sistema',
            message: 'Ocorreu um erro de conexão.'
        });
    });

    // --- EVENT LISTENERS DA UI ---
    
    messageForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const messageText = messageInput.value.trim();
        if (messageText) {
            websocketService.sendMessage({
                type: 'chat',
                message: messageText
            });
            messageInput.value = '';
        }
    });

    messageInput.addEventListener('input', () => {
        websocketService.sendMessage({
            type: 'typing',
            user: currentUser
        });
    });

    leaveRoomBtn.addEventListener('click', async () => {
        websocketService.close();
        await api.deleteSession();
        window.location.href = '/';
    });
    
    joinNewRoomBtn.addEventListener('click', async () => {
        const newRoomId = newRoomIdInput.value.trim();
        if (newRoomId) {
            try {
                if (await api.verificarSeSalaExiste(newRoomId)) {
                    await api.joinRoom(newRoomId);
                    window.location.href = `/sala/${newRoomId}`;
                } else {
                    alert('Erro: Sala não encontrada.');
                }
            } catch (error) {
                console.error(error);
                alert('Não foi possível conectar ao servidor.');
            }
        }
        newRoomIdInput.value = '';
    });

    createNewRoomBtn.addEventListener('click', async () => {
        try {
            const data = await api.criarNovaSala();
            window.location.href = `/sala/${data.room_id}`;
        } catch (error) {
            console.error(error);
            alert('Não foi possível criar a sala.');
        }
    });

    // Mobile menu toggle
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('visible');
        });
    }

    // Close sidebar when clicking outside (mobile)
    const chatPanel = document.querySelector('.chat-panel');
    if (chatPanel && sidebar && menuToggle) {
        chatPanel.addEventListener('click', (event) => {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggle = menuToggle.contains(event.target);
            if (sidebar.classList.contains('visible') && !isClickInsideSidebar && !isClickOnToggle) {
                sidebar.classList.remove('visible');
            }
        });
    }

    // Enter key support para inputs da sidebar
    newRoomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinNewRoomBtn.click();
    });

    // Cleanup ao sair da página
    window.addEventListener('beforeunload', () => {
        websocketService.close();
    });
});