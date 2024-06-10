const express = require('express');
const axios = require('axios');
const app = express();

const THINGSBOARD_URL = 'http://iot.ceisufro.cl:8080';
const USERNAME = 'v.aburto04@ufromail.cl';
const PASSWORD = 'gt-m3710';
const DEVICE_ID = '532a4ce0-1c2a-11ef-9ae0-45d10902f7b5';
const DEVICE_TOKEN = 'dkerbmokdpt70rdxmw6e';

let authToken = '';
let movementTime = 0;
let lastTimestamp = Date.now();
let interval;

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
        const response = await axios.get(`${THINGSBOARD_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries?keys=accelerometer`, {
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
    telemetry.accelerometer.forEach(entry => {
        const timestamp = entry.ts;
        const accelData = entry.value;

        const x = parseFloat(accelData.x);
        const y = parseFloat(accelData.y);
        const z = parseFloat(accelData.z);
        const magnitude = Math.sqrt(x * x + y * y + z * z);

        const moving = magnitude < 0.8 || magnitude > 1.2;

        if (moving) {
            if (lastTimestamp) {
                movementTime += (timestamp - lastTimestamp);
            }
        }
        lastTimestamp = timestamp;
    });
}

async function fetchAndCalculate() {
    const telemetry = await getTelemetry();
    if (telemetry) {
        calculateMovementTime(telemetry);
    } else {
        await authenticate(); // Reautenticación si falla la obtención de datos
    }
}

app.get('/movement-time', (req, res) => {
    res.send(`El dispositivo ha estado en movimiento por ${movementTime / 1000} segundos.`);
});

app.listen(3000, async () => {
    console.log('Servidor escuchando en el puerto 3000');
    await authenticate();
    interval = setInterval(fetchAndCalculate, 60000); // Intervalo de 1 minuto
});
