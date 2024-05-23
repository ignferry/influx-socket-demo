require('dotenv').config();

const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const mqtt = require('mqtt');

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN || 'token';
const org = process.env.INFLUXDB_ORG || 'org';
const bucket = process.env.INFLUXDB_BUCKET || 'cmp';

const client = new InfluxDB({url, token});
const writeApi = client.getWriteApi(org, bucket, 's');

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
});

const msisdn_data = [
    {
        msisdn: '6282192400001',
        quota: 1000
    },
    {
        msisdn: '6282192400002',
        quota: 1000
    },
    {
        msisdn: '6282192400003',
        quota: 1000
    },
    {
        msisdn: '6282192400004',
        quota: 1000
    },
    {
        msisdn: '6282192400005',
        quota: 1000
    },
    {
        msisdn: '6282192400006',
        quota: 1000
    },
    {
        msisdn: '6282192400007',
        quota: 1000
    },
    {
        msisdn: '6282192400008',
        quota: 1000
    },
    {
        msisdn: '6282192400009',
        quota: 1000
    },
    {
        msisdn: '6282192400010',
        quota: 1000
    }
]

let index = 0;

const writeInterval = setInterval(() => {
    if (index === msisdn_data.length) index = 0;
    if (msisdn_data[index].quota < 10) msisdn_data[index].quota = 1000;
    const current_date = new Date();

    // Write point to InfluxDB write buffer
    const point = new Point('quota')
        .tag('msisdn', msisdn_data[index].msisdn)
        .floatField('quota', msisdn_data[index].quota)
        .timestamp(current_date);
    writeApi.writePoint(point);
    console.log(`${point.toLineProtocol(writeApi)}`)
    
    // Send to MQ
    mqtt_client.publish(
        'msisdn_quota', 
        JSON.stringify({
            msisdn: msisdn_data[index].msisdn,
            quota: msisdn_data[index].quota,
            time: current_date
        }), 
        {
            qos: 1,
            retain: false,
        },
        (error) => {
            if (error) {
                console.log(error);
            }
        }
    );
    
    msisdn_data[index].quota -= Math.floor(Math.random() * 20);
    index++;
}, 1000);

const flushInterval = setInterval(() => {
    // Execute write to server
    writeApi.flush();
}, 5000);;


setTimeout(() => {
    console.log('Close');
    writeApi.close();
    clearInterval(writeInterval);
    clearInterval(flushInterval)
}, 300000);