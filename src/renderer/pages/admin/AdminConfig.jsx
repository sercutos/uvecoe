import React, { useState, useEffect } from 'react';

export default function AdminConfig({ onConfigSuccess }) {
  const [ecoes, setEcoes] = useState([]);
  const [stations, setStations] = useState([]);
  
  const [selectedEcoe, setSelectedEcoe] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const API_BASE_URL = "http://localhost:8000/backend/api/v1";

  // 1. Cargar los ECOEs disponibles al montar la pantalla
  useEffect(() => {
    async function fetchEcoes() {
      try {
        const token = sessionStorage.getItem("token_ecoe");

        const response = await fetch(`${API_BASE_URL}/ecoes`,{
            method: "GET",
            headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
            }
        });
        
        if (!response.ok) {
            throw new Error("Respuesta no autorizada o error de servidor");
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            setEcoes(data);
        } else {
            setEcoes([]);
            setStatusMessage("⚠️ El servidor no devolvió una lista válida.");
        }

      } catch (error) {
        console.error("Error cargando ECOEs del servidor:", error);
        setEcoes([]); // Evita que explote el .map() al dejarlo como array vacío
        setStatusMessage("❌ No autorizado. Inicie sesión en el servidor primero.");
      }
    }
    fetchEcoes();
  }, []);

  // 2. Cargar las estaciones cuando cambie el ECOE seleccionado
  useEffect(() => {
    if (!selectedEcoe) {
      setStations([]);
      return;
    }

    async function fetchStations() {
      try {
        const token = sessionStorage.getItem("token_ecoe");

        const response = await fetch(`${API_BASE_URL}/stations?ecoe_id=${selectedEcoe}`, {
            method: "GET",
            headers: {
            "Content-Type": "application/json",
            // 🚀 Le pasamos el token para que FastAPI nos deje pasar
            "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Respuesta no autorizada en estaciones");
        }

        const data = await response.json();
        
        if (data && Array.isArray(data.items)) {
            setStations(data.items);
        } else if (Array.isArray(data)) {
            // Por si acaso otro endpoint devolviera el array limpio
            setStations(data);
        } else {
            setStations([]);
            setStatusMessage("⚠️ El servidor no devolvió una lista de estaciones válida.");
        }

        } catch (error) {
            console.error("Error cargando estaciones:", error);
            setStations([]); // Evita que explote el .map()
            setStatusMessage("❌ Error al cargar las estaciones. Permiso denegado por el servidor.");
        }
    }

    fetchStations();
    }, [selectedEcoe]);

  // 3. Descarga en cadena y guardado en SQLite
  const handleConfigurarPortatil = async (e) => {
    e.preventDefault();
    if (!selectedEcoe || !selectedStation) return;

    setLoading(true);
    setStatusMessage("⏳ Descargando datos del servidor...");

    try {
        const token = sessionStorage.getItem("token_ecoe");
        // Encontrar el objeto de la estación elegida para guardar su nombre real
        const estacionActiva = stations.find(s => s.id === Number(selectedStation));
            // A) GUARDAR CONFIGURACIÓN BÁSICA LOCAL
            // Asumimos que tu endpoint de estaciones te da el block_id asociado. Si no, ponle un valor temporal.
        const configLocal = {
            ecoe_id: Number(selectedEcoe),
            station_id: Number(selectedStation),
            station_name: estacionActiva?.name || `Estación ${selectedStation}`,
            block_id: estacionActiva?.block_id || 1 
        };
        await window.api.guardarConfiguracion(configLocal);

        // B) DESCARGAR PREGUNTAS (RÚBRICA) DE LA ESTACIÓN
        setStatusMessage("⏳ Descargando rúbrica de la estación...");
        const resPreguntas = await fetch(`${API_BASE_URL}/questions?station_id=${selectedStation}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!resPreguntas.ok) {
            throw new Error(`Error en el servidor al descargar preguntas (Status: ${resPreguntas.status})`);
        }
        const dataPreguntas = await resPreguntas.json();
        const preguntas = dataPreguntas.items || dataPreguntas;
      
        // C) DESCARGAR ALUMNOS (PLANNER) DE LA ESTACIÓN
        setStatusMessage("⏳ Descargando lista de alumnos asignados...");
        const resAlumnos = await fetch(`${API_BASE_URL}/students?station_id=${selectedStation}`, {
            method: "GET",
            headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
            }
        });
        if (!resAlumnos.ok) {
            throw new Error(`Error en el servidor al descargar alumnos (Status: ${resAlumnos.status})`);
        }

        const dataAlumnos = await resAlumnos.json();
        const alumnos = dataAlumnos.items || dataAlumnos;
        // C.2) 🚀 NUEVO: DESCARGAR USUARIOS DE LA ORGANIZACIÓN
        setStatusMessage("⏳ Descargando lista de usuarios y evaluadores...");
        const resUsers = await fetch(`${API_BASE_URL}/users`, { // 👈 Revisa si este es tu path exacto
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        if (!resUsers.ok) {
          throw new Error(`Error en el servidor al descargar usuarios (Status: ${resUsers.status})`);
        }

        const dataUsers = await resUsers.json();
        const usuarios = dataUsers.items || dataUsers; // Extrae .items si viniera envuelto
        // D) VOLCAR DATOS A SQLITE MEDIANTE IPC
        setStatusMessage("⏳ Almacenando información en la base de datos local SQLite...");
        
        // Enviamos a Electron las preguntas, alumnos y usuarios para que haga los inserts masivos
        await window.api.invoke("db:guardarDatosIniciales", { preguntas, alumnos, usuarios });

        setStatusMessage("✅ ¡Portátil configurado con éxito y listo para trabajar Offline!");
        setLoading(false);

        // Notificar al componente padre que la configuración terminó para cambiar de vista
        if (onConfigSuccess) {
            setTimeout(() => onConfigSuccess(), 1500);
        }

    } catch (error) {
      console.error("Error en la sincronización inicial:", error);
      setStatusMessage("❌ Error crítico durante la descarga. Revisa la consola.");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>⚙️ Panel de Configuración del Administrador</h2>
      <p>Configure este portátil seleccionando el examen y la estación correspondiente antes de iniciar el ECOE.</p>
      <hr />

      <form onSubmit={handleConfigurarPortatil} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>1. Seleccione el ECOE:</label>
          <select 
            value={selectedEcoe} 
            onChange={(e) => setSelectedEcoe(e.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
            required
          >
            <option value="">-- Seleccionar Examen --</option>
            {Array.isArray(ecoes) && ecoes.map(ecoe => (
                <option key={ecoe.id} value={ecoe.id}>
                {ecoe.nombre || ecoe.name || `ECOE ID: ${ecoe.id}`}
                </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>2. Seleccione la Estación de este Equipo:</label>
            <select 
                value={selectedStation} 
                onChange={(e) => setSelectedStation(e.target.value)}
                disabled={loading || !selectedEcoe}
                style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                required
                >
                <option value="">-- Seleccionar Estación --</option>
                {/* 🚀 Validación de seguridad para que nunca vuelva a tirar un Uncaught TypeError */}
                {Array.isArray(stations) && stations.map(station => (
                    <option key={station.id} value={station.id}>
                    {station.name} (ID: {station.id})
                    </option>
                ))}
            </select>
        </div>

        <button 
          type="submit" 
          disabled={loading || !selectedStation}
          style={{ 
            padding: '12px', 
            fontSize: '16px', 
            backgroundColor: loading ? '#ccc' : '#007bff', 
            color: '#fff', 
            border: 'none', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? "Procesando..." : "📥 Descargar Datos y Bloquear Portátil"}
        </button>
      </form>

      {statusMessage && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderLeft: '5px solid #007bff', fontWeight: '500' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}