import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, get, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// 1. LÓGICA DE LOGIN
const ROLES_VENDEDOR = ["tendero", "vendedor"];

function buscarCuenta(registros, usuario, password) {
  for (const key of Object.keys(registros || {})) {
    const c = registros[key];
    if (!c || typeof c.usuario !== "string") continue;
    if (c.usuario.trim().toLowerCase() === usuario && String(c.password).trim() === password) {
      return { key, datos: c };
    }
  }
  return null;
}

function entrarComoTendero(nombre, usuario, origen, firebaseKey) {
  localStorage.setItem("sesion_activo", JSON.stringify({ tipo: "tendero", usuario, nombre, origen, firebaseKey }));
  window.location.href = "panel-tendero.html";
}

const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuarioIngresado = document.getElementById("usuario").value.trim().toLowerCase();
    const passwordIngresado = document.getElementById("password").value.trim();
    const errorMsg = document.getElementById("error-msg");
    errorMsg.classList.add("hidden");

    try {
      // a) Vendedores guardados en Firebase (nodo "vendedores_tienda")
      let vendedores = {};
      try {
        vendedores = (await get(ref(db, "vendedores_tienda"))).val() || {};
      } catch (_) { /* si el nodo no existe o no hay permiso, seguimos */ }

      const v = buscarCuenta(vendedores, usuarioIngresado, passwordIngresado);
      if (v) {
        entrarComoTendero(v.datos.nombre || v.datos.usuario, usuarioIngresado, "vendedores", v.key);
        return;
      }

      // b) Vendedor fijo: solo vale si NO ha cambiado su contraseña (si la cambió, queda en Firebase)
      if (usuarioIngresado === VENDEDOR_USER && passwordIngresado === VENDEDOR_PASS && !vendedores[VENDEDOR_USER]) {
        entrarComoTendero("Tendero", VENDEDOR_USER, "fijo", VENDEDOR_USER);
        return;
      }

      // c) Cuentas en "clientes_tienda": si tienen rol de vendedor van al panel del tendero
      const snapC = await get(ref(db, "clientes_tienda"));
      const hallado = buscarCuenta(snapC.val(), usuarioIngresado, passwordIngresado);

      if (!hallado) {
        errorMsg.textContent = "Usuario o contraseña incorrectos.";
        errorMsg.classList.remove("hidden");
        return;
      }

      const rol = String(hallado.datos.rol || hallado.datos.tipo || "").toLowerCase();
      if (ROLES_VENDEDOR.includes(rol)) {
        entrarComoTendero(hallado.datos.nombre || hallado.datos.usuario, usuarioIngresado, "clientes", hallado.key);
        return;
      }

      localStorage.setItem("sesion_activo", JSON.stringify({
        tipo: "cliente",
        nombre: hallado.datos.nombre,
        firebaseKey: hallado.key
      }));
      window.location.href = "panel-cliente.html";
    } catch (err) {
      errorMsg.textContent = "No se pudo conectar. Revisa tu internet e intenta de nuevo.";
      errorMsg.classList.remove("hidden");
    }
  });
}

const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("sesion_activo");
    window.location.href = "index.html";
  });
}

let clienteSeleccionadoParaEditar = null;
let idFirebaseClienteSeleccionado = null;

// 2. LÓGICA DEL PANEL DEL TENDERO
const formCrearCliente = document.getElementById("form-crear-cliente");
const listaClientesTendero = document.getElementById("lista-clientes-tendero");
const formFiadoIndividual = document.getElementById("form-fiado-individual");
const btnEliminarCuenta = document.getElementById("btn-eliminar-cuenta");

