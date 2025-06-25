// auth-google.js

// Certifique-se de que 'auth', 'GoogleAuthProvider', 'signInWithPopup', 'signOut', 'onAuthStateChanged'
// estão disponíveis globalmente através do window, como você já configurou no index.html
const auth = window.firebaseAuth;
const GoogleAuthProvider = window.GoogleAuthProvider;
const signInWithPopup = window.signInWithPopup;
const signOut = window.signOut;
const onAuthStateChanged = window.onAuthStateChanged;

// Elementos da UI
const loginScreen = document.getElementById('login-screen');
const appWrapper = document.querySelector('.app-wrapper'); // Seu conteúdo principal
const googleLoginButtonMain = document.getElementById('google-login-button-main');
const loginErrorMessage = document.getElementById('login-error-message');

// Botões na seção de Backup (que agora serão controlados por este script)
const googleLoginBtnBackup = document.getElementById('google-login-btn');
const googleLogoutBtnBackup = document.getElementById('google-logout-btn');


// Função para mostrar a tela de login
function showLoginScreen() {
    loginScreen.style.display = 'flex'; // Use flex para centralização
    appWrapper.style.display = 'none';
    // Oculta os botões de login/logout na seção de backup quando não logado
    googleLoginBtnBackup.style.display = 'none';
    googleLogoutBtnBackup.style.display = 'none';
}

// Função para mostrar o conteúdo principal do aplicativo
function showAppContent() {
    loginScreen.style.display = 'none';
    appWrapper.style.display = 'block'; // Ou 'flex' se o seu app-wrapper for flex
    // Exibe os botões corretos na seção de backup quando logado
    if (auth.currentUser) {
        googleLoginBtnBackup.style.display = 'none';
        googleLogoutBtnBackup.style.display = 'inline-block'; // Ou 'block' se preferir
    } else {
        googleLoginBtnBackup.style.display = 'inline-block';
        googleLogoutBtnBackup.style.display = 'none';
    }
}

// Lógica de login com Google
googleLoginButtonMain.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // Login bem-sucedido, onAuthStateChanged vai lidar com a exibição do conteúdo
        loginErrorMessage.textContent = ''; // Limpa qualquer erro anterior
    } catch (error) {
        console.error("Erro no login com Google:", error);
        let message = "Erro ao fazer login com Google.";
        if (error.code === 'auth/popup-closed-by-user') {
            message = "Login cancelado pelo usuário.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            message = "Solicitação de login popup foi cancelada.";
        } else if (error.code === 'auth/operation-not-allowed') {
            message = "Login com Google não está habilitado no Firebase (verifique o console).";
        }
        loginErrorMessage.textContent = message;
    }
});

// Lógica de logout (para o botão na seção de backup)
googleLogoutBtnBackup.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // Logout bem-sucedido, onAuthStateChanged vai lidar com a exibição da tela de login
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        alert("Erro ao fazer logout. Tente novamente.");
    }
});

// Listener para o estado de autenticação
// Esta função será executada toda vez que o estado de autenticação mudar (login, logout)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário logado
        console.log("Usuário logado:", user.displayName || user.email);
        showAppContent();
        // Opcional: Atualizar o status do Firebase no cabeçalho
        const firebaseCloudStatus = document.getElementById('firebase-cloud-status');
        if (firebaseCloudStatus) {
            firebaseCloudStatus.textContent = `Conectado (${user.displayName || user.email})`;
        }
        // Ocultar o botão "LOGIN GOOGLE NECESSARIO" na seção de backup
        if (googleLoginBtnBackup) googleLoginBtnBackup.style.display = 'none';
        // Mostrar "LOGADO COM FIREBASE CLOUD" na seção de backup
        if (googleLogoutBtnBackup) googleLogoutBtnBackup.style.display = 'inline-block';

    } else {
        // Usuário deslogado
        console.log("Usuário deslogado.");
        showLoginScreen();
        // Opcional: Atualizar o status do Firebase no cabeçalho
        const firebaseCloudStatus = document.getElementById('firebase-cloud-status');
        if (firebaseCloudStatus) {
            firebaseCloudStatus.textContent = 'Desconectado';
        }
        // Mostrar o botão "LOGIN GOOGLE NECESSARIO" na seção de backup
        if (googleLoginBtnBackup) googleLoginBtnBackup.style.display = 'inline-block';
        // Ocultar "LOGADO COM FIREBASE CLOUD" na seção de backup
        if (googleLogoutBtnBackup) googleLogoutBtnBackup.style.display = 'none';
    }
});

// Adicionar um listener para o botão de login na seção de backup, para garantir que ele funcione
// (Embora o onAuthStateChanged já cuide da visibilidade, é bom ter um handler para o clique)
googleLoginBtnBackup.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // Login bem-sucedido, onAuthStateChanged vai lidar com a exibição
    } catch (error) {
        console.error("Erro no login com Google na seção de backup:", error);
        // Pode adicionar uma mensagem de erro específica para a seção de backup se necessário
    }
});
