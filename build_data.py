# -*- coding: utf-8 -*-
"""把 raw/ 里的分片 JSON 合并成前端可直接加载的紧凑 JS 数据文件。"""
import glob
import json
import os
import re
import sys

import zhconv

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
DATA = os.path.join(HERE, "data")

# 汉字范围：BMP 基本区 + 扩展 A，覆盖诗词用字
CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]")


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize(item):
    """返回 (author, title, text) 或 None。"""
    author = (item.get("author") or "").strip()
    title = (item.get("title") or "").strip()
    paras = item.get("paragraphs") or item.get("rhythmic") or []
    if isinstance(paras, str):
        paras = [paras]
    lines = [p.strip() for p in paras if isinstance(p, str) and p.strip()]
    if not title and not lines:
        return None
    return (author or "佚名", title or "无题", "\n".join(lines))


def collect(pattern, dedupe):
    rows = []
    seen = set()
    for path in sorted(glob.glob(os.path.join(RAW, pattern))):
        payload = load(path)
        for item in payload:
            if not isinstance(item, dict):
                continue
            rec = normalize(item)
            if not rec:
                continue
            key = (rec[0], rec[1], rec[2])
            if dedupe and key in seen:
                continue
            seen.add(key)
            rows.append(rec)
    return rows


def build_char_table(strings):
    chars = set()
    for s in strings:
        chars.update(CJK.findall(s))
    table = {}
    for ch in chars:
        conv = zhconv.convert(ch, "zh-hans")
        if conv != ch:
            table[ch] = conv
    return table


def write_js(name, varname, payload):
    path = os.path.join(DATA, name)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.%s=%s;\n" % (varname, body))
    return path, len(body.encode("utf-8"))


def main():
    os.makedirs(DATA, exist_ok=True)

    print("合并唐诗 ...", flush=True)
    tang = collect("poet.tang.*.json", dedupe=True)
    print("  唐诗 %d 首" % len(tang), flush=True)

    print("合并宋词 ...", flush=True)
    song = collect("ci.song.*.json", dedupe=True)
    print("  宋词 %d 首" % len(song), flush=True)

    # 作者小传
    authors = {}
    tang_author_file = os.path.join(RAW, "authors.tang.json")
    if os.path.exists(tang_author_file):
        for row in load(tang_author_file):
            name = (row.get("name") or "").strip()
            desc = (row.get("desc") or "").strip()
            if name:
                authors.setdefault(name, desc)
    song_author_file = os.path.join(RAW, "author.song.json")
    if os.path.exists(song_author_file):
        for row in load(song_author_file):
            name = (row.get("name") or "").strip()
            desc = (row.get("desc") or "").strip()
            if name and name not in authors:
                authors[name] = desc

    print("生成繁简对照表 ...", flush=True)
    all_text = [r[2] for r in tang] + [r[2] for r in song] + list(authors.values())
    table = build_char_table(all_text)
    print("  %d 个繁体字" % len(table), flush=True)

    outputs = [
        ("dict.js", "T2S", table),
        ("authors.js", "POETRY_AUTHORS", authors),
        ("tang.js", "POETRY_TANG", tang),
        ("song.js", "POETRY_SONG", song),
    ]
    for name, var, payload in outputs:
        p, size = write_js(name, var, payload)
        print("  %-12s %7.2f MB" % (name, size / 1024 / 1024), flush=True)

    print("完成。唐诗 %d 首，宋词 %d 首，作者 %d 位。"
          % (len(tang), len(song), len(authors)), flush=True)


if __name__ == "__main__":
    sys.exit(main())
