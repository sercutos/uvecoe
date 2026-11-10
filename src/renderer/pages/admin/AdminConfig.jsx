import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from "../../utils/apiConfig";
import { timeoutSignal } from "../../utils/api";
import { fetchStationData } from "../../utils/stationData";

export default function AdminConfig({ onConfigSuccess }) {
  const [ecoes, setEcoes] = useState([]);
  const [stations, setStations] = useState([]);
  
  const [selectedEcoe, setSelectedEcoe] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const getApiUrl = () => `${getApiBaseUrl()}/backend/api/v1`;

  // 1. Cargar los ECOEs disponibles al montar la pantalla
  useEffect(() => {
    async function fetchEcoes() {
      try {
        const token = sessionStorage.getItem("token_ecoe");

        const response = await fetch(`${getApiUrl()}/ecoes`,{
            method: "GET",
            headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
            },
            signal: timeoutSignal()
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
        setStatusMessage(
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "❌ El servidor no respondió a tiempo."
            : "❌ No autorizado. Inicie sesión en el servidor primero."
        );
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

        const response = await fetch(`${getApiUrl()}/stations?ecoe_id=${selectedEcoe}`, {
            method: "GET",
            headers: {
            "Content-Type": "application/json",
            // 🚀 Le pasamos el token para que FastAPI nos deje pasar
            "Authorization": `Bearer ${token}`
            },
            signal: timeoutSignal()
        });

        if (!response.ok) {
            throw new Error("Respuesta no autorizada en estaciones");
        }

        const data = await response.json();
        
        if (data && Array.isArray(data.items)) {
            setStations(data.items);
            //console.log("STATIONS (items):", data.items);
            //console.log("ESTACIÓN EJEMPLO:", data.items?.[0]);
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
            setStatusMessage(
                error.name === "TimeoutError" || error.name === "AbortError"
                    ? "❌ El servidor no respondió a tiempo."
                    : "❌ Error al cargar las estaciones. Permiso denegado por el servidor."
            );
        }
    }

    fetchStations();
    }, [selectedEcoe]);
    
  // 3. Descarga completa y guardado en SQLite
  const handleConfigurarPortatil = async (e) => {
    e.preventDefault();
    if (!selectedEcoe || !selectedStation) return;

    setLoading(true);
    setStatusMessage("⏳ Descargando datos del servidor...");

    try {
      const estacionActiva = stations.find(
        (s) => Number(s.id) === Number(selectedStation)
      );

      setStatusMessage(
        "⏳ Descargando bloque, rúbrica, alumnos, planificación y respuestas..."
      );

      const data = await fetchStationData({
        ecoeId: Number(selectedEcoe),
        stationId: Number(selectedStation)
      });

      const configLocal = {
        ecoe_id: Number(selectedEcoe),
        station_id: Number(selectedStation),
        station_name:
          estacionActiva?.name ||
          data.station?.name ||
          `Estación ${selectedStation}`,
        block_id: data.block.id,
        station_order:
          data.station?.order ?? estacionActiva?.order ?? null
      };

      setStatusMessage(
        "⏳ Almacenando información en la base de datos local SQLite..."
      );

      // Primero los datos y al final la configuración: si algo falla,
      // el portátil no queda marcado como configurado a medias.
      await window.api.guardarDatosIniciales({
        stationId: configLocal.station_id,
        id_block: configLocal.block_id,
        questions: data.questions,
        students: data.students,
        users: data.users,
        shifts: data.shifts,
        rounds: data.rounds,
        planners: data.planners,
        answers: data.answers
      });

      await window.api.guardarConfiguracion(configLocal);

      setStatusMessage(
        "✅ ¡Portátil configurado con éxito y listo para trabajar Offline!"
      );
      setLoading(false);

      if (onConfigSuccess) {
        setTimeout(() => onConfigSuccess(), 1500);
      }
    } catch (error) {
      console.error("Error en la sincronización inicial:", error);
      setStatusMessage(
        `❌ Error crítico durante la descarga: ${error.message}`
      );
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
            <option value="">-- Seleccionar Examen --</option>            {Array.isArray(ecoes) && ecoes.map(ecoe => (
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