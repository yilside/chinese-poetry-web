# -*- coding: utf-8 -*-
"""从 chinese-poetry 仓库下载全唐诗 / 宋词的分片数据到 raw/ 目录。

本机直连 raw.githubusercontent.com 的 TLS 握手会被阻断，因此默认走国内可访问的
镜像源，并在源之间自动切换。
"""
import concurrent.futures as cf
import json
import os
import sys
import time
import urllib.parse
import urllib.request

Q = urllib.parse.quote
SOURCES = [
    "https://raw.gitcode.com/chinese-poetry/chinese-poetry/raw/master/{dir}/{name}",
    "https://gh-proxy.com/https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/{dir}/{name}",
    "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/{dir}/{name}",
]

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

TASKS = []
for i in range(0, 57001, 1000):
    TASKS.append(("全唐诗", "poet.tang.%d.json" % i))
for i in range(0, 21001, 1000):
    TASKS.append(("宋词", "ci.song.%d.json" % i))
TASKS += [
    ("全唐诗", "唐诗三百首.json"),
    ("全唐诗", "authors.tang.json"),
    ("宋词", "宋词三百首.json"),
    ("宋词", "author.song.json"),
]


def fetch(task):
    folder, name = task
    dest = os.path.join(RAW, name)
    if os.path.exists(dest) and os.path.getsize(dest) > 1024:
        return ("skip", name, os.path.getsize(dest))

    last = None
    for tmpl in SOURCES:
        url = tmpl.format(dir=Q(folder, safe=""), name=Q(name, safe=""))
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0", "Accept": "*/*"}
            )
            with urllib.request.urlopen(req, timeout=40) as resp:
                body = resp.read()
            data = json.loads(body.decode("utf-8"))
            if not isinstance(data, list) or len(data) < 1:
                raise ValueError("unexpected payload")
            with open(dest, "wb") as f:
                f.write(body)
            return ("ok", name, len(data))
        except Exception as exc:  # noqa: BLE001
            last = "%s @ %s" % (exc, url.split("/")[2])
            time.sleep(0.4)
    return ("fail", name, last)


def main():
    os.makedirs(RAW, exist_ok=True)
    ok = skip = fail = 0
    failed = []
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch, t): t for t in TASKS}
        for idx, fut in enumerate(cf.as_completed(futures), 1):
            status, name, info = fut.result()
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            else:
                fail += 1
                failed.append((name, info))
            if idx % 20 == 0 or idx == len(TASKS):
                print("进度 %d/%d  ok=%d skip=%d fail=%d"
                      % (idx, len(TASKS), ok, skip, fail), flush=True)
    if failed:
        print("失败文件:")
        for name, err in failed:
            print("  -", name, err)
        sys.exit(1)
    print("下载完成：新增 %d，跳过 %d" % (ok, skip))


if __name__ == "__main__":
    main()
