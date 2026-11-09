import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

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

const VENDEDOR_USER = "tendero";
const VENDEDOR_PASS = "admin123"; 

// 1. LÓGICA DE LOGIN
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombreIngresado = document.getElementById("nombre-ingresado").value.trim();
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
      let clienteEncontrado = null;

      Object.keys(clientes).forEach(key => {
        const c = clientes[key];
        if (c.usuario.toLowerCase() === usuarioIngresado && c.password === passwordIngresado) {
          clienteEncontrado = c;
        }
      });

      if (clienteEncontrado) {
        const nombreFinal = nombreIngresado ? nombreIngresado : clienteEncontrado.nombre;
        localStorage.setItem("sesion_activo", JSON.stringify({ tipo: "cliente", nombre: nombreFinal }));
        window.location.href = "panel-cliente.html";
      } else {
        errorMsg.textContent = "Usuario o contraseña incorrectos.";
        errorMsg.classList.remove("hidden");
      }
    }, { onlyOnce: true });
  });
}

const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("sesion_activo");
    window.location.href = "index.html";
  });
}

// Variable global para rastrear qué cliente tiene abierto Don Carlos en su panel
let clienteSeleccionadoParaEditar = null;

// 2. LÓGICA DEL PANEL DEL TENDERO
const formCrearCliente = document.getElementById("form-crear-cliente");
const listaClientesTendero = document.getElementById("lista-clientes-tendero");
const formFiadoIndividual = document.getElementById("form-fiado-individual");

