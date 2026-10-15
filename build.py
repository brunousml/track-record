#!/usr/bin/env python3
"""Junta content/site.json e content/items/*.json em data.js (funciona via file:// e GitHub Pages)."""
import json, glob, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
site = json.load(open("content/site.json", encoding="utf-8"))
items = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob("content/items/*.json"))]
with open("data.js", "w", encoding="utf-8") as f:
    f.write("window.SITE=" + json.dumps(site, ensure_ascii=False, separators=(",", ":")) + ";\n")
    f.write("window.ITEMS=" + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"data.js: {len(items)} itens")
