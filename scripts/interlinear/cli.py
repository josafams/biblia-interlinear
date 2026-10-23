"""The command line of the scripts: the docstring of the script is its --help."""

import argparse


def parser(doc: str | None) -> argparse.ArgumentParser:
    return argparse.ArgumentParser(description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
