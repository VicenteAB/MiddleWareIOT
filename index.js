const express = require('express');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const THINGSBOARD_URL = 'http://iot.ceisufro.cl:8080';
const USERNAME = 'v.aburto04@ufromail.cl';
const PASSWORD = 'gt-m3710';
const DEVICE_ID = '532a4ce0-1c2a-11ef-9ae0-45d10902f7b5';

let authToken = '';
let movementTime = 0;
let lastTimestamp = Date.now();
let isMoving = false;

// Autenticación y obtención del token de usuario
async function authenticate() {
    try {
        const response = await axios.post(`${THINGSBOARD_URL}/api/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        });
        authToken = response.data.token;
        console.log('Autenticación exitosa');
    } catch (error) {
        console.error('Error al autenticar:', error);
    }
}

// Obtención de datos de telemetría del dispositivo
async function getTelemetry() {
    try {
        const response = await axios.get(`${THINGSBOARD_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries?keys=moving`, {
            headers: { 'X-Authorization': `Bearer ${authToken}` }
        });
        return response.data;
    } catch (error) {
        console.error('Error al obtener telemetría:', error);
        return null;
    }
}

// Cálculo del tiempo en movimiento
function calculateMovementTime(telemetry) {
    if (!telemetry.moving) {
        console.log('No se encontraron datos de movimiento.');
        return;
    }

    telemetry.moving.forEach(entry => {
        const timestamp = entry.ts;
        const moving = entry.value === 'true';

        if (moving) {
            if (isMoving) {
                // Si el dispositivo ya está en movimiento, acumular el tiempo
                movementTime += (timestamp - lastTimestamp);
            } else {
                // Si el dispositivo empieza a moverse, actualizar el estado
                isMoving = true;
            }
            lastTimestamp = timestamp;
        } else {
            if (isMoving) {
                // Si el dispositivo deja de moverse, actualizar el estado
                isMoving = false;
                lastTimestamp = timestamp;
            }
        }
    });

    console.log(`Tiempo de movimiento acumulado: ${movementTime / 1000} segundos.`);
}

// Función para obtener y calcular datos periódicamente y emitir eventos a través de WebSockets
async function fetchAndCalculate() {
    const telemetry = await getTelemetry();
    if (telemetry) {
        calculateMovementTime(telemetry);
        io.emit('movement-time', { movementTime: movementTime / 1000 });
    } else {
        await authenticate(); // Reautenticación si falla la obtención de datos
    }
}

// Configuración de WebSocket
io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');
    socket.emit('movement-time', { movementTime: movementTime / 1000 });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

// Pa que pesque el html en public
app.use(express.static('public'));

// Inicio del servidor y configuración de intervalos
server.listen(3000, async () => {
    console.log('Servidor escuchando en el puerto 3000');
    await authenticate();
    setInterval(fetchAndCalculate, 3000); // Intervalo de 1 minuto
});
