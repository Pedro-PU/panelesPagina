import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Database, ref, onValue } from '@angular/fire/database';
import { Chart, registerables } from 'chart.js';

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
            const voltaje = voltajeRaw !== null ? this.mapVoltaje(voltajeRaw) : null;
            const tiempo = parts.length > 0 ? parts[0].trim() : '';
    
            // Convertimos el tiempo a un objeto Date para ordenar
            const tiempoOrdenable = this.convertirATiempoOrdenable(tiempo);
            const panel = this.getPanelFromSender(sender);
    
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



  mapVoltaje(voltajeRaw: number): number {
    const mappedVoltaje = voltajeRaw * 0.062;
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
        const voltajesPorPanel: { [panel: string]: number[] } = {};

        this.mensajesAgrupados[fecha].forEach(mensaje => {
          if (!voltajesPorPanel[mensaje.panel]) {
            voltajesPorPanel[mensaje.panel] = [];
          }
          if (mensaje.voltaje !== null) {
            voltajesPorPanel[mensaje.panel].push(mensaje.voltaje);
          }
        });

        this.promediosPorFecha[fecha] = [];

        for (const panel in voltajesPorPanel) {
          if (voltajesPorPanel.hasOwnProperty(panel)) {
            const voltajes = voltajesPorPanel[panel];
            const promedio = this.calcularPromedio(voltajes);
            this.promediosPorFecha[fecha].push({ panel, promedio });
          }
        }
      }
    }
  }

  calcularPromedio(voltajes: number[]): number {
    const voltajesFiltrados = voltajes.filter(v => v > 0);
    if (voltajesFiltrados.length === 0) return 0;
    const suma = voltajesFiltrados.reduce((acc, val) => acc + val, 0);
    return parseFloat((suma / voltajesFiltrados.length).toFixed(2));
  }
  convertirAVatios(voltajePromedio: number): number {
    const vatios = ((voltajePromedio ** 2) / 24)*2;//18
    return parseFloat(vatios.toFixed(2));
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
            label: 'Promedio de Voltaje (V)',
            data: [promedio],
            backgroundColor: ['#3e95cd'],
            borderColor: ['#3e95cd'],
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              max: 250
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

  // ✅ Reemplaza tu exportarCSV completo por este
  exportarCSV() {
    const panels = ['Panel TUGULA', 'Panel CALEDONIA', 'Panel SAN CRISTOBAL'];
    // Fuerza a Excel a usar ';' como separador
    let csvContent = 'data:text/csv;charset=utf-8,sep=;\n';

    panels.forEach(panel => {
      csvContent += `${panel}\n`; // título del panel

      for (const fechaIso of this.getFechas()) {
        const mensajesPanel = this.getPanelMessages(fechaIso, panel);
        if (mensajesPanel.length > 0) {
          // Muestra como YYYY/MM/DD para que no se confunda
          const fechaParaCSV = fechaIso.replace(/-/g, '/'); // "YYYY/MM/DD"
          csvContent += `${fechaParaCSV};\n`;
          csvContent += 'Hora;Voltaje (V)\n';

          mensajesPanel.forEach(m => {
            const horaMatch = m.tiempo.match(/,(\d{2}:\d{2}:\d{2})/);
            const hora = horaMatch ? horaMatch[1] : '';
            csvContent += `${hora};${m.voltaje}\n`;
          });

          csvContent += '\n'; // espacio entre fechas
        }
      }

      csvContent += '\n'; // espacio entre paneles
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const fechaActual = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `voltajes_${fechaActual}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

}