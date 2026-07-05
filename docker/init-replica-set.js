// AJUSTE LOCAL — No Docker Desktop para Windows, host.docker.internal resolve para o
// IP da rede (ex: 192.168.1.x) e não para 127.0.0.1, impedindo a comunicação entre
// containers do replica set. Por isso os hosts foram trocados pelos nomes dos serviços
// definidos no docker-compose.yml. A configuração original está comentada abaixo.
//
// Configuração original (usar fora do Docker Desktop / Linux):
// rs.initiate({
//   _id: "rs0",
//   members: [
//     { _id: 0, host: "host.docker.internal:27017", priority: 2 },
//     { _id: 1, host: "host.docker.internal:27018", priority: 1 },
//     { _id: 2, host: "host.docker.internal:27019", priority: 1 }
//   ]
// });

rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2 },
    { _id: 1, host: "mongo2:27017", priority: 1 },
    { _id: 2, host: "mongo3:27017", priority: 1 }
  ]
});

print("Waiting for primary election...");
while (!rs.hello().isWritablePrimary) {
  sleep(1000);
}
print("Replica set ready.");
