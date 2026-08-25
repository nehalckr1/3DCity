"""ULPIN ID generation for 3D cadastral units.

Base ULPIN format: KA-BLR-00042
Per-unit extension:  KA-BLR-00042-F05-U03
"""

BASE_ULPIN = "KA-BLR-00042"

UNIT_LETTERS = ["A", "B", "C", "D"]


def unit_number_for_letter(letter: str) -> int:
    return UNIT_LETTERS.index(letter) + 1


def generate_unit_ulpin(floor: int, unit_letter: str, base_ulpin: str = BASE_ULPIN) -> str:
    unit_number = unit_number_for_letter(unit_letter)
    return f"{base_ulpin}-F{floor:02d}-U{unit_number:02d}"
