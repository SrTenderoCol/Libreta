import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Inicializar íconos visuales
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// TODO: Reemplaza con tus datos reales de la consola de Firebase
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
const db = getDatabase(app);

// Definimos las credenciales fijas del Vendedor (Panel exclusivo de la tienda)
const VENDEDOR_USER = "tendero";
const VENDEDOR_PASS = "admin123"; // Puedes cambiar la contraseña del tendero aquí

// 1. LÓGICA DE LOGIN (index.html)
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const usuarioIngresado = document.getElementById("usuario").value.trim().toLowerCase();
    const passwordIngresado = document.getElementById("password").value.trim();
    const errorMsg = document.getElementById("error-msg");

    // Verificar si es el tendero
    if (usuarioIngresado === VENDEDOR_USER && passwordIngresado === VENDEDOR_PASS) {
      localStorage.setItem("sesion_activo", JSON.stringify({ tipo: "tendero", usuario: "tendero" }));
      window.location.href = "panel-tendero.html";
      return;
    }

    // Si no es el tendero, buscar en la base de datos si existe el cliente con su clave única
    const clientesRef = ref(db, 'clientes_tienda');
    onValue(clientesRef, (snapshot) => {
      const clientes = snapshot.val() || {};
      let clienteEncontrado = null;

      Object.keys(clientes).forEach(key => {
        const c = clientes[key];
        if (c.usuario.toLowerCase() === usuarioIngresado && c.password === passwordIngresado) {
          clienteEncontrado = c;
        }
      });

      if (clienteEncontrado) {
        // Guardar sesión del cliente en el navegador
        localStorage.setItem("sesion_activo", JSON.stringify({ tipo: "cliente", nombre: clienteEncontrado.nombre }));
        window.location.href = "panel-cliente.html";
      } else {
        errorMsg.textContent = "Usuario o contraseña incorrectos.";
        errorMsg.classList.remove("hidden");
      }
    }, { onlyOnce: true });
  });
}

// Botón de Cerrar Sesión (Común para ambos paneles)
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("sesion_activo");
    window.location.href = "index.html";
  });
}

// 2. LÓGICA DEL PANEL DEL TENDERO (panel-tendero.html)
const formCrearCliente = document.getElementById("form-crear-cliente");
const selectClienteFiado = document.getElementById("select-cliente-fiado");
const formFiado = document.getElementById("form-fiado");

if (formCrearCliente) {
  // Validar si hay sesión de tendero activa
  const sesion = JSON.parse(localStorage.getItem("sesion_activo"));
  if (!sesion || sesion.tipo !== "tendero") {
    window.location.href = "index.html";
  }

  // Crear cuenta de cliente con clave única
  formCrearCliente.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nuevo-nombre").value.trim();
    const usuario = document.getElementById("nuevo-user").value.trim().toLowerCase();
    const password = document.getElementById("nuevo-pass").value.trim();

    const nuevoClienteRef = push(ref(db, 'clientes_tienda'));
    set(nuevoClienteRef, { nombre, usuario, password });

    alert(`¡Cuenta creada con éxito para ${nombre}!\nUsuario: ${usuario}\nClave: ${password}`);
    formCrearCliente.reset();
  });

  // Cargar lista de clientes en el selector de fiados
  onValue(ref(db, 'clientes_tienda'), (snapshot) => {
    const clientes = snapshot.val() || {};
    if (selectClienteFiado) {
      selectClienteFiado.innerHTML = `<option value="">-- Selecciona un cliente --</option>`;
      Object.keys(clientes).forEach(key => {
        const c = clientes[key];
        selectClienteFiado.innerHTML += `<option value="${c.nombre}">${c.nombre} (Usuario: ${c.usuario})</option>`;
      });
    }
  });

  // Registrar nuevo fiado a un cliente
  if (formFiado) {
    formFiado.addEventListener("submit", (e) => {
      e.preventDefault();
      const cliente = document.getElementById("select-cliente-fiado").value;
      const concepto = document.getElementById("concepto").value.trim();
      const monto = parseFloat(document.getElementById("monto").value);
      const fechaHora = new Date().toLocaleString("es-CO", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
      });

      push(ref(db, 'fiados_tienda'), { cliente, concepto, monto, fechaHora });
      formFiado.reset();
      alert("¡Fiado registrado con éxito!");
    });
  }

  // Mostrar historial general de la tienda al tendero
  onValue(ref(db, 'fiados_tienda'), (snapshot) => {
    const data = snapshot.val() || {};
    const tbody = document.getElementById("tabla-tendero");
    if (tbody) {
      tbody.innerHTML = "";
      Object.keys(data).forEach(key => {
        const item = data[key];
        tbody.innerHTML += `
          <tr class="hover:bg-slate-50">
            <td class="py-3 text-xs text-slate-500">${item.fechaHora}</td>
            <td class="py-3 font-bold text-slate-800">${item.cliente}</td>
            <td class="py-3 text-slate-600">${item.concepto}</td>
            <td class="py-3 text-right font-extrabold text-blue-600">$${item.monto.toLocaleString("es-CO")}</td>
          </tr>
        `;
      });
    }
  });
}

// 3. LÓGICA DEL PANEL DEL CLIENTE/FAMILIA (panel-cliente.html)
const tablaCliente = document.getElementById("tabla-cliente");
if (tablaCliente) {
  const sesion = JSON.parse(localStorage.getItem("sesion_activo"));
  if (!sesion || sesion.tipo !== "cliente") {
    window.location.href = "index.html";
  } else {
    document.getElementById("nombre-cliente-saludo").textContent = `Hola, ${sesion.nombre}`;
  }

  // Cargar exclusivamente los movimientos de este cliente
  onValue(ref(db, 'fiados_tienda'), (snapshot) => {
    const data = snapshot.val() || {};
    tablaCliente.innerHTML = "";
    let miTotal = 0;

    Object.keys(data).forEach(key => {
      const item = data[key];
      // Compara si el registro pertenece al nombre del cliente logueado
      if (item.cliente === sesion.nombre) {
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
}
