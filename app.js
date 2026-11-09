import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://firebase.google.com/..."; // (Usa los CDN oficiales de Firebase Auth y Database)
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// REEMPLAZA CON TUS CREDENCIALES REALES DE FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "tu_sender",
  appId: "tu_app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Configura aquí el correo exacto del vendedor autorizado (ej: el correo de tu amigo)
const CORREO_VENDEDOR_UNICO = "amigotendero@gmail.com"; 

let modoRegistro = false;

window.cambiarTab = function(tipo) {
  modoRegistro = (tipo === 'registro');
  const btnLogin = document.getElementById("tab-login");
  const btnRegistro = document.getElementById("tab-registro");
  const btnSubmit = document.getElementById("btn-submit");

  if (modoRegistro) {
    btnRegistro.className = "flex-1 py-2 rounded-lg font-semibold text-xs bg-blue-600 text-white shadow transition";
    btnLogin.className = "flex-1 py-2 rounded-lg font-semibold text-xs text-slate-600 transition";
    btnSubmit.textContent = "Registrarme como Cliente";
  } else {
    btnLogin.className = "flex-1 py-2 rounded-lg font-semibold text-xs bg-blue-600 text-white shadow transition";
    btnRegistro.className = "flex-1 py-2 rounded-lg font-semibold text-xs text-slate-600 transition";
    btnSubmit.textContent = "Ingresar";
  }
}

// Manejo del formulario de Login / Registro en index.html
const formAuth = document.getElementById("form-auth");
if (formAuth) {
  formAuth.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");

    try {
      if (modoRegistro) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("¡Registro exitoso!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      // Redirección inteligente según el rol
      if (email === CORREO_VENDEDOR_UNICO) {
        window.location.href = "panel-tendero.html";
      } else {
        window.location.href = "panel-cliente.html";
      }
    } catch (error) {
      errorMsg.textContent = "Error: " + error.message;
      errorMsg.classList.remove("hidden");
    }
  });
}

// Control de botones de cerrar sesión
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

// Lógica exclusiva del panel del vendedor
const formFiado = document.getElementById("form-fiado");
if (formFiado) {
  onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== CORREO_VENDEDOR_UNICO) {
      window.location.href = "index.html"; // Bloquea si no es el tendero
    }
  });

  formFiado.addEventListener("submit", (e) => {
    e.preventDefault();
    const cliente = document.getElementById("cliente-nombre").value.trim();
    const concepto = document.getElementById("concepto").value.trim();
    const monto = parseFloat(document.getElementById("monto").value);
    
    const fechaHora = new Date().toLocaleString("es-CO");
    push(ref(db, 'fiados_tienda'), { cliente, concepto, monto, fechaHora });
    formFiado.reset();
  });

  // Cargar datos en el panel del tendero
  onValue(ref(db, 'fiados_tienda'), (snapshot) => {
    const data = snapshot.val() || {};
    const tbody = document.getElementById("tabla-tendero");
    const totalCartera = document.getElementById("total-cartera");
    tbody.innerHTML = "";
    let total = 0;

    Object.keys(data).forEach(key => {
      const item = data[key];
      total += item.monto;
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="py-3 text-xs text-slate-500">${item.fechaHora}</td>
          <td class="py-3 font-bold text-slate-800">${item.cliente}</td>
          <td class="py-3 text-slate-600">${item.concepto}</td>
          <td class="py-3 text-right font-extrabold text-blue-600">$${item.monto.toLocaleString("es-CO")}</td>
        </tr>
      `;
    });
    totalCartera.textContent = `$${total.toLocaleString("es-CO")}`;
  });
}

// Lógica exclusiva del panel del cliente
const tablaCliente = document.getElementById("tabla-cliente");
if (tablaCliente) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    document.getElementById("user-email").textContent = user.email;
    
    // Filtramos los datos para que el cliente solo vea lo suyo usando su correo o nombre de usuario
    onValue(ref(db, 'fiados_tienda'), (snapshot) => {
      const data = snapshot.val() || {};
      tablaCliente.innerHTML = "";
      let miTotal = 0;
      
      // Asumimos que el cliente se registra y el tendero anota su nombre idéntico a la parte inicial de su correo (o puedes mapearlo)
      const nombreClienteIdentificador = user.email.split("@")[0].toLowerCase();

      Object.keys(data).forEach(key => {
        const item = data[key];
        if (item.cliente.toLowerCase().includes(nombreClienteIdentificador)) {
          miTotal += item.monto;
          tablaCliente.innerHTML += `
            <tr class="hover:bg-slate-50">
              <td class="py-3 text-xs text-slate-500">${item.fechaHora}</td>
              <td class="py-3 text-slate-600">${item.concepto}</td>
              <td class="py-3 text-right font-extrabold text-blue-600">$${item.monto.toLocaleString("es-CO")}</td>
            </tr>
          `;
        }
      });
      document.getElementById("mi-deuda").textContent = `$${miTotal.toLocaleString("es-CO")}`;
    });
  });
}
