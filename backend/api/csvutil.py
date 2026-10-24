"""Helpers shared by every CSV export."""


def safe_cell(cell):
    """Neutralise spreadsheet formula injection in user-supplied text."""
    if isinstance(cell, str) and cell[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + cell
    return cell
