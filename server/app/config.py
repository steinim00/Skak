import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = os.environ.get("DB_PATH", str(BASE_DIR / "data" / "skak.db"))

LICHESS_BASE_URL = "https://lichess.org"
LICHESS_TOKEN = os.environ.get("LICHESS_TOKEN", "")
DEFAULT_USERNAME = os.environ.get("LICHESS_USERNAME", "")

STOCKFISH_PATH = os.environ.get("STOCKFISH_PATH", "stockfish")
STOCKFISH_DEPTH = int(os.environ.get("STOCKFISH_DEPTH", "14"))
STOCKFISH_TIME_LIMIT = float(os.environ.get("STOCKFISH_TIME_LIMIT", "0"))  # 0 = use depth instead

CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
