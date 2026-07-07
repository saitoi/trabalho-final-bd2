import os
from functools import lru_cache

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.read_preferences import ReadPreference

load_dotenv()

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017/bd2?directConnection=true",
)
DB_NAME = os.getenv("MONGO_DB", "bd2")


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    return MongoClient(MONGO_URI, read_preference=ReadPreference.PRIMARY_PREFERRED)


def get_database() -> Database:
    return get_mongo_client()[DB_NAME]


def get_events_collection() -> Collection:
    return get_database()["eventos"]


def get_raw_manifest_collection() -> Collection:
    return get_database()["fontes_raw_manifest"]


def get_experiments_collection() -> Collection:
    return get_database()["experimentos"]
