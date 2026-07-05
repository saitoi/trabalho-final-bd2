from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# AJUSTE LOCAL — directConnection=true contorna a descoberta de topologia do replica
# set no host, necessário no Docker Desktop para Windows onde a resolução de DNS dos
# containers não é acessível diretamente. Em produção/Linux, remover o parâmetro e
# usar a URI completa do replica set: mongodb://mongo1:27017,mongo2:27017,mongo3:27017/bd2?replicaSet=rs0
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017/bd2?directConnection=true"
)
DB_NAME = os.getenv("MONGO_DB", "bd2")

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]

eventos           = db["eventos"]
fontes_manifest   = db["fontes_raw_manifest"]
experimentos      = db["experimentos"]
