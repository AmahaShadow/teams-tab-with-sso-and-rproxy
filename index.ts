import express from "express";
import request from "request";
import path from "path";
import jwtDecode from 'jwt-decode';

//environment stuff
let fs = require("fs"); 
require('dotenv').config();//load env config


// init app and session store
var app = express();
var session = require('express-session')
var MemoryStore = require('memorystore')(session)
app.use(session({ 
	secret: process.env.SESSION_SECRET, 
	cookie: { secure: true, maxAge: 86400000 }, //in milliseconds
	name: process.env.SESSION_COOKIEJAR, 
	store: new MemoryStore({ checkPeriod: 86400000 }),
	resave: false,
	saveUninitialized: true 
	}))
app.set("port", process.env.SERVER_PORT || 8888);

// render engine init
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use('/public', express.static(path.join(__dirname, 'public')));

//main route
//reverse proxy to a php server with basic session control and GET redirect => POST
//http/post are apparently not supported by Teams, so forms need to be send with method=get
app.get("/tab", (req,res) => {
	
    if ( (req.session!.data === undefined) || (req.session!.data['user'] === undefined) )
	{ 
		console.log("Call /tab by unidentified endpoint");
		res.render("user_not_recognized");
		return;
	}
	let iTab = (req.query.iTab || -1)
	let iScope = (req.query.iScope || "null")
	if (iScope != "null")
		req.session!.data['scope']=iScope
	req.session!.data['pageCount'] = (req.session!.data['pageCount'] || 0) + 1
	console.log("Call /tab ("+iTab+") by "+req.session!.data['user'].oid + " [pC="+req.session!.data['pageCount']+"], Scope="+req.session!.data['scope']);
	
	var buf1 = JSON.stringify(req.query);	
	var buf2 = JSON.stringify({});
    if ( (req.session!.context === undefined) || (req.session!.context['theme'] === undefined) )
    {
    }
    else
    {   
		var buf2 = JSON.stringify(req.session!.context);
	}
	 request( process.env.API_URL || "", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        "form": {
            "itab": iTab,
            "scope": req.session!.data['scope'],
            "user_id": req.session!.data['user'].oid,
            "client_secret": process.env.API_SECRET,
            "context": buf2,
            "query": buf1
        }
    }, (error,response,body) => {
		if (error!=null)
		{
			console.log("Resp : "+response);
			console.log("Body : "+body);
			console.log("Error : "+error);
		}		
		//the content returned by the internal server is inserted as raw into the pug placeholder
		res.render("tab",{ title: 'Hey', message: body, pageCount: req.session!.data['pageCount'] });
    });
	
})

app.get("/ajax", (req,res) => {
	
    if ( (req.session!.data === undefined) || (req.session!.data['user'] === undefined) )
	{ 
		console.log("Call /ajax by unidentified endpoint");
		res.render("user_not_recognized");
		return;
	}
	
	var buf1 = JSON.stringify(req.query);	
	console.log("Call /ajax ("+buf1+") by "+req.session!.data['user'].oid);
	 request( process.env.API_URL || "", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        "form": {
            "itab": "ajax",
            "user_id": req.session!.data['user'].oid,
            "client_secret": process.env.API_SECRET,
            "query": buf1
        }
    }, (error,response,body) => {
		if (error!=null)
		{
			console.log("Resp : "+response);
			console.log("Body : "+body);
			console.log("Error : "+error);
		}		
		//the content returned by the internal server is inserted as raw into the pug placeholder
		res.render("ajax",{ message: body });
    });
	
})
 
//this is done to retrieve the terminal type and theme color (light/dark)
//so internal app can adapt for better readability
app.get("/storeContext", (req,res) => {
    const hostClientType = (req.query.hostClientType || -1);
	const theme = (req.query.theme || -1)
    console.log("\n\nContext received");
    console.log(hostClientType);
    console.log(theme);
    req.session!.context=req.query;
	res.end();  
	});
		
//Authentication against the Teams OAuthv2 token & decoding to get user UUID
//https://dev.to/urmade/seamless-sso-login-for-microsoft-teams-tabs-3n8k
//https://github.com/Urmade/TeamsTabSSO
//other pages will redirect here if they are not authenticated
app.get("/storeToken", (req,res) => {
    const idToken = req.query.token;
    if (!idToken) {
        res.status(500).send("There was no token contained in the request. ");
        return;
    }
    console.log("Call /storeToken");
    //console.log("Token received");
    //console.log(idToken);
    request("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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
    }, (error,response,body) => {
        const access_token = JSON.parse(body)["access_token"];
		if (error!=null)
		{
			console.log("Resp : "+response);
			console.log("Body : "+body);
			console.log("Error : "+error);
			console.log(access_token);
		}
		const claims = jwtDecode(access_token);
		if (false)
		{		
			console.log("Access token decoded");
			console.log(claims);
		}
		if ( (req.session!.data === undefined) || (req.session!.data['user'] === undefined) )
			req.session!.data={ "ctl_sess" : "true", "pageCount" : 1, "scope" : "undefined" };
		req.session!.data['user']=claims;
		console.log('currentUser : '+req.session!.data['user'].oid)
		
		res.render("tab",{ title: 'Hey', message: 'Hello there '+claims });
    })
})

// Let's start our nodejs server
// with https support
let privateKey = fs.readFileSync(process.env.SSL_KEY, "utf8"); 
let certificate = fs.readFileSync(process.env.SSL_CERT, "utf8");
let credentials = {key: privateKey, cert: certificate};
let https = require("https"); 
https.createServer(credentials, app).listen(app.get("port")); 
console.log("Express server listening on port " + app.get("port")); 