if (window.location.pathname.includes("panel-tendero.html") || listaClientesTendero) {
  const sesion = JSON.parse(localStorage.getItem("sesion_activo"));
  if (!sesion || sesion.tipo !== "tendero") {
    window.location.href = "index.html";
  }

  const saludoTendero = document.getElementById("nombre-tendero-saludo");
  if (saludoTendero && sesion && sesion.nombre) {
    saludoTendero.textContent = `Bienvenido, ${sesion.nombre}`;
  }

  // CAMBIAR CONTRASEÑA DEL VENDEDOR
  const formCambiarPass = document.getElementById("form-cambiar-pass");
  if (formCambiarPass) {
    formCambiarPass.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("msg-cambiar-pass");
      const mostrar = (texto, ok) => {
        msg.textContent = texto;
        msg.className = "text-xs font-semibold text-center p-2 rounded-lg " +
          (ok ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50");
      };

      const actual = document.getElementById("pass-actual").value.trim();
      const nueva = document.getElementById("pass-nueva").value.trim();
      const confirmar = document.getElementById("pass-confirmar").value.trim();

      if (nueva.length < 6) return mostrar("La nueva contraseña debe tener al menos 6 caracteres.", false);
      if (nueva !== confirmar) return mostrar("La confirmación no coincide con la nueva contraseña.", false);
      if (nueva === actual) return mostrar("La nueva contraseña debe ser diferente a la actual.", false);

      const origen = sesion.origen || "fijo";
      if (origen !== "fijo" && !sesion.firebaseKey) {
        return mostrar("Cierra sesión y vuelve a entrar para poder cambiar la contraseña.", false);
      }

      try {
        let refCuenta;
        let passGuardada;

        if (origen === "fijo") {
          refCuenta = ref(db, `vendedores_tienda/${VENDEDOR_USER}`);
          const snap = await get(refCuenta);
          passGuardada = snap.exists() ? String(snap.val().password) : VENDEDOR_PASS;
        } else {
          const nodo = origen === "clientes" ? "clientes_tienda" : "vendedores_tienda";
          refCuenta = ref(db, `${nodo}/${sesion.firebaseKey}`);
          const snap = await get(refCuenta);
          passGuardada = String((snap.val() || {}).password);
        }

        if (actual !== passGuardada) {
          return mostrar("La contraseña actual no es correcta.", false);
        }

        if (origen === "fijo") {
          await set(refCuenta, { nombre: "Tendero", usuario: VENDEDOR_USER, password: nueva });
        } else {
          await update(refCuenta, { password: nueva });
        }

        formCambiarPass.reset();
        mostrar("¡Contraseña actualizada con éxito!", true);
      } catch (err) {
        mostrar("No se pudo cambiar la contraseña. Revisa tu conexión e intenta de nuevo.", false);
      }
    });
  }

  if (formCrearCliente) {
    formCrearCliente.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = document.getElementById("nuevo-nombre").value.trim();
      const usuario = document.getElementById("nuevo-user").value.trim().toLowerCase();
      const password = document.getElementById("nuevo-pass").value.trim();

      if (!nombre || !usuario || !password) {
        alert("Por favor completa todos los campos.");
        return;
      }

      const nuevoClienteRef = push(ref(db, 'clientes_tienda'));
      set(nuevoClienteRef, { 
        nombre, 
        usuario, 
        password, 
        deudaActual: 0, 
        conceptoActual: "Al día (Sin deudas)" 
      })
        .then(() => {
          alert(`¡Cuenta creada con éxito para ${nombre}!`);
          formCrearCliente.reset();
        })
        .catch((error) => {
          alert("Error al crear cuenta: " + error.message);
        });
    });
  }

  onValue(ref(db, 'clientes_tienda'), (snapshot) => {
    const clientes = snapshot.val() || {};
    if (listaClientesTendero) {
      listaClientesTendero.innerHTML = "";
      
      if (Object.keys(clientes).length === 0) {
        listaClientesTendero.innerHTML = `<p class="text-xs text-slate-400 p-2">No hay clientes creados.</p>`;
        return;
      }

      Object.keys(clientes).forEach(key => {
        const c = clientes[key];
        const activoClase = clienteSeleccionadoParaEditar === c.nombre ? "bg-blue-50 border-blue-500 text-blue-700 font-bold" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700";
        const deudaTxt = c.deudaActual !== undefined ? `$${c.deudaActual.toLocaleString("es-CO")}` : "$0";
        
        const divCliente = document.createElement("div");
        divCliente.className = `p-3 rounded-xl border text-sm cursor-pointer transition flex justify-between items-center ${activoClase}`;
        divCliente.innerHTML = `
          <div>
            <p class="font-bold">${c.nombre}</p>
            <p class="text-xs text-slate-400">Debe: <span class="font-semibold text-slate-700">${deudaTxt}</span></p>
          </div>
          <span class="text-xs bg-white px-2 py-1 rounded-lg border shadow-sm">Abrir &rarr;</span>
        `;

        divCliente.addEventListener("click", () => {
          clienteSeleccionadoParaEditar = c.nombre;
          idFirebaseClienteSeleccionado = key;
          document.getElementById("sin-seleccion").classList.add("hidden");
          document.getElementById("panel-cliente-activo").classList.remove("hidden");
          document.getElementById("titulo-cliente-activo").textContent = c.nombre;
        });

        listaClientesTendero.appendChild(divCliente);
      });
    }
  });

  if (btnEliminarCuenta) {
    btnEliminarCuenta.addEventListener("click", () => {
      if (!clienteSeleccionadoParaEditar || !idFirebaseClienteSeleccionado) return;

      const confirmar = confirm(`¿Estás seguro de eliminar la cuenta de ${clienteSeleccionadoParaEditar}?`);
      if (confirmar) {
        remove(ref(db, `clientes_tienda/${idFirebaseClienteSeleccionado}`))
          .then(() => {
            alert("Cuenta eliminada con éxito.");
            clienteSeleccionadoParaEditar = null;
            idFirebaseClienteSeleccionado = null;
            document.getElementById("sin-seleccion").classList.remove("hidden");
            document.getElementById("panel-cliente-activo").classList.add("hidden");
          });
      }
    });
  }

  if (formFiadoIndividual) {
    formFiadoIndividual.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!clienteSeleccionadoParaEditar || !idFirebaseClienteSeleccionado) {
        alert("Selecciona un cliente primero.");
        return;
      }

      const tipo = document.getElementById("tipo-movimiento").value; 
      const conceptoInput = document.getElementById("concepto").value.trim();
      const montoInput = parseFloat(document.getElementById("monto").value);

      const clienteRef = ref(db, `clientes_tienda/${idFirebaseClienteSeleccionado}`);
      onValue(clienteRef, (snapshot) => {
        const datosCliente = snapshot.val() || {};
        let deudaActual = datosCliente.deudaActual || 0;
        let nuevoConcepto = "";
        let nuevaDeuda = 0;

        if (tipo === "fiado") {
          nuevaDeuda = deudaActual + montoInput;
          nuevoConcepto = conceptoInput; 
        } else {
          nuevaDeuda = deudaActual - montoInput;
          if (nuevaDeuda <= 0) {
            nuevaDeuda = 0;
            nuevoConcepto = "¡Cuenta al día / Pagado!";
          } else {
            nuevoConcepto = `Abono: ${conceptoInput} (Resta $${nuevaDeuda.toLocaleString("es-CO")})`;
          }
        }

        update(clienteRef, {
          deudaActual: nuevaDeuda,
          conceptoActual: nuevoConcepto,
          ultimaActualizacion: new Date().toLocaleString("es-CO", {
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
          })
        }).then(() => {
          formFiadoIndividual.reset();
          alert(`¡Actualizado! Nuevo saldo pendiente: $${nuevaDeuda.toLocaleString("es-CO")}`);
        });

      }, { onlyOnce: true });
    });
  }

  onValue(ref(db, `clientes_tienda`), (snapshot) => {
    const clientes = snapshot.val() || {};
    const tbody = document.getElementById("tabla-cliente-activo");
    const deudaTxt = document.getElementById("deuda-cliente-activo");

    if (tbody && clienteSeleccionadoParaEditar && idFirebaseClienteSeleccionado) {
      const c = clientes[idFirebaseClienteSeleccionado];
      if (c) {
        const deuda = c.deudaActual || 0;
        deudaTxt.textContent = `$${deuda.toLocaleString("es-CO")}`;

        tbody.innerHTML = `
          <tr class="hover:bg-slate-50">
            <td class="py-3 text-xs text-slate-500">${c.ultimaActualizacion || "Reciente"}</td>
            <td class="py-3 text-slate-700 font-medium">${c.conceptoActual || "Sin movimientos"}</td>
            <td class="py-3 text-right font-extrabold ${deuda > 0 ? 'text-blue-600' : 'text-emerald-600'}">$${deuda.toLocaleString("es-CO")}</td>
          </tr>
        `;
      }
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

  if (sesion && sesion.firebaseKey) {
    onValue(ref(db, `clientes_tienda/${sesion.firebaseKey}`), (snapshot) => {
      const c = snapshot.val() || {};
      const miDeudaTotal = c.deudaActual || 0;
      const miConcepto = c.conceptoActual || "Al día";
      const ultimaFecha = c.ultimaActualizacion || "-";

      document.getElementById("mi-deuda").textContent = `$${miDeudaTotal.toLocaleString("es-CO")}`;

      tablaCliente.innerHTML = `
        <tr class="hover:bg-slate-50">
          <td class="py-3 text-xs text-slate-500">${ultimaFecha}</td>
          <td class="py-3 text-slate-700 font-medium">${miConcepto}</td>
          <td class="py-3 text-right font-extrabold ${miDeudaTotal > 0 ? 'text-blue-600' : 'text-emerald-600'}">$${miDeudaTotal.toLocaleString("es-CO")}</td>
        </tr>
      `;
    });
  }
}
