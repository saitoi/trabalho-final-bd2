from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GeoPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float]

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, value: list[float]) -> list[float]:
        if len(value) != 2:
            raise ValueError("coordinates must contain longitude and latitude")
        lon, lat = value
        if not -180 <= lon <= 180:
            raise ValueError("longitude must be between -180 and 180")
        if not -90 <= lat <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return value


class EventBase(BaseModel):
    model_config = ConfigDict(extra="allow")

    tipo: str
    descricao: str | None = None
    dataHora: str
    gravidade: int = Field(ge=1, le=5)
    status: str = "Aberto"
    bairro: str | None = None
    cidade: str
    estado: str | None = None
    pais: str = "Brasil"
    localizacao: GeoPoint
    reportante: dict[str, Any] | None = None
    origem: dict[str, Any] | None = None
    metadados: dict[str, Any] | None = None


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    idEvento: str | None = None


class EventSearchResponse(BaseModel):
    items: list[EventRead]
    total: int
    page: int
    pageSize: int


class EventFilterOptions(BaseModel):
    paises: list[str]
    estados: list[str]
    cidades: list[str]
    bairros: list[str]


class CreateEventResponse(BaseModel):
    inserted_id: str


class RootStatus(BaseModel):
    status: str
    docs: str


class ReplicaMember(BaseModel):
    name: str
    state: str
    health: int | float
    uptime: int


class NodeStatus(BaseModel):
    ok: bool
    members: list[ReplicaMember]
    error: str | None = None


class NodeActionResponse(BaseModel):
    ok: bool
    name: str
    action: str
