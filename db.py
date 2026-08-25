"""PostGIS wiring path — stub only, not run live for this round.

For the selection round, `data_gen/generate_mock_data.py` writes a static
GeoJSON that the frontend loads directly; nothing here executes. This module
sketches the schema/pipeline shape (SQLAlchemy + GeoAlchemy2 against
`sih_3dCity`) so it's a credible "here's the production path" talking point,
without spending build time getting a live connection working.

To make this real later: point DATABASE_URL at `sih_3dCity`, run
`Base.metadata.create_all(engine)`, and swap generate_mock_data.py's
GeoJSON writer for inserts against the Unit table below.
"""

from geoalchemy2 import Geometry
from sqlalchemy import Column, Date, Float, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()

DATABASE_URL = "postgresql://localhost/sih_3dCity"


class Unit(Base):
    __tablename__ = "units"

    id_3d_ulpin = Column(String, primary_key=True)
    base_ulpin = Column(String, nullable=False, index=True)
    floor = Column(Integer, nullable=False)
    unit_letter = Column(String(1), nullable=False)
    z_min = Column(Float, nullable=False)
    z_max = Column(Float, nullable=False)
    owner_name = Column(String, nullable=False)
    purchase_date = Column(Date, nullable=False)
    source = Column(String, nullable=False, default="mock")
    footprint = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)


def get_engine():
    """Not called for this round — placeholder for the live wiring path."""
    from sqlalchemy import create_engine

    return create_engine(DATABASE_URL)
