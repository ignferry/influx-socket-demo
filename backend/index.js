require('dotenv').config();

const express = require('express');
const { InfluxDB } = require('@influxdata/influxdb-client');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN || 'token';
const org = process.env.INFLUXDB_ORG || 'org';

const app = express();
app.use(express.json());

app.get('/card/:msisdn/quota', async (req, res) => {
    const queryApi = new InfluxDB({url, token}).getQueryApi(org);

    const interval = parseInt(req.query.interval) || 30;
    const current_date = new Date();
    const min_time = Math.floor((new Date(current_date.getFullYear(), current_date.getMonth(), current_date.getDate() - 1)).getTime() / 1000);
    const msisdn = req.params.msisdn;

    const flux_query = `
        from(bucket:"demo") 
            |> range(start: ${min_time}) 
            |> filter(fn: (r) => 
                r._measurement == "quota" 
                and r["msisdn"] == "${msisdn}"
                )
            |> aggregateWindow(every: ${interval}s, fn: min, createEmpty: true, timeSrc: "_start")
        `;

    for await (const {values, tableMeta} of queryApi.iterateRows(flux_query)) {
        const o = tableMeta.toObject(values);
        console.log(
            `${o._time} ${o._measurement} ${o.msisdn}: ${o._field}=${o._value}`
        )
    }

    res.status(200).json({});
});

app.listen(3000, () => {
    console.log('Server is running at port 3000');
});

const mqtt_url = process.env.MQTT_URL || 'mqtt://localhost:1883';
const mqtt_client = mqtt.connect(mqtt_url, {
    clientId: `mqtt_${Math.random().toString().slice(3)}`,
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME || 'admin',
    password: process.env.MQTT_PASSWORD || 'password',
    reconnectPeriod: 1000
});
mqtt_client.on('connect', () => {
    console.log('Message queue connection established');
    mqtt_client.subscribe('msisdn_quota', () => {
        console.log('Subscribed to msisdn_quota mqtt topic');
    });
});


const socket_app = express();
const server = http.createServer(socket_app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

const checkJWTValidity = (jwt) => {
    return jwt ? true : false;
}

const getJWTPayload = (jwt) => {
    return {
        id: 1,
        general_role: 'client'
    }
}

const getCardsByMsisdns = (msisdns, client_id) => {
    return [
        {
            id: 1,
            msisdn: '6282192400001',
            client_id: 1
        },
        {
            id: 2,
            msisdn: '6282192400002',
            client_id: 1
        },
        {
            id: 3,
            msisdn: '6282192400003',
            client_id: 1
        },
        {
            id: 4,
            msisdn: '6282192400004',
            client_id: 1
        },
        {
            id: 5,
            msisdn: '6282192400005',
            client_id: 1
        },
        {
            id: 6,
            msisdn: '6282192400006',
            client_id: 1
        },
        {
            id: 7,
            msisdn: '6282192400007',
            client_id: 1
        },
        {
            id: 8,
            msisdn: '6282192400008',
            client_id: 1
        },
        {
            id: 9,
            msisdn: '6282192400009',
            client_id: 1
        },
        {
            id: 10,
            msisdn: '6282192400010',
            client_id: 1
        }
    ].filter((d) => msisdns.includes(d.msisdn));
}

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!checkJWTValidity(token)) {
        const err = new Error('Unauthorized');
        next(err);
        return;
    }
    next();
});

io.on('connection', (socket) => {
    console.log('Connection initiated');
    socket.on('subscribe_msisdn_quota', (msisdns, jwt) => {
        console.log(`Received subscribe request for ${msisdns}`)
        const jwt_payload = getJWTPayload(jwt);
        const client_id = jwt_payload.id;

        const success_card_msisdns = [];
        const failed_card_msisdns = [];

        const cards = getCardsByMsisdns(msisdns, client_id);
        for (const card of cards) {
            success_card_msisdns.push(card.msisdn);
        }
        for (const msisdn of msisdns) {
            if (!success_card_msisdns.includes(msisdn)) {
                failed_card_msisdns.push(msisdn);
            }
        }

        for (const msisdn of success_card_msisdns) {
            socket.join(msisdn);
        }

        console.log(`Success: ${success_card_msisdns}`);
        console.log(`Failed: ${failed_card_msisdns}`);
        
        socket.emit('subscribed_msisdn_quota', success_card_msisdns, failed_card_msisdns);
    });
});

mqtt_client.on('message', (topic, payload) => {
    if (topic === 'msisdn_quota') {
        console.log(`Received message from MQ topic ${topic}: ${payload}`);
        const { msisdn, quota, time } = JSON.parse(payload);
        io.to(msisdn).emit('quota_update', msisdn, quota, time);
    }
});

server.listen(3001);