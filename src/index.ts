import { Server, ProcessArgs } from "./server";
import minimist from "minimist";

const argv = minimist<ProcessArgs>(process.argv.slice(2), {
    default: {
        as_uri: "https://198.211.109.51:8443/",
        ws_uri: "ws://198.211.109.51:8888/kurento",
        file_uri: 'file:///tmp/temp.webm'
    }
});


(async function main() {
    const server = new Server(argv);

    await server.bootstrap();

    server.listen(port => {
        console.log(`Server is listening on http://localhost:${port}`);
    });
})();
