import logging

from app.config import Config
from app.main import build_map_provider


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    ok = build_map_provider(Config.from_env()).refresh()
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
