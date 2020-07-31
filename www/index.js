"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var request_1 = __importDefault(require("request"));
var path_1 = __importDefault(require("path"));
var jwt_decode_1 = __importDefault(require("jwt-decode"));
//environment stuff
var fs = require("fs");
require('dotenv').config(); //load env config
// init app and session store
var app = express_1.default();
var session = require('express-session');
var MemoryStore = require('memorystore')(session);
app.use(session({
    secret: process.env.SESSION_SECRET,
    cookie: { secure: true, maxAge: 86400000 },
    name: process.env.SESSION_COOKIEJAR,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    resave: false,
    saveUninitialized: true
}));
app.set("port", process.env.SERVER_PORT || 8888);
// render engine init
app.set("view engine", "pug");
app.set("views", path_1.default.join(__dirname, "views"));
app.use('/public', express_1.default.static(path_1.default.join(__dirname, 'public')));
//main route
//reverse proxy to a php server with basic session control and GET redirect => POST
//http/post are apparently not supported by Teams, so forms need to be send with method=get
app.get("/tab", function (req, res) {
    if ((req.session.data === undefined) || (req.session.data['user'] === undefined)) {
        console.log("Call /tab by unidentified endpoint");
        res.render("user_not_recognized");
        return;
    }
    var iTab = (req.query.iTab || -1);
    req.session.data['pageCount'] = (req.session.data['pageCount'] || 0) + 1;
    console.log("Call /tab (" + iTab + ") by " + req.session.data['user'].oid + " [pC=" + req.session.data['pageCount'] + "]");
    var buf1 = JSON.stringify(req.query);
    var buf2 = JSON.stringify({});
    if ((req.session.context === undefined) || (req.session.context['theme'] === undefined)) {
    }
    else {
        var buf2 = JSON.stringify(req.session.context);
    }
    request_1.default(process.env.API_URL || "", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        "form": {
            "itab": iTab,
            "user_id": req.session.data['user'].oid,
            "client_secret": process.env.API_SECRET,
            "context": buf2,
            "query": buf1
        }
    }, function (error, response, body) {
        if (error != null) {
            console.log("Resp : " + response);
            console.log("Body : " + body);
            console.log("Error : " + error);
        }
        //the content returned by the internal server is inserted as raw into the pug placeholder
        res.render("tab", { title: 'Hey', message: body, pageCount: req.session.data['pageCount'] });
    });
});
//this is done to retrieve the terminal type and theme color (light/dark)
//so internal app can adapt for better readability
app.get("/storeContext", function (req, res) {
    var hostClientType = (req.query.hostClientType || -1);
    var theme = (req.query.theme || -1);
    console.log("\n\nContext received");
    console.log(hostClientType);
    console.log(theme);
    req.session.context = req.query;
    res.end();
});
//Authentication against the Teams OAuthv2 token & decoding to get user UUID
//https://dev.to/urmade/seamless-sso-login-for-microsoft-teams-tabs-3n8k
//https://github.com/Urmade/TeamsTabSSO
//other pages will redirect here if they are not authenticated
app.get("/storeToken", function (req, res) {
    var idToken = req.query.token;
    if (!idToken) {
        res.status(500).send("There was no token contained in the request. ");
        return;
    }
    console.log("Call /storeToken");
    //console.log("Token received");
    //console.log(idToken);
    request_1.default("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        "form": {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "client_id": process.env.OAUTH_APP_ID,
            "client_secret": process.env.OAUTH_APP_SECRET,
            "scope": "user.read",
            "requested_token_use": "on_behalf_of",
            "assertion": idToken
        }
    }, function (error, response, body) {
        var access_token = JSON.parse(body)["access_token"];
        if (error != null) {
            console.log("Resp : " + response);
            console.log("Body : " + body);
            console.log("Error : " + error);
            console.log(access_token);
        }
        var claims = jwt_decode_1.default(access_token);
        if (false) {
            console.log("Access token decoded");
            console.log(claims);
        }
        if ((req.session.data === undefined) || (req.session.data['user'] === undefined))
            req.session.data = { "ctl_sess": "true", "pageCount": 1 };
        req.session.data['user'] = claims;
        console.log('currentUser : ' + req.session.data['user'].oid);
        res.render("tab", { title: 'Hey', message: 'Hello there ' + claims });
    });
});
// Let's start our nodejs server
// with https support
var privateKey = fs.readFileSync(process.env.SSL_KEY, "utf8");
var certificate = fs.readFileSync(process.env.SSL_CERT, "utf8");
var credentials = { key: privateKey, cert: certificate };
var https = require("https");
https.createServer(credentials, app).listen(app.get("port"));
console.log("Express server listening on port " + app.get("port"));
