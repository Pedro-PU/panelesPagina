import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Database, ref, onValue } from '@angular/fire/database';
import { Chart, registerables } from 'chart.js';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit {
  mensajesAgrupados: { [fecha: string]: { panel: string, voltaje: number | null, tiempo: string }[] } = {};
  promediosPorFecha: { [fecha: string]: { panel: string, promedio: number }[] } = {};
  charts: { [key: string]: Chart } = {}; // Asegúrate de que esta línea esté presente
  
  constructor(private database: Database) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    const ruta = ref(this.database, 'voltaje/voltios');
    const actualizarDatos = () => {
      onValue(ruta, (snapshot) => {
        const valores_db = snapshot.val();
        const mensajes: { panel: string, voltaje: number | null, tiempo: string, tiempoOrdenable: Date }[] = [];
        this.mensajesAgrupados = {};
        this.promediosPorFecha = {};
    
        // Recopilamos los mensajes en un array
        for (const key in valores_db) {
          if (valores_db.hasOwnProperty(key)) {
            const { message, sender } = valores_db[key];
            const parts = message.split('"');
            const voltagePart = parts.length > 1 ? parts[1].trim() : '';
            const regex = /\d+$/;
            const match = voltagePart.match(regex);
            const voltajeRaw = match ? parseInt(match[0], 10) : null;
            const tiempo = parts.length > 0 ? parts[0].trim() : '';
    
            // Convertimos el tiempo a un objeto Date para ordenar
            const tiempoOrdenable = this.convertirATiempoOrdenable(tiempo);
            const panel = this.getPanelFromSender(sender);

            const voltaje = voltajeRaw !== null ? this.ajustarValor(voltajeRaw, tiempoOrdenable) : null;

    
            mensajes.push({ panel, voltaje, tiempo, tiempoOrdenable });
          }
        }
    
        // Ordenamos los mensajes por el campo `tiempoOrdenable`
        mensajes.sort((a, b) => a.tiempoOrdenable.getTime() - b.tiempoOrdenable.getTime());
    
        // Agrupamos los mensajes por fecha
        mensajes.forEach(mensaje => {
          const fecha = this.extraerFecha(mensaje.tiempo);
          if (!this.mensajesAgrupados[fecha]) {
            this.mensajesAgrupados[fecha] = [];
          }
          this.mensajesAgrupados[fecha].push(mensaje);
        });
    
        this.calcularPromedios();
        this.generarGraficas(); // Regenerar las gráficas después de actualizar los datos
      });
    };
    actualizarDatos(); // Cargar inicialmente
    setInterval(actualizarDatos, 60000); // Actualizar cada 60 segundos
  };
  

  
  getPromedioPorPanel(fecha: string, panel: string): number {
    const promediosPaneles = this.promediosPorFecha[fecha];
    if (promediosPaneles) {
      const panelData = promediosPaneles.find(p => p.panel === panel);
      if (panelData) {
        return panelData.promedio;
      }
    }
    return 0; // En caso de no encontrar datos, devuelve 0
  }
  

  ngAfterViewInit() {
    this.generarGraficas();
  }

  ajustarValor(voltajeRaw: number, fecha: Date): number {
    let mappedVoltaje = voltajeRaw * 2;
    if (mappedVoltaje < 1000) { 
      mappedVoltaje += 800;
    } else if (mappedVoltaje >= 1000 && mappedVoltaje <= 2000) { 
      mappedVoltaje += 400;
    } 
    // >2000 no se toca
    return parseFloat(mappedVoltaje.toFixed(2)); 
  }



  getPanelFromSender(sender: string): string {
    switch (sender) {
      case '+593982138667':
        return 'Panel CALEDONIA';
      case '+593996002370':
        return 'Panel TUGULA';
      case '+593962380047':
        return 'Panel SAN CRISTOBAL';
      default:
        return 'Panel desconocido';
    }
  }
  
  calcularPromedios() {
    for (const fecha in this.mensajesAgrupados) {
      if (this.mensajesAgrupados.hasOwnProperty(fecha)) {
        const potenciasPorPanel: { [panel: string]: number[] } = {};

        this.mensajesAgrupados[fecha].forEach(mensaje => {
          if (!potenciasPorPanel[mensaje.panel]) {
            potenciasPorPanel[mensaje.panel] = [];
          }
          if (mensaje.voltaje !== null) { // aquí voltaje es en realidad potencia
            potenciasPorPanel[mensaje.panel].push(mensaje.voltaje);
          }
        });

        this.promediosPorFecha[fecha] = [];

        for (const panel in potenciasPorPanel) {
          if (potenciasPorPanel.hasOwnProperty(panel)) {
            const valores = potenciasPorPanel[panel];
            const suma = valores.reduce((acc, val) => acc + val, 0);
            const promedio = (suma / (3 * 120000)) * 100;
            this.promediosPorFecha[fecha].push({ panel, promedio: parseFloat(promedio.toFixed(2)) });
          }
        }
      }
    }
  }
  

  generarGraficas() {
    // Eliminar las gráficas anteriores antes de regenerarlas
    for (const chartKey in this.charts) {
      if (this.charts.hasOwnProperty(chartKey)) {
        this.charts[chartKey].destroy();
      }
    }
    this.charts = {}; // Limpiar el mapa de gráficas

    setTimeout(() => {
      for (const fecha in this.promediosPorFecha) {
        if (this.promediosPorFecha.hasOwnProperty(fecha)) {
          this.promediosPorFecha[fecha].forEach(panelData => {
            const canvasId = `chart-${fecha}-${panelData.panel}`;
            this.generarGrafica(canvasId, panelData.panel, panelData.promedio);
          });
        }
      }
    }, 500); // Asegurar que las gráficas se generen después de que el DOM esté listo.
  }

  generarGrafica(canvasId: string, label: string, promedio: number) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: [label],
          datasets: [{
            label: 'Potencia (%)',
            data: [promedio],
            backgroundColor: ['#3e95cd'],
            borderColor: ['#3e95cd'],
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  getPanelMessages(fecha: string, panel: string) {
    return this.mensajesAgrupados[fecha].filter(mensaje => mensaje.panel === panel);
  }

  // ✅ Reemplaza tu convertirATiempoOrdenable por esta (Y/M/D)
  convertirATiempoOrdenable(tiempo: string): Date {
    // Ejemplos válidos: "25/08/01,22:48:08-20" (yy/mm/dd) o "2025/08/01,22:48:08"
    const regex = /(\d{2,4})\/(\d{2})\/(\d{2}),(\d{2}):(\d{2}):(\d{2})/;
    const match = tiempo.match(regex);

    if (match) {
      let [, y, m, d, hh, mm, ss] = match;
      if (y.length === 2) y = `20${y}`;  // 25 -> 2025
      const fecha = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
      return fecha;
    }
    return new Date();
  }

  // ✅ Reemplaza tu extraerFecha por esta (devuelve ISO: YYYY-MM-DD)
  extraerFecha(tiempo: string): string {
    const regex = /(\d{2,4})\/(\d{2})\/(\d{2})/;
    const match = tiempo.match(regex);
    if (match) {
      let [, y, m, d] = match;
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d}`; // clave de agrupación ordenable
    }
    return 'Fecha desconocida';
  }

  // ✅ (Opcional) Para mostrar la fecha al usuario si quieres dd/mm/yyyy
  private formatearFechaDisplay(iso: string): string {
    // iso: "YYYY-MM-DD" -> "DD/MM/YYYY"
    const [Y, M, D] = iso.split('-');
    return `${D}/${M}/${Y}`;
  }

  // ✅ Reemplaza tu getFechas por este (ordenado cronológicamente)
  getFechas(): string[] {
    return Object.keys(this.mensajesAgrupados).sort(); // ISO ya ordena bien
  }

  exportarXLSX() {
    const panels = ['Panel TUGULA', 'Panel CALEDONIA', 'Panel SAN CRISTOBAL'];
    const wb = XLSX.utils.book_new(); // crea un nuevo libro Excel

    panels.forEach(panel => {
      let rows: (string | number)[][] = [];
      rows.push([panel]); // título del panel

      for (const fechaIso of this.getFechas()) {
        const mensajesPanel = this.getPanelMessages(fechaIso, panel);
        if (mensajesPanel.length > 0) {
          const fechaParaXLSX = fechaIso.replace(/-/g, '/'); // "YYYY/MM/DD"
          rows.push([fechaParaXLSX]); // fecha
          rows.push(['Hora', 'Potencia (W)']); // encabezados

          mensajesPanel.forEach(m => {
            const horaMatch = m.tiempo.match(/,(\d{2}:\d{2}):\d{2}/); // capturamos solo HH:MM
            const hora = horaMatch ? horaMatch[1] : '';
            rows.push([hora, m.voltaje ?? 0]);
          });

          rows.push([]); // espacio entre fechas
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, panel.replace('Panel ', ''));
    });

    const fechaActual = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `potencias_${fechaActual}.xlsx`);
  }

}