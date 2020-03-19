import express, { Application } from "express";
import socketIO, { Server as SocketIOServer } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import path from "path";
import { UserRegistry } from "./user-session/UserRegistry";
import { CandidatesQueue } from "./kurento/CadidatesQueue";
import kurento from 'kurento-client';
import { CallSocketHandler } from "./kurento/CallSocketHandler";

export type ProcessArgs = {
    as_uri: string;
    ws_uri: string;
    file_uri: string;
}

export class Server {
    private app: Application = express();
    private httpServer: HTTPServer = createServer(this.app);
    private io: SocketIOServer = socketIO(this.httpServer);
    private sessionStore: UserRegistry = new UserRegistry();
    private candiadtesQueue: CandidatesQueue = new CandidatesQueue();

    private readonly DEFAULT_PORT = Number(process.env.PORT) || 5000;

    constructor(public args: ProcessArgs) {}

    private configureApp(): void {
        this.app.use(express.static(path.join(__dirname, "../public")));
    }

    private configureRoutes(): void {
        this.app.get("/", (req, res) => {
            res.sendFile("index.html");
        });
    }

    private async handleSocketConnection() {
        const kurentoClient = await kurento(this.args.ws_uri);

        this.io.on("connection", socket => {
            new CallSocketHandler(this.sessionStore, this.candiadtesQueue, kurentoClient, socket);
        });
    }

    public async bootstrap() {
        await this.configureApp();
        await this.configureRoutes();
        await this.handleSocketConnection();
    }

    public listen(callback: (port: number) => void): void {
        this.httpServer.listen(this.DEFAULT_PORT, () => {
            callback(this.DEFAULT_PORT);
        });
    }
}
