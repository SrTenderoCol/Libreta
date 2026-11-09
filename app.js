import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

const firebaseConfig = {
  apiKey: "AIzaSyDnZ_hVN2l3F6yGsC5LwtVXqEVsq6tCqUc",
  authDomain: "srtendero2026.firebaseapp.com",
  databaseURL: "https://srtendero2026-default-rtdb.firebaseio.com",
  projectId: "srtendero2026",
  storageBucket: "srtendero2026.firebasestorage.app",
  messagingSenderId: "248215273556",
  appId: "1:248215273556:web:08f40a5f6365f7982fadc1",
  measurementId: "G-MH8LBL0P2V"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const VENDEDOR_USER = "tendero";
const VENDEDOR_PASS = "admin123"; 

// ==========================================
// REGISTRO DEL SERVICE WORKER E INSTALACIÓN PWA
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service Worker no registrado:', err);
    });
  });
}

let diferirEventoInstalacion;
const btnInstalar = document.getElementById('btn-instalar-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  diferirEventoInstalacion = e;

  if (btnInstalar) {
    btnInstalar.classList.remove('hidden');

    btnInstalar.addEventListener('click', () => {
      btnInstalar.classList.add('hidden');
      diferirEventoInstalacion.prompt();
      
      diferirEventoInstalacion.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('El usuario aceptó instalar la app');
        }
        diferirEventoInstalacion = null;
      });
    });
  }
});

// 1. LÓGICA DE LOGIN
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const usuarioIngresado = document.getElementById("usuario").value.trim().toLowerCase();
    const passwordIngresado = document.getElementById("password").value.trim();
    const errorMsg = document.getElementById("error-msg");

    if (usuarioIngresado === VENDEDOR_USER && passwordIngresado === VENDEDOR_PASS) {
      localStorage.setItem("sesion_activo", JSON.stringify({ tipo: "tendero", usuario: "tendero" }));
      window.location.href = "panel-tendero.html";
      return;
    }

    const clientesRef = ref(db, 'clientes_tienda');
    onValue(clientesRef, (snapshot) => {
      const clientes = snapshot.val() || {};
      let clienteEncontradoKey = null;
      let datosCliente = null;

      Object.keys(clientes
