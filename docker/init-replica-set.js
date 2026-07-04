rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "host.docker.internal:27017", priority: 2 },
    { _id: 1, host: "host.docker.internal:27018", priority: 1 },
    { _id: 2, host: "host.docker.internal:27019", priority: 1 }
  ]
});

print("Waiting for primary election...");
while (!rs.hello().isWritablePrimary) {
  sleep(1000);
}
print("Replica set ready.");