if (formCrearCliente) {
  const sesion = JSON.parse(localStorage.getItem("sesion_activo"));
  if (!sesion || sesion.tipo !== "tendero") {
    window.location.href = "index.html";
  }

  // Crear cliente nuevo
  formCrearCliente.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nuevo-nombre").value.trim();
    const usuario = document.getElementById("nuevo-user").value.trim().toLowerCase();
    const password = document.getElementById("nuevo-pass").value.trim();

    const nuevoClienteRef = push(ref(db, 'clientes_tienda'));
    set(nuevoClienteRef, { nombre, usuario, password });

    alert(`¡Cuenta creada con éxito para ${nombre}!`);
    formCrearCliente.reset();
  });

  // Renderizar la lista de clientes a la izquierda
  onValue(ref(db, 'clientes_tienda'), (snapshot) => {
    const clientes = snapshot.val() || {};
    if (listaClientesTendero) {
      listaClientesTendero.innerHTML = "";
      if (Object.keys(clientes).length === 0) {
        listaClientesTendero.innerHTML = `<p class="text-xs text-slate-400">No hay clientes creados.</p>`;
        return;
      }

      Object.keys(clientes).forEach(key => {
        const c = clientes[key];
        const activoClase = clienteSeleccionadoParaEditar === c.nombre ? "bg-blue-50 border-blue-500 text-blue-700 font-bold" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700";
        
        const divCliente = document.createElement("div");
        divCliente.className = `p-3 rounded-xl border text-sm cursor-pointer transition flex justify-between items-center ${activoClase}`;
        divCliente.innerHTML = `
          <div>
            <p class="font-bold">${c.nombre}</p>
            <p class="text-xs text-slate-400">Usuario: ${c.usuario}</p>
          </div>
          <span class="text-xs bg-white px-2 py-1 rounded-lg border shadow-sm">Abrir &rarr;</span>
        `;

        divCliente.addEventListener("click", () => {
          clienteSeleccionadoParaEditar = c.nombre;
          document.getElementById("sin-seleccion").classList.add("hidden");
          document.getElementById("panel-cliente-activo").classList.remove("hidden");
          document.getElementById("titulo-cliente-activo").textContent = c.nombre;
          // Refrescar lista para marcar el seleccionado
          onValue(ref(db, 'clientes_tienda'), () => {}, { onlyOnce: true }); // Dispara actualización visual
        });

        listaClientesTendero.appendChild(divCliente);
      });
    }
  });

  // Registrar transacción (fiado o abono) exclusivamente al cliente abierto
  if (formFiadoIndividual) {
    formFiadoIndividual.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!clienteSeleccionadoParaEditar) {
        alert("Por favor selecciona un cliente primero.");
        return;
      }

      const tipo = document.getElementById("tipo-movimiento").value; 
      let concepto = document.getElementById("concepto").value.trim();
      let monto = parseFloat(document.getElementById("monto").value);

      if (tipo === "abono") {
        monto = -monto;
        if (!concepto.toLowerCase().includes("abono") && !concepto.toLowerCase().includes("pago")) {
          concepto = "Abono / Pago: " + concepto;
        }
      }

      const fechaHora = new Date().toLocaleString("es-CO", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
      });

      push(ref(db, 'fiados_tienda'), { cliente: clienteSeleccionadoParaEditar, concepto, monto, fechaHora });
      formFiadoIndividual.reset();
      alert(`¡Transacción guardada en la cuenta de ${clienteSeleccionadoParaEditar}!`);
    });
  }

  // Escuchar en tiempo real los movimientos del cliente que Don Carlos tiene abierto en pantalla
  onValue(ref(db, 'fiados_tienda'), (snapshot) => {
    const data = snapshot.val() || {};
    const tbody = document.getElementById("tabla-cliente-activo");
    const deudaTxt = document.getElementById("deuda-cliente-activo");
    
    if (tbody && clienteSeleccionadoParaEditar) {
      tbody.innerHTML = "";
      let totalCuenta = 0;
      let hayMovimientos = false;

      Object.keys(data).forEach(key => {
        const item = data[key];
        if (item.cliente === clienteSeleccionadoParaEditar) {
          hayMovimientos = true;
          totalCuenta += item.monto;
          const esAbono = item.monto < 0;
          const colorClase = esAbono ? "text-emerald-600" : "text-blue-600";
          const signo = esAbono ? "" : "+";

          tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
              <td class="py-3 text-xs text-slate-500">${item.fechaHora}</td>
              <td class="py-3 text-slate-600">${item.concepto}</td>
              <td class="py-3 text-right font-extrabold ${colorClase}">${signo}$${item.monto.toLocaleString("es-CO")}</td>
            </tr>
          `;
        }
      });

      if (!hayMovimientos) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-xs text-slate-400">No hay movimientos registrados para este cliente.</td></tr>`;
      }

      deudaTxt.textContent = `$${totalCuenta.toLocaleString("es-CO")}`;
    }
  });
}

// 3. LÓGICA DEL PANEL DEL CLIENTE
const tablaCliente = document.getElementById("tabla-cliente");
if (tablaCliente) {
  const sesion = JSON.parse(localStorage.getItem("sesion_activo"));
  if (!sesion || sesion.tipo !== "cliente") {
    window.location.href = "index.html";
  } else {
    document.getElementById("nombre-cliente-saludo").textContent = `Bienvenido, ${sesion.nombre}`;
  }

  onValue(ref(db, 'fiados_tienda'), (snapshot) => {
    const data = snapshot.val() || {};
    tablaCliente.innerHTML = "";
    let miTotal = 0;

    Object.keys(data).forEach(key => {
      const item = data[key];
      if (item.cliente === sesion.nombre) {
        miTotal += item.monto;
        const esAbono = item.monto < 0;
        const colorClase = esAbono ? "text-emerald-600" : "text-blue-600";
        const signo = esAbono ? "" : "+";

        tablaCliente.innerHTML += `
          <tr class="hover:bg-slate-50">
            <td class="py-3 text-xs text-slate-500">${item.fechaHora}</td>
            <td class="py-3 text-slate-600">${item.concepto}</td>
            <td class="py-3 text-right font-extrabold ${colorClase}">${signo}$${item.monto.toLocaleString("es-CO")}</td>
          </tr>
        `;
      }
    });
    document.getElementById("mi-deuda").textContent = `$${miTotal.toLocaleString("es-CO")}`;
  });
}
