"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const sqlServer_1 = require("../electron/sqlServer");
const app = (0, express_1.default)();
const db = new sqlServer_1.SqlServer();
const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_USERNAME = process.env.API_ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.API_ADMIN_PASSWORD || '';
if (!JWT_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error('API authentication environment variables are missing.');
}
const allowedOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim());
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Origin not allowed.'));
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express_1.default.json({ limit: '1mb' }));
function safeEqual(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length &&
        (0, node_crypto_1.timingSafeEqual)(left, right);
}
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    try {
        jsonwebtoken_1.default.verify(header.slice(7), JWT_SECRET);
        next();
    }
    catch {
        res.status(401).json({ message: 'Invalid or expired token.' });
    }
}
function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res)).catch(next);
    };
}
// Public health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'GRINDxGAMING API' });
});
// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' ||
        typeof password !== 'string' ||
        !safeEqual(username, ADMIN_USERNAME) ||
        !safeEqual(password, ADMIN_PASSWORD)) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jsonwebtoken_1.default.sign({ sub: ADMIN_USERNAME, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, expiresIn: 28800 });
});
// All following routes require authentication
app.use('/api', authenticate);
// Get all consoles
app.get('/api/consoles', asyncRoute(async (_req, res) => {
    res.json(await db.getAllPlaystations());
}));
// Add console
app.post('/api/consoles', asyncRoute(async (req, res) => {
    const id = await db.addPlaystation(req.body);
    res.status(201).json({ id });
}));
// Get active session
app.get('/api/consoles/:id/session', asyncRoute(async (req, res) => {
    const session = await db.getSession(Number(req.params.id));
    res.json(session);
}));
// Update console rates
app.put('/api/consoles/:id/rates', asyncRoute(async (req, res) => {
    await db.updateConsoleRates(Number(req.params.id), req.body.rates);
    res.json({ success: true });
}));
// Delete console
app.delete('/api/consoles/:id', asyncRoute(async (req, res) => {
    await db.deletePlaystation(Number(req.params.id));
    res.json({ success: true });
}));
// Reset all data. This is deliberately protected by JWT authentication
// and requires an explicit confirmation phrase from the administrator.
app.post('/api/admin/reset', asyncRoute(async (req, res) => {
    if (req.body?.confirmation !== 'RESET ALL DATA') {
        return res.status(400).json({ message: 'Explicit reset confirmation is required.' });
    }
    await db.resetAll();
    res.json({ success: true });
}));
// Reserve console
app.post('/api/sessions/reserve', asyncRoute(async (req, res) => {
    const { PlayStationID, PlayersNumber, DurationMinutes, DiscountPercent } = req.body;
    const result = await db.reserve(Number(PlayStationID), Number(PlayersNumber), Number(DurationMinutes), Number(DiscountPercent ?? 0));
    res.status(201).json(result);
}));
// End session and create billing record
app.post('/api/sessions/end', asyncRoute(async (req, res) => {
    const result = await db.endSession(Number(req.body.PlayStationID));
    res.json(result);
}));
// Add players
app.post('/api/sessions/add-players', asyncRoute(async (req, res) => {
    await db.addPlayers(Number(req.body.PlayStationID), Number(req.body.additionalPlayers));
    res.json({ success: true });
}));
// Extend session
app.post('/api/sessions/extend', asyncRoute(async (req, res) => {
    await db.extendTime(Number(req.body.PlayStationID), Number(req.body.additionalMinutes));
    res.json({ success: true });
}));
app.get('/api/health/database', asyncRoute(async (_req, res) => {
    await db.getAllPlaystations();
    res.json({ status: 'connected' });
}));
app.use((error, _req, res, _next) => {
    console.error('[API ERROR]', error.message);
    res.status(400).json({ message: error.message || 'Request failed.' });
});
const server = app.listen(PORT, () => {
    console.log(`[API] GRINDxGAMING API running on port ${PORT}`);
});
async function shutdown() {
    server.close();
    await db.close().catch(console.error);
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
