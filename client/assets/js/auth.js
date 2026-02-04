import { loginUser, registerUser } from "./requests.js";

const SESSION_DURATION = 3600 * 1000;
let currentUser = loadSession();

export function loadSession() {
    const storedString = localStorage.getItem('ringing_session');
    
    if (!storedString) return null;

    const session = JSON.parse(storedString);
    const now = new Date().getTime();

    if (now > session.expiry) {
        localStorage.removeItem('ring_session');
        return null;
    }

    // Aún es válida: Devolvemos el usuario
    return session.user;
}

export function saveSession(user) {
    const sessionData = {
        user: user,
        expiry: new Date().getTime() + SESSION_DURATION
    };
    localStorage.setItem('ringing_session', JSON.stringify(sessionData));
}

export function performLogout(){
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
}

export function isUserLoggedIn() {
    return currentUser !== null;
}

export async function getCurrentUserName() {
    
    if (!currentUser) return null;
    let username = currentUser.name || "Anillador/a";
    return username.trim().split(' ')[0];
}

export function updateUIAuthState() {
    const isLoggedIn = isUserLoggedIn();
    const loginIcon = document.getElementById('loginIcon');
    const loginLink = document.getElementById('loginLink');
    const homeTitle = document.getElementById('homeTitle');
    if (loginIcon && loginLink) {
        if (isLoggedIn) {
            loginIcon.classList.remove('bi-box-arrow-in-right');
            loginIcon.classList.add('bi-box-arrow-right');
            loginLink.textContent = 'Cerrar Sesión';
        } else {
            loginIcon.classList.remove('bi-box-arrow-right');
            loginIcon.classList.add('bi-box-arrow-in-right');
            loginLink.textContent = 'Iniciar Sesión';
        }
    }
    
    if (homeTitle) {
        getCurrentUserName().then(name => {
            homeTitle.textContent = isLoggedIn && name 
                ? `¡Bienvenid@ a Ring & Release, ${name}!` 
                : '¡Bienvenid@ a Ring & Release!';
        });
    }
}

// GESTIÓN LOGIN
export function setupLoginForms(onSuccessCallback) {
    const registerForm = document.querySelector('#registerForm');
    const loginForm = document.querySelector('#loginForm');
    
    if(!registerForm || !loginForm) return;

    // Inputs
    const nameInputRegister = document.getElementById('name');
    const emailInputRegister = document.getElementById('emailRegister');
    const passwordInputRegister = document.getElementById('passwordRegister');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const emailInputLogin = document.getElementById('emailLogin');
    const passwordInputLogin = document.getElementById('passwordLogin');
    
    // Warnings
    const passwordWarning = document.getElementById('passwordWarning');
    const confirmPasswordWarning = document.getElementById('confirmPasswordWarning');
    const emailWarningLogin = document.getElementById('emailWarning');
    const emailWarningRegister = document.getElementById('emailWarningRegister') || document.createElement('div'); // Parche si no existe

    // Helpers
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isStrongPassword = (pass) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(pass);

    // Listeners Register
    emailInputRegister.addEventListener('input', () => {
        emailWarningRegister.textContent = !isValidEmail(emailInputRegister.value) ? "Correo inválido." : "";
    });

    passwordInputRegister.addEventListener('input', () => {
        passwordWarning.textContent = !isStrongPassword(passwordInputRegister.value) ? "Mín 8 caracteres, mayúscula, número y símbolo." : "";
    });

    confirmPasswordInput.addEventListener('input', () => {
        confirmPasswordWarning.textContent = passwordInputRegister.value !== confirmPasswordInput.value ? "Las contraseñas no coinciden." : "";
    });

    // Botones
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    registerForm.addEventListener('input', () => {
        registerBtn.disabled = !(nameInputRegister.value && emailInputRegister.value && passwordInputRegister.value && confirmPasswordInput.value);
    });

    loginForm.addEventListener('input', () => {
        loginBtn.disabled = !(emailInputLogin.value && passwordInputLogin.value);
    });

    loginBtn.addEventListener('click', async (e) => {
        if (loginForm.checkValidity()) {
            e.preventDefault();
            try {
                const user = await loginUser(emailInputLogin.value, passwordInputLogin.value);
                if (user) {
                    currentUser = user;
                    saveSession(user);
                    if(onSuccessCallback) onSuccessCallback();
                } 
                else {
                    alert("Email o contraseña incorrectos");
                }
            } 
            catch (error) {
                console.error(error);
            }
        }
    });

    registerBtn.addEventListener('click', async (e) => {
        if (registerForm.checkValidity()) {
            e.preventDefault();
            try {
                const user = await registerUser(nameInputRegister.value, emailInputRegister.value, passwordInputRegister.value);
                if(user){
                    currentUser = user;
                    saveSession(user);
                    if(onSuccessCallback) onSuccessCallback();
                }
                else{
                    alert("Email o contraseña incorrectos");
                }
            }
            catch(error){
                console.error(error);
            }
        }
    });
}