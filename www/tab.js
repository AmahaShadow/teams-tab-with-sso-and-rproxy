"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function tabMain(app) {
    app.get("/tab", function (req, res) {
        if ((req.session.data === undefined) || (req.session.data['user'] === undefined)) {
            req.session.data = { user: '00000000-0000-0000-0000-000000000000' };
        }
        console.log("Call /tab by " + req.session.data['user'].oid);
        console.log("Call /tab");
        req.session.data['pageCount'] = (req.session.data['pageCount'] || 0) + 1;
        res.render("tab", { title: 'Hey', message: 'Hello there ' + req.session.data['user'].oid, pageCount: req.session.data['pageCount'] });
    });
}
exports.default = tabMain;
